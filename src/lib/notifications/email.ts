// R30-b — servicio de correo (avisos de vencimiento, recibos de renovación).
// Sin dependencias nuevas: si hay RESEND_API_KEY se envía por HTTP; en desarrollo
// el correo se registra en EmailLog con status 'dev_logged' (auditable en BD).
// dedupeKey único garantiza idempotencia: el mismo aviso (nivel + periodo) no se
// envía dos veces aunque el ciclo de facturación corra repetidas veces.
// R32-b — cola de reintentos: un envío que falla queda 'failed' con nextRetryAt
// programado (backoff EMAIL_RETRY_SCHEDULE_MINUTES); processEmailRetries() —
// invocado por el ciclo de facturación — re-intenta los vencidos y, en éxito,
// actualiza la MISMA fila (mantiene el historial y la dedupeKey).
import { db } from '@/lib/db'
import { logger } from '@/lib/observability'

export type EmailKind = 'renewal_notice' | 'renewal_receipt' | 'renewal_failed' | 'renewal_link'

export interface SendEmailOpts {
  to: string
  userId?: string | null
  subject: string
  body: string
  kind: EmailKind
  dedupeKey?: string | null
  relatedType?: 'subscription' | 'payment' | null
  relatedId?: string | null
}

export type SendEmailResult =
  | { ok: true; status: 'sent' | 'dev_logged'; emailLogId: string; duplicate: false }
  | { ok: true; status: 'skipped'; emailLogId: string | null; duplicate: true }
  | { ok: false; error: string }

const RESEND_API = 'https://api.resend.com/emails'

// R32-b — calendario de reintentos de envío (minutos desde el intento anterior):
// 1er reintento a los 5 min, 2º a los 30 y 3º a las 2 horas. Agotado el calendario
// el correo queda 'failed' terminal (visible en el panel admin con su lastError).
export const EMAIL_RETRY_SCHEDULE_MINUTES = [5, 30, 120]

// R32-b — calcula el siguiente reintento para un correo con retryCount intentos
// fallidos. Pura y testeable: exhausted=true cuando el calendario se agotó.
export function nextEmailRetry(retryCount: number, from: Date): { nextRetryAt: Date | null; exhausted: boolean } {
  if (retryCount >= EMAIL_RETRY_SCHEDULE_MINUTES.length) return { nextRetryAt: null, exhausted: true }
  const inMinutes = EMAIL_RETRY_SCHEDULE_MINUTES[retryCount]!
  return { nextRetryAt: new Date(from.getTime() + inMinutes * 60_000), exhausted: false }
}

// R32-b — entrega en sí (HTTP a Resend o dev_logged): separada de la persistencia
// para que sendEmail (alta) y processEmailRetries (re-intento de la MISMA fila)
// compartan exactamente la misma lógica de envío.
interface EmailMessage {
  to: string
  subject: string
  body: string
  kind: EmailKind
}

async function deliverEmail(msg: EmailMessage): Promise<{ status: 'sent' | 'dev_logged' | 'failed'; failure: string | null }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { status: 'dev_logged', failure: null }
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'Axiom <onboarding@resend.dev>',
        to: [msg.to],
        subject: msg.subject,
        text: msg.body,
      }),
    })
    if (res.ok) return { status: 'sent', failure: null }
    logger.error('email.send_failed', { to: msg.to, kind: msg.kind, status: res.status })
    return { status: 'failed', failure: `resend_error_${res.status}` }
  } catch (error) {
    logger.error('email.send_exception', { to: msg.to, kind: msg.kind, error: (error as Error).message })
    return { status: 'failed', failure: (error as Error).message }
  }
}

