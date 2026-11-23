// R30-a — cobro automático efectivo de la renovación + R30-b avisos de vencimiento.
// R31-b — dunning: reintento de cobros fallidos con backoff (RENEWAL_RETRY_SCHEDULE_DAYS).
// runRenewalCycle() es el «motor de facturación» que un scheduler (cron) invoca:
//
//   1. RENOVACIONES: suscripciones active/trialing con autoRenew=true cuyo periodo
//      ya venció. En desarrollo (sin token de Mercado Pago) el cobro se procesa por
//      el stub del webhook y la suscripción se extiende; en producción con token,
//      si la suscripción viene de una preaprobación de MP se deja que MP la renueve,
//      y en caso contrario se genera un enlace de pago y se envía por correo.
//   2. DUNNING (R31-b): un cobro fallido ya no deja la suscripción en «pago pendiente»
//      definitiva: se agenda un reintento con backoff (2, 5 y 10 días tras el intento
//      anterior). Agotado el calendario, la suscripción queda past_due terminal (sin
//      más reintentos automáticos) hasta pago manual, enlace de pago o cancelación.
//   3. AVISOS (R30-b): suscripciones vigentes dentro de la ventana de recordatorio
//      (≤14 días) reciben el aviso por correo según su nivel (info/warning/critical);
//      las vencidas sin renovación automática pasan a «pago pendiente» y reciben el
//      aviso de vencimiento.
//
// Idempotencia: los correos llevan dedupeKey única (nivel + suscripción + periodo),
// así el ciclo puede correr repetidas veces sin duplicar avisos ni cobros (los
// cobros sólo aplican a suscripciones vencidas; tras cobrarse dejan de estarlo).
import { db } from '@/lib/db'
import { logger, audit } from '@/lib/observability'
import { processPaymentWebhook as defaultProcessPaymentWebhook, createPaymentPreference } from './index'

// R31-b — tipo del procesador de cobro: inyectable para pruebas de dunning
// (producción usa el webhook real; los tests pasan un stub determinista).
type ChargeWebhook = typeof defaultProcessPaymentWebhook
import { ANNUAL_ANCHORS, PLAN_CONFIG, computeRenewalNotice } from './plans'
import { type PlanCode } from '@/lib/types'
import { sendEmail, renewalNoticeEmail, renewalReceiptEmail, renewalFailedEmail, renewalLinkEmail } from '@/lib/notifications/email'

const DAY_MS = 24 * 60 * 60 * 1000

// Gracia máxima para intentar el cobro de una suscripción vencida: si el ciclo no
// ha podido correr durante más tiempo, se marca «pago pendiente» sin intentar cobro.
export const RENEWAL_GRACE_DAYS = 90

// R31-b — calendario de reintentos (días transcurridos desde el intento anterior):
// 1er reintento a los 2 días, 2º a los 5 y 3º a los 10. Si el tercer reintento
// también falla, el dunning se da por agotado (past_due terminal).
export const RENEWAL_RETRY_SCHEDULE_DAYS = [2, 5, 10]

// Forma mínima de la suscripción (resultado Prisma con include plan/user) que
// consumen los helpers de cobro y dunning.
interface RenewalSub {
  id: string
  userId: string
  renewalRetryCount: number
  currentPeriodEnd: Date
  plan: { code: string; name: string }
  user: { email: string }
}

export interface RenewalCycleResult {
  scannedRenewals: number   // suscripciones vencidas con autoRenew evaluadas para cobro
  charged: number           // cobros procesados (modo dev / stub)
  linksSent: number         // enlaces de pago enviados por correo (modo real sin método guardado)
  failed: number            // cobros fallidos → dunning programado o past_due terminal
  lapsed: number            // vencidas sin autoRenew → past_due + aviso
  skipped: number           // omitidas (preaprobación MP gestiona su propia renovación)
  noticesSent: number       // avisos de vencimiento nuevos enviados
  noticeDuplicates: number  // avisos ya enviados antes (dedupe) — no se reenvían
  retriesExecuted: number   // R31-b — reintentos de dunning ejecutados en este ciclo
  retriesScheduled: number  // R31-b — reintentos agendados en este ciclo (cobro fallido → próximo intento)
  dunningExhausted: number  // R31-b — suscripciones que agotaron el calendario de reintentos
}

