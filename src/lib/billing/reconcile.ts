// R33-c — conciliación de pagos: Mercado Pago (/v1/payments/search) vs Payment interno.
// Reporte de sólo lectura que compara los pagos reales de MP (ventana reciente,
// ordenados por fecha descendente) contra nuestros registros Payment, y clasifica:
//   matched        — el pago existe internamente y el estado es coherente
//   statusMismatch — existe pero el estado interno difiere del esperado según MP
//                    (p.ej. MP aprobado y el interno sigue pending → webhook perdido)
//   unresolved     — MP tiene el pago pero no resuelve a ningún Payment interno
//                    (external_reference desconocido y providerPaymentId ausente)
// Sin token (dev) responde dev_skip con reporte vacío — mismo patrón que
// processRealPaymentWebhook. `fetchFn` inyectable para pruebas.
// R34-a — reparación desde la conciliación: el reporte era de sólo lectura; esta
// acción reprocessa UN webhook perdido reutilizando el procesador real del webhook
// (R32-c processRealPaymentWebhook), que consulta GET /v1/payments/{id}, valida
// estado, resuelve el Payment por external_reference/providerPaymentId y aplica la
// lógica interna completa (cadence, anclas, proration, dunning) con idempotencia.
// Para huérfanos (sin Payment interno) el procesador responde payment_not_resolved:
// la reparación NO inventa registros, sólo reprocessa notificaciones perdidas.
import { db } from '@/lib/db'
import { logger, audit } from '@/lib/observability'
import { processRealPaymentWebhook } from './index'

const MP_API_BASE = 'https://api.mercadopago.com'

export const MP_RECONCILE_WINDOW_DAYS = 30
export const MP_RECONCILE_LIMIT = 50 // tope por llamada de /v1/payments/search

// Estado interno esperado según el estado reportado por MP (misma correspondencia
// que processRealPaymentWebhook: approved→succeeded; fallidos→failed; resto→pending).
export function expectedInternalStatus(mpStatus: string): 'succeeded' | 'failed' | 'pending' {
  if (mpStatus === 'approved') return 'succeeded'
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(mpStatus)) return 'failed'
  return 'pending'
}

export interface MpReconcileMismatch {
  mpPaymentId: string
  mpStatus: string
  expectedInternal: string
  internalStatus: string
  internalPaymentId: string
  externalReference: string | null
  amountMpMxnCents: number | null
  amountInternalMxnCents: number | null
}

export interface MpReconcileUnresolved {
  mpPaymentId: string
  mpStatus: string
  externalReference: string | null
  amountMpMxnCents: number | null
  dateCreated: string | null
}

export interface MpReconcileReport {
  mode: 'live' | 'dev_skip'
  windowDays: number
  checked: number        // pagos de MP evaluados en la ventana
  matched: number
  statusMismatch: number
  unresolved: number
  mismatches: MpReconcileMismatch[]
  unresolvedItems: MpReconcileUnresolved[]
}