export async function sendEmail(opts: SendEmailOpts): Promise<SendEmailResult> {
  // Idempotencia: si el aviso con esta dedupeKey ya salió, no se repite.
  if (opts.dedupeKey) {
    const existing = await db.emailLog.findUnique({ where: { dedupeKey: opts.dedupeKey } })
    if (existing) {
      logger.info('email.duplicate_skipped', { dedupe_key: opts.dedupeKey, kind: opts.kind })
      return { ok: true, status: 'skipped', emailLogId: existing.id, duplicate: true }
    }
  }

  const { status, failure } = await deliverEmail({
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    kind: opts.kind,
  })

  // R32-b — si el envío falla, la fila nace YA en la cola de reintentos
  // (nextRetryAt según el calendario; lastError auditable en el panel).
  const retry = status === 'failed' ? nextEmailRetry(0, new Date()) : null

  try {
    const log = await db.emailLog.create({
      data: {
        userId: opts.userId ?? null,
        to: opts.to,
        subject: opts.subject,
        body: opts.body,
        kind: opts.kind,
        dedupeKey: opts.dedupeKey ?? null,
        status,
        relatedType: opts.relatedType ?? null,
        relatedId: opts.relatedId ?? null,
        sentAt: status === 'sent' ? new Date() : null,
        retryCount: status === 'failed' ? 1 : 0,
        nextRetryAt: retry?.nextRetryAt ?? null,
        lastError: failure,
      },
    })
    if (status === 'failed') {
      // R32-b — el envío no salió: la fila quedó en la cola de reintentos
      // (nextRetryAt programado). ok:false es veraz para el llamador; el correo
      // será reintentado por processEmailRetries con backoff.
      return { ok: false, error: failure ?? 'email_send_failed' }
    }
    return { ok: true, status, emailLogId: log.id, duplicate: false }
  } catch (error) {
    // Carrera benigna: otro proceso insertó el mismo dedupeKey entre el findUnique
    // y el create (P2002 = unique violation). El aviso ya existe → duplicado.
    const code = (error as { code?: string }).code
    if (code === 'P2002') {
      logger.info('email.duplicate_skipped', { dedupe_key: opts.dedupeKey, kind: opts.kind })
      return { ok: true, status: 'skipped', emailLogId: null, duplicate: true }
    }
    logger.error('email.log_failed', { to: opts.to, kind: opts.kind, error: (error as Error).message })
    return { ok: false, error: (error as Error).message }
  }
}

export interface EmailRetryResult {
  scanned: number   // correos 'failed' con reintento vencido evaluados
  succeeded: number // re-envíos logrados (fila actualizada a sent/dev_logged)
  failed: number    // re-envíos que volvieron a fallar (re-agendados)
  exhausted: number // correos que agotaron el calendario en este ciclo (terminal)
}

// R32-b — procesa la cola de reintentos: re-envía los correos 'failed' cuyo
// nextRetryAt ya venció. En éxito actualiza la MISMA fila (status/sentAt, limpia
// nextRetryAt); en fallo incrementa retryCount y re-agenda; al agotar el
// calendario deja la fila 'failed' terminal con nextRetryAt null.
// `sender` inyectable para pruebas (por defecto la entrega real).
export async function processEmailRetries(opts?: {
  now?: Date
  sender?: (log: { id: string; to: string; subject: string; body: string; kind: string }) => Promise<{ status: 'sent' | 'dev_logged' | 'failed'; failure: string | null }>
}): Promise<EmailRetryResult> {
  const now = opts?.now ?? new Date()
  const deliver = opts?.sender ?? (async (log) => {
    return deliverEmail({
      to: log.to,
      subject: log.subject,
      body: log.body,
      kind: (log.kind as EmailKind) || 'renewal_notice',
    })
  })

  const result: EmailRetryResult = { scanned: 0, succeeded: 0, failed: 0, exhausted: 0 }
  const due = await db.emailLog.findMany({
    where: {
      status: 'failed',
      nextRetryAt: { not: null, lte: now },
    },
    orderBy: { nextRetryAt: 'asc' },
    take: 50,
  })

  for (const log of due) {
    result.scanned++
    const outcome = await deliver({ id: log.id, to: log.to, subject: log.subject, body: log.body, kind: log.kind })
    if (outcome.status !== 'failed') {
      // Éxito: la misma fila pasa a enviada (conserva retryCount como historial).
      await db.emailLog.update({
        where: { id: log.id },
        data: { status: outcome.status, sentAt: new Date(), nextRetryAt: null, lastError: null },
      })
      logger.info('email.retry_succeeded', { email_id: log.id, kind: log.kind, attempt: log.retryCount + 1 })
      result.succeeded++
      continue
    }
    // Fallo de nuevo: re-agenda con backoff o deja terminal al agotar el calendario.
    const next = nextEmailRetry(log.retryCount, now) // retryCount ya cuenta los intentos fallidos
    if (next.exhausted) {
      await db.emailLog.update({ where: { id: log.id }, data: { nextRetryAt: null, lastError: outcome.failure } })
      logger.warn('email.retry_exhausted', { email_id: log.id, kind: log.kind, attempts: log.retryCount })
      result.exhausted++
      continue
    }
    await db.emailLog.update({
      where: { id: log.id },
      data: { retryCount: log.retryCount + 1, nextRetryAt: next.nextRetryAt, lastError: outcome.failure },
    })
    logger.info('email.retry_rescheduled', { email_id: log.id, kind: log.kind, attempt: log.retryCount + 1, next_retry_at: next.nextRetryAt?.toISOString() })
    result.failed++
  }

  if (result.scanned > 0) logger.info('email.retry_batch_done', { ...result })
  return result
}