function renewalAmount(planCode: PlanCode, cadence: 'monthly' | 'annual'): number {
  return cadence === 'annual' ? ANNUAL_ANCHORS[planCode] : PLAN_CONFIG[planCode].priceMxnCents
}

type ChargeOutcome = 'charged' | 'link_sent' | 'failed'

// R31-b — intento de cobro de una suscripción vencida (primer intento o reintento
// de dunning). En éxito limpia el estado de dunning; el fallo lo registra el
// llamador vía registerChargeFailure().
async function attemptRenewalCharge(opts: {
  sub: RenewalSub
  planCode: PlanCode
  cadence: 'monthly' | 'annual'
  now: Date
  chargeWebhook?: ChargeWebhook
}): Promise<ChargeOutcome> {
  const { sub, planCode, cadence, now } = opts
  const processPaymentWebhook = opts.chargeWebhook ?? defaultProcessPaymentWebhook
  const amount = renewalAmount(planCode, cadence)
  const payment = await db.payment.create({
    data: {
      userId: sub.userId,
      subscriptionId: sub.id,
      amountMxnCents: amount,
      amountUsdCents: Math.ceil(amount / 17.2),
      currency: 'MXN',
      cadence,
      provider: 'mercado_pago',
      status: 'pending',
    },
  })

  // Modo desarrollo (sin token MP): el cobro se procesa por el stub del webhook,
  // que extiende la suscripción (R29-a/R30-c: ancla al periodo correcto).
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN) {
    const processed = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    if (processed.ok) {
      // R31-b — cobro logrado: reinicia el contador de reintentos.
      await db.subscription.update({ where: { id: sub.id }, data: { renewalRetryCount: 0, nextRetryAt: null } })
      const renewed = await db.subscription.findUnique({ where: { id: sub.id } })
      logger.info('billing.renewal_charged', {
        payment_id: payment.id, user_id: sub.userId, subscription_id: sub.id, cadence, amount,
      })
      await audit('billing.renewal_charged', {
        userId: sub.userId,
        resourceType: 'payment',
        resourceId: payment.id,
        metadata: { amountMxnCents: amount, cadence, autoRenewal: true, subscriptionId: sub.id },
      })
      await sendEmail({
        to: sub.user.email,
        userId: sub.userId,
        ...renewalReceiptEmail({
          planName: sub.plan.name,
          amountMxnCents: amount,
          cadence,
          newPeriodEnd: renewed?.currentPeriodEnd ?? now,
        }),
        kind: 'renewal_receipt',
        dedupeKey: `renewal_receipt:${payment.id}`,
        relatedType: 'payment',
        relatedId: payment.id,
      })
      return 'charged'
    }
    await db.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: 'webhook_rejected' } })
    return 'failed'
  }

  // Modo real (token MP): sin método de pago guardado en el MVP se genera un
  // enlace de cobro y se envía por correo (R30-b); al completarlo el webhook
  // existente extiende la suscripción.
  const pref = await createPaymentPreference({ userId: sub.userId, planCode, cadence })
  if (pref.ok) {
    logger.info('billing.renewal_link_sent', { payment_id: payment.id, user_id: sub.userId, cadence })
    await audit('billing.renewal_link_sent', {
      userId: sub.userId,
      resourceType: 'payment',
      resourceId: payment.id,
      metadata: { cadence, amountMxnCents: amount },
    })
    await sendEmail({
      to: sub.user.email,
      userId: sub.userId,
      ...renewalLinkEmail({ planName: sub.plan.name, initPoint: pref.initPoint, cadence }),
      kind: 'renewal_link',
      dedupeKey: `renewal_link:${payment.id}`,
      relatedType: 'payment',
      relatedId: payment.id,
    })
    return 'link_sent'
  }

  await db.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: pref.error } })
  return 'failed'
}

