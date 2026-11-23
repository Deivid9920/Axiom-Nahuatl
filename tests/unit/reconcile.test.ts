// R33-c — conciliación de pagos: MP (/v1/payments/search) vs Payment interno.
// Cubre: dev_skip sin token, pagos coherentes (matched), discrepancia de estado
// (MP aprobado vs interno pending = webhook perdido), huérfanos (unresolved) y
// fallo de la API de MP. fetchFn inyectado para no llamar a la API real.
import { describe, test, expect, afterEach } from 'vitest'
import { reconcileMpPayments, expectedInternalStatus } from '@/lib/billing/reconcile'
import { prisma } from '../setup'

const TOKEN_KEY = 'MERCADO_PAGO_ACCESS_TOKEN'
const tokenAntes = process.env[TOKEN_KEY]

afterEach(() => {
  if (tokenAntes === undefined) delete process.env[TOKEN_KEY]
  else process.env[TOKEN_KEY] = tokenAntes!
})

function mpSearchResponse(results: unknown[]) {
  return async () => ({ ok: true, status: 200, json: async () => ({ results }) } as Response)
}

async function userAndPayment(overrides?: { status?: string; providerPaymentId?: string | null }) {
  const user = await prisma.user.create({
    data: {
      email: `r33-rec-${Date.now()}-${Math.floor(Math.random() * 1e6)}@t.mx`,
      name: 'Reconcile R33',
      passwordHash: 'no-login-r33',
    },
  })
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      amountMxnCents: 39900,
      amountUsdCents: 1990,
      cadence: 'monthly',
      status: overrides?.status ?? 'pending',
      providerPaymentId: overrides?.providerPaymentId === null ? null : overrides?.providerPaymentId ?? null,
    },
  })
  return { user, payment }
}

describe('R33-c — expectedInternalStatus (mapeo MP → interno)', () => {
  test('approved→succeeded, fallidos→failed, resto→pending', () => {
    expect(expectedInternalStatus('approved')).toBe('succeeded')
    expect(expectedInternalStatus('rejected')).toBe('failed')
    expect(expectedInternalStatus('cancelled')).toBe('failed')
    expect(expectedInternalStatus('refunded')).toBe('failed')
    expect(expectedInternalStatus('charged_back')).toBe('failed')
    expect(expectedInternalStatus('pending')).toBe('pending')
    expect(expectedInternalStatus('in_process')).toBe('pending')
    expect(expectedInternalStatus('authorized')).toBe('pending')
  })
})

describe('R33-c — reconcileMpPayments', () => {
  test('sin token: dev_skip con reporte vacío (mismo patrón que processRealPaymentWebhook)', async () => {
    delete process.env[TOKEN_KEY]
    const res = await reconcileMpPayments()
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.mode).toBe('dev_skip')
    expect(res.report.checked).toBe(0)
  })

  test('pago coherente (MP approved + interno succeeded por external_reference) → matched', async () => {
    process.env[TOKEN_KEY] = 'test-token-r33'
    const { payment } = await userAndPayment({ status: 'succeeded' })
    const res = await reconcileMpPayments({
      fetchFn: mpSearchResponse([
        { id: 900001, status: 'approved', external_reference: payment.id, transaction_amount: 399 },
      ]),
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.mode).toBe('live')
    expect(res.report.checked).toBe(1)
    expect(res.report.matched).toBe(1)
    expect(res.report.statusMismatch).toBe(0)
    expect(res.report.unresolved).toBe(0)
  })

  test('discrepancia de estado (MP approved, interno pending) → statusMismatch con detalle', async () => {
    process.env[TOKEN_KEY] = 'test-token-r33'
    const { payment } = await userAndPayment({ status: 'pending' }) // webhook perdido
    const res = await reconcileMpPayments({
      fetchFn: mpSearchResponse([
        { id: 900002, status: 'approved', external_reference: payment.id, transaction_amount: 399 },
      ]),
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.statusMismatch).toBe(1)
    expect(res.report.mismatches[0]).toMatchObject({
      mpPaymentId: '900002',
      mpStatus: 'approved',
      expectedInternal: 'succeeded',
      internalStatus: 'pending',
      internalPaymentId: payment.id,
      amountMpMxnCents: 39900,
      amountInternalMxnCents: 39900,
    })
  })

  test('huérfano (MP sin correspondencia interna) → unresolved', async () => {
    process.env[TOKEN_KEY] = 'test-token-r33'
    const res = await reconcileMpPayments({
      fetchFn: mpSearchResponse([
        { id: 900003, status: 'approved', external_reference: 'cuid-inexistente', transaction_amount: 100, date_created: '2026-10-01T10:00:00.000-03:00' },
      ]),
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.unresolved).toBe(1)
    expect(res.report.unresolvedItems[0]).toMatchObject({
      mpPaymentId: '900003',
      mpStatus: 'approved',
      externalReference: 'cuid-inexistente',
    })
  })

  test('resolución por providerPaymentId cuando external_reference no existe', async () => {
    process.env[TOKEN_KEY] = 'test-token-r33'
    const { payment } = await userAndPayment({ status: 'succeeded', providerPaymentId: '900004' }) // formato String(mp.id) que guarda el webhook
    const res = await reconcileMpPayments({
      fetchFn: mpSearchResponse([
        { id: 900004, status: 'approved', external_reference: null, transaction_amount: 399 },
      ]),
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.report.matched).toBe(1)
    expect(payment.providerPaymentId).toBe('900004')
  })

  test('API de MP caída → ok:false mp_fetch_failed', async () => {
    process.env[TOKEN_KEY] = 'test-token-r33'
    const res = await reconcileMpPayments({
      fetchFn: async () => ({ ok: false, status: 502 } as Response),
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('mp_fetch_failed')
    expect(res.status).toBe(502)
  })
})