// R33-b — reintento manual de UN correo concreto (disparado desde el panel admin):
// aplica exactamente la misma entrega y la misma contabilidad de la cola que el
// ciclo automático, pero sobre la fila indicada y sin esperar a que venza su
// nextRetryAt. Útil tanto para adelantar un reintento programado como para
// re-enviar un correo que agotó el calendario (failed terminal).
export async function retryEmailNow(emailLogId: string, opts?: {
  now?: Date
  sender?: (log: { id: string; to: string; subject: string; body: string; kind: string }) => Promise<{ status: 'sent' | 'dev_logged' | 'failed'; failure: string | null }>
}): Promise<
  | { ok: true; status: 'sent' | 'dev_logged' }
  | { ok: false; error: 'not_found' | 'not_retryable'; rescheduled?: false }
  | { ok: false; error: string; rescheduled: boolean; exhausted?: boolean }
> {
  const now = opts?.now ?? new Date()
  const log = await db.emailLog.findUnique({ where: { id: emailLogId } })
  if (!log) return { ok: false, error: 'not_found' }
  if (log.status !== 'failed') return { ok: false, error: 'not_retryable' }

  const deliver = opts?.sender ?? (async (row) => {
    return deliverEmail({
      to: row.to,
      subject: row.subject,
      body: row.body,
      kind: (row.kind as EmailKind) || 'renewal_notice',
    })
  })

  const outcome = await deliver({ id: log.id, to: log.to, subject: log.subject, body: log.body, kind: log.kind })
  if (outcome.status !== 'failed') {
    // Éxito: la misma fila pasa a enviada (conserva retryCount como historial).
    await db.emailLog.update({
      where: { id: log.id },
      data: { status: outcome.status, sentAt: new Date(), nextRetryAt: null, lastError: null },
    })
    logger.info('email.manual_retry_succeeded', { email_id: log.id, kind: log.kind, attempt: log.retryCount + 1 })
    return { ok: true, status: outcome.status }
  }

  // Fallo de nuevo: re-agenda con backoff o deja terminal al agotar el calendario
  // (misma contabilidad que processEmailRetries).
  const next = nextEmailRetry(log.retryCount, now)
  if (next.exhausted) {
    await db.emailLog.update({ where: { id: log.id }, data: { nextRetryAt: null, lastError: outcome.failure } })
    logger.warn('email.manual_retry_exhausted', { email_id: log.id, kind: log.kind, attempts: log.retryCount })
    return { ok: false, error: outcome.failure ?? 'email_send_failed', rescheduled: false, exhausted: true }
  }
  await db.emailLog.update({
    where: { id: log.id },
    data: { retryCount: log.retryCount + 1, nextRetryAt: next.nextRetryAt, lastError: outcome.failure },
  })
  logger.info('email.manual_retry_rescheduled', { email_id: log.id, kind: log.kind, attempt: log.retryCount + 1, next_retry_at: next.nextRetryAt?.toISOString() })
  return { ok: false, error: outcome.failure ?? 'email_send_failed', rescheduled: true }
}

// ——— Plantillas (español, texto plano) ———