// R31-b — registra el fallo de un intento de cobro: agenda el siguiente reintento
// según el calendario de backoff o, si el calendario se agotó, deja la suscripción
// en past_due terminal (sin nextRetryAt) y lo audita. En ambos casos avisa por correo.
async function registerChargeFailure(opts: {
  sub: RenewalSub
  reason: string
  now: Date
}): Promise<{ scheduled: boolean }> {
  const attempt = opts.sub.renewalRetryCount + 1

  if (attempt <= RENEWAL_RETRY_SCHEDULE_DAYS.length) {
    const inDays = RENEWAL_RETRY_SCHEDULE_DAYS[attempt - 1]
    const nextRetryAt = new Date(opts.now.getTime() + inDays * DAY_MS)
    await db.subscription.update({
      where: { id: opts.sub.id },
      data: { status: 'past_due', renewalRetryCount: attempt, nextRetryAt },
    })
    logger.info('billing.renewal_retry_scheduled', {
      subscription_id: opts.sub.id, user_id: opts.sub.userId, attempt, next_retry_at: nextRetryAt.toISOString(),
    })
    await audit('billing.renewal_retry_scheduled', {
      userId: opts.sub.userId,
      resourceType: 'subscription',
      resourceId: opts.sub.id,
      metadata: { attempt, nextRetryAt: nextRetryAt.toISOString(), reason: opts.reason },
    })
    const tpl = renewalFailedEmail({
      planName: opts.sub.plan.name,
      reason: `el cobro fue rechazado (${opts.reason}); lo reintentaremos automáticamente el ${nextRetryAt.toISOString().slice(0, 10)} (intento ${attempt} de ${RENEWAL_RETRY_SCHEDULE_DAYS.length})`,
    })
    await sendEmail({
      to: opts.sub.user.email,
      userId: opts.sub.userId,
      ...tpl,
      kind: 'renewal_failed',
      dedupeKey: `renewal_failed:retry${attempt}:${opts.sub.id}:${opts.now.toISOString().slice(0, 10)}`,
      relatedType: 'subscription',
      relatedId: opts.sub.id,
    })
    return { scheduled: true }
  }

  // Calendario agotado: past_due terminal — no hay más reintentos automáticos.
  await db.subscription.update({
    where: { id: opts.sub.id },
    data: { status: 'past_due', nextRetryAt: null },
  })
  logger.warn('billing.renewal_dunning_exhausted', {
    subscription_id: opts.sub.id, user_id: opts.sub.userId, attempts: attempt - 1,
  })
  await audit('billing.renewal_dunning_exhausted', {
    userId: opts.sub.userId,
    resourceType: 'subscription',
    resourceId: opts.sub.id,
    metadata: { attempts: attempt - 1, reason: opts.reason },
  })
  const tpl = renewalFailedEmail({
    planName: opts.sub.plan.name,
    reason: 'agotamos los reintentos automáticos de pago; tu suscripción sigue en «pago pendiente» hasta que completes el pago o canceles',
  })
  await sendEmail({
    to: opts.sub.user.email,
    userId: opts.sub.userId,
    ...tpl,
    kind: 'renewal_failed',
    dedupeKey: `renewal_failed:exhausted:${opts.sub.id}:${opts.sub.currentPeriodEnd.toISOString().slice(0, 10)}`,
    relatedType: 'subscription',
    relatedId: opts.sub.id,
  })
  return { scheduled: false }
}