export async function reconcileMpPayments(opts?: {
  fetchFn?: typeof fetch
  now?: Date
  windowDays?: number
  limit?: number
}): Promise<{ ok: true; report: MpReconcileReport } | { ok: false; error: 'mp_fetch_failed' | 'mp_fetch_exception'; status?: number }> {
  const doFetch = opts?.fetchFn ?? fetch
  const now = opts?.now ?? new Date()
  const windowDays = opts?.windowDays ?? MP_RECONCILE_WINDOW_DAYS
  const limit = Math.min(opts?.limit ?? MP_RECONCILE_LIMIT, MP_RECONCILE_LIMIT)

  // Token leído en tiempo de llamada (patrón renewal.ts / processRealPaymentWebhook):
  // permite pruebas sin recargar el módulo.
  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!mpToken) {
    return { ok: true, report: {
      mode: 'dev_skip', windowDays, checked: 0, matched: 0, statusMismatch: 0, unresolved: 0,
      mismatches: [], unresolvedItems: [],
    } }
  }

  // Ventana de búsqueda en MP (begin_date/end_date ISO con offset explícito:
  // MP exige el formato 2026-01-01T12:00:00.000-03:00)
  const begin = new Date(now.getTime() - windowDays * 24 * 60 * 60_000)
  const iso = (d: Date) => d.toISOString().replace('Z', '-03:00')
  const url = `${MP_API_BASE}/v1/payments/search`
    + `?sort=date_created&criteria=desc&range=date_created`
    + `&begin_date=${encodeURIComponent(iso(begin))}&end_date=${encodeURIComponent(iso(now))}`
    + `&limit=${limit}`

  interface MpSearchPayment {
    id?: number | string
    status?: string
    external_reference?: string | null
    transaction_amount?: number
    date_created?: string
  }

  let results: MpSearchPayment[]
  try {
    const response = await doFetch(url, {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    })
    if (!response.ok) {
      logger.error('billing.reconcile_fetch_failed', { status: response.status, window_days: windowDays })
      return { ok: false, error: 'mp_fetch_failed', status: response.status }
    }
    const payload = (await response.json()) as { results?: MpSearchPayment[] }
    results = Array.isArray(payload.results) ? payload.results : []
  } catch (error) {
    logger.error('billing.reconcile_fetch_exception', { error: (error as Error).message }, error as Error)
    return { ok: false, error: 'mp_fetch_exception' }
  }

  const report: MpReconcileReport = {
    mode: 'live', windowDays, checked: 0, matched: 0, statusMismatch: 0, unresolved: 0,
    mismatches: [], unresolvedItems: [],
  }

  for (const mp of results) {
    report.checked++
    const mpId = String(mp.id ?? '')
    if (!mpId) continue
    const mpStatus = mp.status || ''
    const expected = expectedInternalStatus(mpStatus)
    const amountMpCents = typeof mp.transaction_amount === 'number' ? Math.round(mp.transaction_amount * 100) : null

    // Resolución del Payment interno: external_reference (canal preferente, es el
    // ID interno guardado al crear la preferencia) o providerPaymentId.
    const payment = (mp.external_reference
      ? await db.payment.findUnique({ where: { id: mp.external_reference } })
      : null)
      ?? await db.payment.findFirst({
        where: { providerPaymentId: mpId },
        orderBy: { createdAt: 'desc' },
      })

    if (!payment) {
      report.unresolved++
      if (report.unresolvedItems.length < 20) {
        report.unresolvedItems.push({
          mpPaymentId: mpId,
          mpStatus,
          externalReference: mp.external_reference ?? null,
          amountMpMxnCents: amountMpCents,
          dateCreated: mp.date_created ?? null,
        })
      }
      continue
    }

    if (payment.status === expected) {
      report.matched++
      continue
    }

    report.statusMismatch++
    if (report.mismatches.length < 20) {
      report.mismatches.push({
        mpPaymentId: mpId,
        mpStatus,
        expectedInternal: expected,
        internalStatus: payment.status,
        internalPaymentId: payment.id,
        externalReference: mp.external_reference ?? null,
        amountMpMxnCents: amountMpCents,
        amountInternalMxnCents: payment.amountMxnCents,
      })
    }
  }

  if (report.checked > 0) {
    logger.info('billing.reconcile_done', {
      checked: report.checked, matched: report.matched,
      status_mismatch: report.statusMismatch, unresolved: report.unresolved,
    })
  }
  return { ok: true, report }
}

// R34-a — reprocessa el webhook perdido de UN pago de MP (acción de reparación
// que acompaña al reporte de conciliación). Delegar en processRealPaymentWebhook
// garantiza el mismo mapeo de estados, resolución del Payment, idempotencia
// (already_processed) y procesamiento interno completo que el webhook real.
// Sin token (dev) responde dev_skip — no hay pago real que reparar.
export async function repairReconciledPayment(opts: {
  providerPaymentId: string  // ID del pago en MP (data.id / columna de la tabla de conciliación)
  fetchFn?: typeof fetch     // inyectable para pruebas
}): Promise<{ ok: boolean; action?: string }> {
  const result = await processRealPaymentWebhook({ providerPaymentId: opts.providerPaymentId, fetchFn: opts.fetchFn })
  logger.info('billing.reconcile_repair_applied', {
    provider_payment_id: opts.providerPaymentId,
    ok: result.ok,
    action: result.action ?? undefined,
  })
  await audit('billing.reconcile_repair_applied', {
    resourceType: 'payment',
    resourceId: opts.providerPaymentId,
    metadata: {
      ok: result.ok,
      action: result.action ?? null,
    },
  })
  return result
}