export function renewalNoticeEmail(opts: {
  planName: string
  daysLeft: number
  level: 'info' | 'warning' | 'critical' | 'expired'
  autoRenew: boolean
  periodEnd: Date
  appName?: string
}): { subject: string; body: string } {
  const app = opts.appName || 'Axiom'
  const fecha = opts.periodEnd.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  if (opts.level === 'expired') {
    return {
      subject: `${app}: tu plan ${opts.planName} ha vencido`,
      body: [
        `Hola,`,
        ``,
        `Tu plan ${opts.planName} venció el ${fecha}.`,
        opts.autoRenew
          ? `Con la renovación automática activa intentaremos procesar el cobro para continuar sin interrupciones; si el cobro falla te avisaremos de inmediato.`
          : `La renovación automática está desactivada: renueva manualmente desde tu panel para mantener tus beneficios.`,
        ``,
        `Equipo ${app}`,
      ].join('\n'),
    }
  }
  const urgencia = opts.level === 'critical'
    ? `Tu plan vence muy pronto`
    : opts.level === 'warning'
      ? `Tu plan vence pronto`
      : `Aviso de renovación`
  return {
    subject: `${app}: ${urgencia.toLowerCase()} — ${opts.planName} renueva en ${opts.daysLeft} día${opts.daysLeft === 1 ? '' : 's'}`,
    body: [
      `Hola,`,
      ``,
      `${urgencia}: tu plan ${opts.planName} ${opts.daysLeft === 1 ? 'renueva en 1 día' : `renueva en ${opts.daysLeft} días`} (${fecha}).`,
      opts.autoRenew
        ? `Con la renovación automática activa, el nuevo periodo se cargará a tu método de Mercado Pago y tu plan continúa sin interrupciones.`
        : `La renovación automática está desactivada: renueva manualmente antes del vencimiento para no perder acceso.`,
      ``,
      `Equipo ${app}`,
    ].join('\n'),
  }
}

export function renewalReceiptEmail(opts: {
  planName: string
  amountMxnCents: number
  cadence: 'monthly' | 'annual'
  newPeriodEnd: Date
  appName?: string
}): { subject: string; body: string } {
  const app = opts.appName || 'Axiom'
  const fecha = opts.newPeriodEnd.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })
  const monto = `$${(opts.amountMxnCents / 100).toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN`
  return {
    subject: `${app}: renovación confirmada — ${opts.planName}`,
    body: [
      `Hola,`,
      ``,
      `Tu renovación automática se procesó correctamente.`,
      `Plan: ${opts.planName} (${opts.cadence === 'annual' ? 'anual' : 'mensual'})`,
      `Monto: ${monto}`,
      `Vigente hasta: ${fecha}`,
      ``,
      `Gracias por seguir aprendiendo con ${app}.`,
      ``,
      `Equipo ${app}`,
    ].join('\n'),
  }
}

export function renewalFailedEmail(opts: {
  planName: string
  reason?: string | null
  appName?: string
}): { subject: string; body: string } {
  const app = opts.appName || 'Axiom'
  return {
    subject: `${app}: no pudimos procesar la renovación de tu plan ${opts.planName}`,
    body: [
      `Hola,`,
      ``,
      `Intentamos renovar tu plan ${opts.planName} pero el cobro no se pudo procesar${opts.reason ? ` (${opts.reason})` : ''}.`,
      `Tu plan pasó a estado «pago pendiente». Actualiza tu método de pago o renueva manualmente desde tu panel para reactivar todos los beneficios.`,
      ``,
      `Equipo ${app}`,
    ].join('\n'),
  }
}

export function renewalLinkEmail(opts: {
  planName: string
  initPoint: string
  cadence: 'monthly' | 'annual'
  appName?: string
}): { subject: string; body: string } {
  const app = opts.appName || 'Axiom'
  return {
    subject: `${app}: renueva tu plan ${opts.planName}`,
    body: [
      `Hola,`,
      ``,
      `Tu plan ${opts.planName} (${opts.cadence === 'annual' ? 'anual' : 'mensual'}) está por vencer y completamos el pago con un enlace seguro de Mercado Pago:`,
      ``,
      opts.initPoint,
      ``,
      `Al completar el pago tu plan se extiende automáticamente.`,
      ``,
      `Equipo ${app}`,
    ].join('\n'),
  }
}