export async function runRenewalCycle(opts?: {
  now?: Date
  chargeWebhook?: ChargeWebhook // R31-b: inyección para pruebas (no se usa en producción)
}): Promise<RenewalCycleResult> {
  const now = opts?.now ?? new Date()
  const chargeWebhook = opts?.chargeWebhook
  const result: RenewalCycleResult = {
    scannedRenewals: 0, charged: 0, linksSent: 0, failed: 0,
    lapsed: 0, skipped: 0, noticesSent: 0, noticeDuplicates: 0,
    retriesExecuted: 0, retriesScheduled: 0, dunningExhausted: 0,
  }

  logger.info('billing.renewal_cycle_started', { now: now.toISOString() })

  // ——— 1. RENOVACIONES: vencidas con autoRenew (primer intento) ———
  const dueSubs = await db.subscription.findMany({
    where: {
      status: { in: ['active', 'trialing'] },
      autoRenew: true,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { lte: now },
      // R31-b — una suscripción con reintento agendado a futuro no se intenta aquí;
      // la retoma el bloque de dunning cuando llega la fecha del reintento.
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
    },
    include: { plan: true, user: true },
  })

  for (const sub of dueSubs) {
    result.scannedRenewals++
    const planCode = sub.plan.code as PlanCode
    const cadence = sub.cadence === 'annual' ? 'annual' : 'monthly'
    const expiredDays = Math.floor((now.getTime() - sub.currentPeriodEnd.getTime()) / DAY_MS)

    // Preaprobación de Mercado Pago: la renovación la gestiona MP directamente.
    if (sub.mercadoPagoSubscriptionId) {
      result.skipped++
      logger.info('billing.renewal_skipped_mp_preapproval', { subscription_id: sub.id, user_id: sub.userId })
      continue
    }

    // Vencida hace demasiado: no intentamos cobro, pasamos a «pago pendiente» terminal.
    if (expiredDays > RENEWAL_GRACE_DAYS) {
      result.failed++
      await db.subscription.update({ where: { id: sub.id }, data: { status: 'past_due', nextRetryAt: null } })
      await sendEmail({
        to: sub.user.email,
        userId: sub.userId,
        subject: renewalFailedEmail({ planName: sub.plan.name, reason: 'periodo vencido hace demasiado' }).subject,
        body: renewalFailedEmail({ planName: sub.plan.name, reason: 'periodo vencido hace demasiado' }).body,
        kind: 'renewal_failed',
        dedupeKey: `renewal_failed:grace:${sub.id}:${sub.currentPeriodEnd.toISOString().slice(0, 10)}`,
        relatedType: 'subscription',
        relatedId: sub.id,
      })
      await audit('billing.renewal_failed', {
        userId: sub.userId,
        resourceType: 'subscription',
        resourceId: sub.id,
        metadata: { reason: 'grace_exceeded', expiredDays },
      })
      continue
    }

    // R31-b — primer intento de cobro; si falla, se agenda el reintento con backoff
    // en lugar de dejar la suscripción en past_due definitiva.
    const outcome = await attemptRenewalCharge({ sub, planCode, cadence, now, chargeWebhook })
    if (outcome === 'charged') { result.charged++; continue }
    if (outcome === 'link_sent') { result.linksSent++; continue }
    result.failed++
    const reg = await registerChargeFailure({ sub, reason: 'el cobro fue rechazado', now })
    if (reg.scheduled) result.retriesScheduled++
    else result.dunningExhausted++
  }

  // ——— 2. DUNNING (R31-b): reintentos con backoff de cobros fallidos ———
  // Suscripciones past_due con reintento agendado que ya venció: se intenta cobrar
  // de nuevo; el fallo reagenda o agota el calendario.
  const retrySubs = await db.subscription.findMany({
    where: {
      status: 'past_due',
      autoRenew: true,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { lte: now },
      nextRetryAt: { not: null, lte: now },
    },
    include: { plan: true, user: true },
  })

  for (const sub of retrySubs) {
    const planCode = sub.plan.code as PlanCode
    const cadence = sub.cadence === 'annual' ? 'annual' : 'monthly'
    const expiredDays = Math.floor((now.getTime() - sub.currentPeriodEnd.getTime()) / DAY_MS)

    // Preaprobación MP: no debe existir dunning manual; se limpia por seguridad.
    if (sub.mercadoPagoSubscriptionId) {
      result.skipped++
      await db.subscription.update({ where: { id: sub.id }, data: { nextRetryAt: null } })
      logger.info('billing.renewal_skipped_mp_preapproval', { subscription_id: sub.id, user_id: sub.userId, scope: 'dunning' })
      continue
    }

    // Fuera de la ventana de gracia: se corta el dunning sin más intentos.
    if (expiredDays > RENEWAL_GRACE_DAYS) {
      result.dunningExhausted++
      await db.subscription.update({ where: { id: sub.id }, data: { nextRetryAt: null } })
      await audit('billing.renewal_dunning_exhausted', {
        userId: sub.userId,
        resourceType: 'subscription',
        resourceId: sub.id,
        metadata: { reason: 'grace_exceeded', expiredDays },
      })
      continue
    }

    result.retriesExecuted++
    const outcome = await attemptRenewalCharge({ sub, planCode, cadence, now, chargeWebhook })
    if (outcome === 'charged') { result.charged++; continue }
    if (outcome === 'link_sent') { result.linksSent++; continue }
    result.failed++
    const reg = await registerChargeFailure({ sub, reason: 'el reintento fue rechazado', now })
    if (reg.scheduled) result.retriesScheduled++
    else result.dunningExhausted++
  }

  // ——— 3. VENCIDAS SIN autoRenew → «pago pendiente» + aviso ———
  const lapsedCandidates = await db.subscription.findMany({
    where: {
      status: { in: ['active', 'trialing'] },
      currentPeriodEnd: { lte: now },
    },
    include: { plan: true, user: true },
  })
  for (const sub of lapsedCandidates) {
    if (sub.autoRenew && !sub.cancelAtPeriodEnd) continue // ya gestionada arriba (cobro)
    result.lapsed++
    await db.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } })
    const notice = renewalNoticeEmail({
      planName: sub.plan.name,
      daysLeft: 0,
      level: 'expired',
      autoRenew: false,
      periodEnd: sub.currentPeriodEnd,
    })
    const sent = await sendEmail({
      to: sub.user.email,
      userId: sub.userId,
      ...notice,
      kind: 'renewal_notice',
      dedupeKey: `renewal_notice:expired:${sub.id}:${sub.currentPeriodEnd.toISOString().slice(0, 10)}`,
      relatedType: 'subscription',
      relatedId: sub.id,
    })
    if (!sent.ok) {
      logger.error('billing.renewal_notice_error', { subscription_id: sub.id, error: sent.error })
    } else if (sent.duplicate) {
      result.noticeDuplicates++
    } else {
      result.noticesSent++
    }
    await audit('billing.renewal_lapsed', {
      userId: sub.userId,
      resourceType: 'subscription',
      resourceId: sub.id,
      metadata: { expiredDays: Math.floor((now.getTime() - sub.currentPeriodEnd.getTime()) / DAY_MS) },
    })
  }

  // ——— 4. AVISOS de vencimiento (R30-b): vigentes dentro de la ventana ≤14 días ———
  const windowStart = now
  const windowEnd = new Date(now.getTime() + 14 * DAY_MS)
  const upcoming = await db.subscription.findMany({
    where: {
      status: { in: ['active', 'trialing'] },
      currentPeriodEnd: { gt: windowStart, lte: windowEnd },
    },
    include: { plan: true, user: true },
  })
  for (const sub of upcoming) {
    const notice = computeRenewalNotice({ currentPeriodEnd: sub.currentPeriodEnd, status: sub.status, now })
    if (notice.level === 'none' || notice.level === 'expired') continue
    const tpl = renewalNoticeEmail({
      planName: sub.plan.name,
      daysLeft: notice.daysLeft,
      level: notice.level,
      autoRenew: sub.autoRenew && !sub.cancelAtPeriodEnd,
      periodEnd: sub.currentPeriodEnd,
    })
    const sent = await sendEmail({
      to: sub.user.email,
      userId: sub.userId,
      ...tpl,
      kind: 'renewal_notice',
      dedupeKey: `renewal_notice:${notice.level}:${sub.id}:${sub.currentPeriodEnd.toISOString().slice(0, 10)}`,
      relatedType: 'subscription',
      relatedId: sub.id,
    })
    if (!sent.ok) {
      logger.error('billing.renewal_notice_error', { subscription_id: sub.id, level: notice.level, error: sent.error })
    } else if (sent.duplicate) {
      result.noticeDuplicates++
    } else {
      result.noticesSent++
      logger.info('billing.renewal_notice_sent', {
        subscription_id: sub.id, user_id: sub.userId, level: notice.level, days_left: notice.daysLeft,
      })
      await audit('billing.renewal_notice_sent', {
        userId: sub.userId,
        resourceType: 'subscription',
        resourceId: sub.id,
        metadata: { level: notice.level, daysLeft: notice.daysLeft, autoRenew: sub.autoRenew },
      })
    }
  }

  logger.info('billing.renewal_cycle_finished', { ...result })
  return result
}
