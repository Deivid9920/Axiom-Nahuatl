// AXIOM — Billing (Mercado Pago integration)

import { db } from '@/lib/db'
import { logger, audit } from '@/lib/observability'
import { events } from '@/lib/events'
import { type PlanCode } from '@/lib/types'

// R24: configuración de planes + resolución de cadence viven en ./plans (módulo puro, testeable)
// R28: computeAnnualBonusDays añade la proration mensual→anual (días restantes del ciclo mensual)
// R29: computeRenewalAnchor ancla la renovación anual al fin del periodo vigente;
//      computeRenewalNotice alimenta los recordatorios de vencimiento (R29-c)
// R30: computeRenewalAnchor generalizada (también renovación mensual al fin de periodo,
//      con guard por plan); ./renewal añade el ciclo de cobro automático + avisos (R30-a/b)
export { PLAN_CONFIG, ANNUAL_ANCHORS, resolvePlanAndCadence, computeAnnualBonusDays, ANNUAL_BONUS_CAP_DAYS, computeRenewalAnchor, computeRenewalNotice, RENEWAL_NOTICE_THRESHOLDS } from './plans'
export { runRenewalCycle, RENEWAL_GRACE_DAYS } from './renewal'
export type { RenewalCycleResult } from './renewal'
import { PLAN_CONFIG, resolvePlanAndCadence, computeAnnualBonusDays, computeRenewalAnchor } from './plans'

const DAY_MS = 24 * 60 * 60 * 1000

// Seed plans into DB
export async function seedPlans() {
  for (const [code, config] of Object.entries(PLAN_CONFIG)) {
    await db.plan.upsert({
      where: { code },
      create: {
        code,
        name: config.name,
        priceMxn: config.priceMxnCents,
        priceUsdCents: config.priceUsdCents,
        maxSessionsPerMonth: config.features.maxSessionsPerMonth,
        maxDocuments: config.features.maxDocuments,
        ragEnabled: config.features.ragEnabled,
        voiceEnabled: config.features.voiceEnabled,
        teamEnabled: config.features.teamEnabled,
        adminEnabled: config.features.adminEnabled,
        prioritySupport: config.features.prioritySupport,
        featuresJson: JSON.stringify(config.features),
      },
      update: {
        name: config.name,
        priceMxn: config.priceMxnCents,
        priceUsdCents: config.priceUsdCents,
        maxSessionsPerMonth: config.features.maxSessionsPerMonth,
        maxDocuments: config.features.maxDocuments,
        ragEnabled: config.features.ragEnabled,
        voiceEnabled: config.features.voiceEnabled,
        teamEnabled: config.features.teamEnabled,
        adminEnabled: config.features.adminEnabled,
        prioritySupport: config.features.prioritySupport,
        featuresJson: JSON.stringify(config.features),
      },
    })
  }
  logger.info('billing.plans_seeded', { count: Object.keys(PLAN_CONFIG).length })
}

// Get user's active subscription
export async function getUserSubscription(userId: string) {
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  })
  return sub
}

export async function getEffectivePlan(userId: string) {
  const sub = await getUserSubscription(userId)
  if (!sub) {
    // Default to Básico with 0 features (essentially locked)
    return {
      planCode: 'basico' as PlanCode,
      features: PLAN_CONFIG.basico.features,
      subscription: null,
    }
  }
  return {
    planCode: sub.plan.code as PlanCode,
    features: PLAN_CONFIG[sub.plan.code as PlanCode].features,
    subscription: sub,
  }
}

// Plan gating helpers
export async function checkFeatureAccess(userId: string, feature: keyof typeof PLAN_CONFIG.pro.features): Promise<{ allowed: boolean; reason?: string }> {
  const { features, subscription } = await getEffectivePlan(userId)
  if (!features[feature]) {
    return { allowed: false, reason: `Tu plan actual no incluye esta función. Mejora a Pro para acceso completo.` }
  }
  if (subscription?.status === 'trialing' && subscription.currentPeriodEnd < new Date()) {
    return { allowed: false, reason: 'Tu período de prueba ha expirado.' }
  }
  return { allowed: true }
}

export async function checkSessionLimit(userId: string): Promise<{ allowed: boolean; reason?: string; used: number; max: number }> {
  const { features } = await getEffectivePlan(userId)
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const used = await db.learningSession.count({
    where: {
      userId,
      startedAt: { gt: startOfMonth },
    },
  })

  if (used >= features.maxSessionsPerMonth) {
    return {
      allowed: false,
      reason: `Has alcanzado el límite de ${features.maxSessionsPerMonth} sesiones este mes.`,
      used,
      max: features.maxSessionsPerMonth,
    }
  }
  return { allowed: true, used, max: features.maxSessionsPerMonth }
}

// Mercado Pago integration (sandbox)
const MP_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN
const MP_API_BASE = 'https://api.mercadopago.com'

export async function createPaymentPreference(opts: {
  userId: string
  planCode: PlanCode
  cadence: 'monthly' | 'annual'
}): Promise<{ ok: true; preferenceId: string; initPoint: string; sandboxInitPoint: string } | { ok: false; error: string }> {
  const config = PLAN_CONFIG[opts.planCode]
  const amount = opts.cadence === 'annual' ? config.priceMxnCents * 10 : config.priceMxnCents  // 2 months free on annual

  // Create pending payment record (R24: cadence persistida — el webhook la lee para fijar periodo y suscripción)
  const payment = await db.payment.create({
    data: {
      userId: opts.userId,
      amountMxnCents: amount,
      amountUsdCents: Math.ceil(amount / 17.2),
      currency: 'MXN',
      cadence: opts.cadence,
      provider: 'mercado_pago',
      status: 'pending',
    },
  })

  // If no MP token, return dev-mode stub
  if (!MP_ACCESS_TOKEN) {
    logger.warn('billing.mp_no_token_dev_mode', { user_id: opts.userId, payment_id: payment.id })
    // Return a fake preference pointing to the dev webhook (R24: la ruta /api/billing/dev-success
    // no existe — el webhook expone GET ?paymentId= en modo dev para procesar el pago)
    return {
      ok: true,
      preferenceId: `dev_pref_${payment.id}`,
      initPoint: `/api/billing/webhook?paymentId=${payment.id}`,
      sandboxInitPoint: `/api/billing/webhook?paymentId=${payment.id}`,
    }
  }

  // Real MP API call
  try {
    const response = await fetch(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [{
          id: opts.planCode,
          title: `Axiom ${config.name} (${opts.cadence === 'annual' ? 'Anual' : 'Mensual'})`,
          description: `Suscripción Axiom ${config.name}`,
          quantity: 1,
          currency_id: 'MXN',
          unit_price: amount / 100,
        }],
        payer: { email: (await db.user.findUnique({ where: { id: opts.userId } }))?.email },
        back_urls: {
          success: `${process.env.PUBLIC_URL || ''}/api/billing/success`,
          pending: `${process.env.PUBLIC_URL || ''}/api/billing/pending`,
          failure: `${process.env.PUBLIC_URL || ''}/api/billing/failure`,
        },
        auto_return: 'approved',
        notification_url: `${process.env.PUBLIC_URL || ''}/api/billing/webhook`,
        external_reference: payment.id,
        metadata: { paymentId: payment.id, userId: opts.userId, planCode: opts.planCode },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error('billing.mp_create_failed', { payment_id: payment.id, status: response.status, body: text })
      return { ok: false, error: `MP API error: ${response.status}` }
    }

    const data = await response.json()
    await db.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: data.id },
    })

    return {
      ok: true,
      preferenceId: data.id,
      initPoint: data.init_point,
      sandboxInitPoint: data.sandbox_init_point,
    }
  } catch (error) {
    logger.error('billing.mp_exception', { payment_id: payment.id, error: (error as Error).message }, error as Error)
    return { ok: false, error: (error as Error).message }
  }
}

// Webhook handler — process MP payment notification
export async function processPaymentWebhook(opts: {
  paymentId: string  // our internal Payment.id (from external_reference)
  providerPaymentId?: string  // MP's payment ID
  status: 'succeeded' | 'failed'
  failureReason?: string
}): Promise<{ ok: boolean; subscriptionId?: string }> {
  const payment = await db.payment.findUnique({
    where: { id: opts.paymentId },
    include: { subscription: true },
  })
  if (!payment) {
    logger.warn('billing.webhook_payment_not_found', { payment_id: opts.paymentId })
    return { ok: false }
  }

  await db.payment.update({
    where: { id: payment.id },
    data: {
      status: opts.status,
      failureReason: opts.failureReason,
      providerPaymentId: opts.providerPaymentId || payment.providerPaymentId,
      webhookReceivedAt: new Date(),
      processedAt: new Date(),
    },
  })

  if (opts.status === 'succeeded') {
    // R24 — resolver plan + cadence (persistida o inferida del monto; amount anual = mensual × 10)
    const resolved = resolvePlanAndCadence(payment.amountMxnCents, payment.cadence)
    const cadence = resolved?.cadence ?? 'monthly'

    // R28 — proration mensual→anual: si el pago anual reemplaza una suscripción
    // mensual todavía activa, los días restantes de su ciclo se suman al nuevo
    // periodo anual (hasta 31 días de crédito). En renovación anual no hay crédito.
    let previous = payment.subscription
    if (!previous && cadence === 'annual') {
      previous = await db.subscription.findFirst({
        where: { userId: payment.userId, status: { in: ['active', 'trialing'] }, cadence: 'monthly' },
        orderBy: { createdAt: 'desc' },
      })
    }

    // R29-a/R30-c — candidato a extender es la suscripción ligada al pago o, si no
    // hay, la suscripción activa más reciente del usuario con la MISMA cadence del
    // pago. Sólo cuenta como renovación si es de la misma cadence, del MISMO plan y
    // sigue vigente (fin en el futuro): el pago extiende esa fila en lugar de
    // duplicar una suscripción activa con inicio hoy (válido para anual y mensual).
    let renewalTarget = payment.subscription
    if (!renewalTarget) {
      renewalTarget = await db.subscription.findFirst({
        where: { userId: payment.userId, status: { in: ['active', 'trialing'] }, cadence },
        orderBy: { createdAt: 'desc' },
      })
    }

    // Plan resuelto (R24) o respaldo legacy por monto exacto — necesario antes de
    // decidir si el pago es una renovación del mismo plan (R29-a).
    const plan = resolved
      ? await db.plan.findUnique({ where: { code: resolved.planCode } })
      : await db.plan.findFirst({ where: { priceMxn: payment.amountMxnCents } })
    if (!plan) {
      logger.error('billing.plan_not_found_for_amount', { payment_id: payment.id, amount: payment.amountMxnCents, cadence })
      return { ok: false }
    }

    // R29-a/R30-c — renovación del mismo plan (anual o mensual): vigente + misma
    // cadence + mismo plan ⇒ se EXTIENDE la fila en lugar de duplicar suscripciones.
    const samePlanRenewal = !!renewalTarget
      && renewalTarget.cadence === cadence
      && renewalTarget.planId === plan.id
      && renewalTarget.currentPeriodEnd.getTime() > Date.now()

    const bonusDays = cadence === 'annual' && !samePlanRenewal
      ? computeAnnualBonusDays({ previousPeriodEnd: previous?.currentPeriodEnd, previousCadence: previous?.cadence })
      : 0
    const periodDays = (cadence === 'annual' ? 365 : 30) + bonusDays

    // R29-a/R30-c — ancla del periodo: fin vigente en renovación del mismo plan
    // (anual o mensual), ahora en cualquier otro caso. computeRenewalAnchor cubre
    // además el guard por plan (upgrade con la misma cadence = alta nueva, sin días gratis).
    const anchor = samePlanRenewal && renewalTarget
      ? renewalTarget.currentPeriodEnd
      : computeRenewalAnchor({
          cadence,
          currentPeriodEnd: payment.subscription?.currentPeriodEnd,
          currentCadence: payment.subscription?.cadence,
          currentPlanId: payment.subscription?.planId,
          newPlanId: plan.id,
        })
    const newPeriodEnd = new Date(anchor.getTime() + periodDays * DAY_MS)

    let subscription
    if (samePlanRenewal && renewalTarget) {
      // R29-a/R30-c — renovación del mismo plan: se EXTIENDE la suscripción vigente
      // (fin nuevo = fin vigente + periodo) sin crear una fila duplicada activa hoy.
      subscription = await db.subscription.update({
        where: { id: renewalTarget.id },
        data: {
          status: 'active',
          cadence,
          currentPeriodStart: renewalTarget.currentPeriodEnd,
          currentPeriodEnd: newPeriodEnd,
        },
      })
      logger.info('billing.renewal_extended', {
        payment_id: payment.id,
        user_id: payment.userId,
        subscription_id: subscription.id,
        cadence,
        new_period_end: newPeriodEnd.toISOString(),
      })
    } else if (payment.subscription) {
      // Extend existing subscription (R24: el periodo respeta la cadence y se actualiza si cambió;
      // R28: + días de proration; R29/R30: ancla al fin vigente en renovación del mismo plan,
      // con guard por plan para que un upgrade no regale días del periodo anterior)
      subscription = await db.subscription.update({
        where: { id: payment.subscription.id },
        data: {
          status: 'active',
          cadence,
          currentPeriodStart: anchor,
          currentPeriodEnd: newPeriodEnd,
        },
      })
    } else {
      // Create a new subscription (for fresh upgrade)
      subscription = await db.subscription.create({
        data: {
          userId: payment.userId,
          planId: plan.id,
          status: 'active',
          cadence,
          currentPeriodStart: anchor,
          currentPeriodEnd: newPeriodEnd,
        },
      })
    }

    if (bonusDays > 0) {
      logger.info('billing.proration_applied', { payment_id: payment.id, user_id: payment.userId, bonus_days: bonusDays })
    }

    await events.publish({
      name: 'PAYMENT_SUCCEEDED',
      producer: 'billing',
      producerUserId: payment.userId,
      payload: {
        userId: payment.userId,
        paymentId: payment.id,
        amountMxnCents: payment.amountMxnCents,
        planCode: (await db.plan.findUnique({ where: { id: subscription.planId } }))?.code,
      },
    })

    await audit('payment.succeeded', {
      userId: payment.userId,
      resourceType: 'payment',
      resourceId: payment.id,
      metadata: { amountMxnCents: payment.amountMxnCents, cadence, prorationBonusDays: bonusDays, samePlanRenewalExtended: samePlanRenewal },
    })

    return { ok: true, subscriptionId: subscription.id }
  } else {
    await events.publish({
      name: 'PAYMENT_FAILED',
      producer: 'billing',
      producerUserId: payment.userId,
      payload: {
        userId: payment.userId,
        paymentId: payment.id,
        reason: opts.failureReason || 'unknown',
      },
    })

    await audit('payment.failed', {
      userId: payment.userId,
      resourceType: 'payment',
      resourceId: payment.id,
      metadata: { reason: opts.failureReason },
    })

    return { ok: true }
  }
}

// R31-c — alta de preaprobaciones de Mercado Pago desde la app («cobro automático»).
// Una preaprobación es la suscripción recurrente nativa de MP: el usuario autoriza
// una vez desde el init_point y MP cobra cada periodo por sí mismo. En desarrollo
// (sin token) el alta se simula con el flujo dev del webhook de pagos.
export async function createPreapproval(opts: {
  userId: string
  planCode: PlanCode
  cadence: 'monthly' | 'annual'
}): Promise<{ ok: true; preapprovalId?: string; initPoint: string; dev: boolean } | { ok: false; error: string }> {
  const config = PLAN_CONFIG[opts.planCode]
  const amount = opts.cadence === 'annual' ? config.priceMxnCents * 10 : config.priceMxnCents  // 2 meses gratis en anual

  const payment = await db.payment.create({
    data: {
      userId: opts.userId,
      amountMxnCents: amount,
      amountUsdCents: Math.ceil(amount / 17.2),
      currency: 'MXN',
      cadence: opts.cadence,
      provider: 'mercado_pago',
      status: 'pending',
    },
  })

  if (!MP_ACCESS_TOKEN) {
    logger.warn('billing.mp_preapproval_dev_mode', { user_id: opts.userId, payment_id: payment.id })
    const devInitPoint = `/api/billing/webhook?dev=1&paymentId=${payment.id}`
    return { ok: true, initPoint: devInitPoint, dev: true }
  }

  try {
    const user = await db.user.findUnique({ where: { id: opts.userId } })
    const response = await fetch(`${MP_API_BASE}/preapproval`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: `Axiom ${config.name} (${opts.cadence === 'annual' ? 'Anual' : 'Mensual'})`,
        auto_recurring: {
          frequency: 1,
          frequency_type: opts.cadence === 'annual' ? 'years' : 'months',
          transaction_amount: amount / 100,
          currency_id: 'MXN',
        },
        payer_email: user?.email,
        back_url: `${process.env.PUBLIC_URL || ''}/`,
        external_reference: payment.id,
        notification_url: `${process.env.PUBLIC_URL || ''}/api/billing/webhook`,
        metadata: { paymentId: payment.id, userId: opts.userId, planCode: opts.planCode },
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      logger.error('billing.mp_preapproval_create_failed', { payment_id: payment.id, status: response.status, body: text })
      await db.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: `MP preapproval API error: ${response.status}` } })
      return { ok: false, error: `MP API error: ${response.status}` }
    }

    const data = await response.json()
    await db.payment.update({ where: { id: payment.id }, data: { providerPaymentId: data.id } })
    logger.info('billing.preapproval_created', {
      payment_id: payment.id, user_id: opts.userId, preapproval_id: data.id, cadence: opts.cadence,
    })
    await audit('billing.preapproval_created', {
      userId: opts.userId,
      resourceType: 'payment',
      resourceId: payment.id,
      metadata: { preapprovalId: data.id, planCode: opts.planCode, cadence: opts.cadence },
    })
    return { ok: true, preapprovalId: data.id, initPoint: data.init_point, dev: false }
  } catch (error) {
    logger.error('billing.mp_preapproval_exception', { payment_id: payment.id, error: (error as Error).message }, error as Error)
    return { ok: false, error: (error as Error).message }
  }
}

// R31-c — procesa la notificación de preaprobación (webhook topic=preapproval):
//  · authorized  → vincula el ID de MP a la suscripción del usuario (el ciclo de
//    renovación deja de cobrarla: la renueva MP directamente) y la deja activa.
//  · cancelled/paused → marca la suscripción cancelada sin renovación automática.
// Sin token (dev) no hay nada que consultar: la alta simulada ya activa la
// suscripción por el flujo del webhook de pagos.
export async function processPreapprovalWebhook(opts: { preapprovalId: string }): Promise<{ ok: boolean; action?: string }> {
  if (!MP_ACCESS_TOKEN) {
    logger.info('billing.preapproval_webhook_dev_skip', { preapproval_id: opts.preapprovalId })
    return { ok: true, action: 'dev_skip' }
  }

  let pre: { id?: string; status?: string; external_reference?: string }
  try {
    const response = await fetch(`${MP_API_BASE}/preapproval/${opts.preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    })
    if (!response.ok) {
      logger.error('billing.preapproval_fetch_failed', { preapproval_id: opts.preapprovalId, status: response.status })
      return { ok: false }
    }
    pre = await response.json()
  } catch (error) {
    logger.error('billing.preapproval_fetch_exception', { preapproval_id: opts.preapprovalId, error: (error as Error).message }, error as Error)
    return { ok: false }
  }

  // Localiza el pago del alta (external_reference) para saber usuario y plan.
  const payment = pre.external_reference
    ? await db.payment.findUnique({ where: { id: pre.external_reference }, include: { subscription: true } })
    : await db.payment.findFirst({
        where: { providerPaymentId: opts.preapprovalId },
        include: { subscription: true },
        orderBy: { createdAt: 'desc' },
      })
  if (!payment) {
    logger.warn('billing.preapproval_payment_not_found', { preapproval_id: opts.preapprovalId })
    return { ok: false }
  }

  const resolved = resolvePlanAndCadence(payment.amountMxnCents, payment.cadence)
  const plan = resolved
    ? await db.plan.findUnique({ where: { code: resolved.planCode } })
    : await db.plan.findFirst({ where: { priceMxn: payment.amountMxnCents } })
  if (!plan) {
    logger.error('billing.plan_not_found_for_amount', { payment_id: payment.id, amount: payment.amountMxnCents, cadence: payment.cadence })
    return { ok: false }
  }
  const cadence = resolved?.cadence ?? 'monthly'
  const periodDays = cadence === 'annual' ? 365 : 30

  if (pre.status === 'authorized') {
    let subscription = payment.subscription
      ?? await db.subscription.findFirst({
        where: { userId: payment.userId, planId: plan.id, status: { in: ['active', 'trialing'] } },
        orderBy: { createdAt: 'desc' },
      })
    if (!subscription) {
      subscription = await db.subscription.create({
        data: {
          userId: payment.userId,
          planId: plan.id,
          status: 'active',
          cadence,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + periodDays * DAY_MS),
        },
      })
    }
    await db.subscription.update({
      where: { id: subscription.id },
      data: { mercadoPagoSubscriptionId: opts.preapprovalId, status: 'active' },
    })
    logger.info('billing.preapproval_authorized', {
      preapproval_id: opts.preapprovalId, subscription_id: subscription.id, user_id: payment.userId,
    })
    await audit('billing.preapproval_authorized', {
      userId: payment.userId,
      resourceType: 'subscription',
      resourceId: subscription.id,
      metadata: { preapprovalId: opts.preapprovalId, planCode: plan.code, cadence },
    })
    return { ok: true, action: 'authorized' }
  }

  if (pre.status === 'cancelled' || pre.status === 'paused') {
    const subscription = payment.subscription
      ?? await db.subscription.findFirst({
        where: { userId: payment.userId, mercadoPagoSubscriptionId: opts.preapprovalId },
        orderBy: { createdAt: 'desc' },
      })
    if (subscription) {
      await db.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled', autoRenew: false },
      })
      logger.info('billing.preapproval_cancelled', {
        preapproval_id: opts.preapprovalId, subscription_id: subscription.id, mp_status: pre.status,
      })
      await audit('billing.preapproval_cancelled', {
        userId: payment.userId,
        resourceType: 'subscription',
        resourceId: subscription.id,
        metadata: { preapprovalId: opts.preapprovalId, mpStatus: pre.status },
      })
    }
    return { ok: true, action: pre.status === 'cancelled' ? 'cancelled' : 'paused' }
  }

  return { ok: true, action: `ignored:${pre.status}` }
}

// R32-c — webhook de pago REAL de Mercado Pago (topic=payment con data.id):
// MP notifica el ID del pago en su plataforma; aquí se consulta la API de MP
// (GET /v1/payments/{id}) para validar estado y monto, se resuelve nuestro
// Payment por external_reference (el ID interno guardado al crear la preferencia)
// y se procesa con la MISMA lógica del webhook interno (cadence, anclas,
// proration, dunning). Idempotente: un pago ya procesado no se extiende dos veces.
// Estados de MP: approved → succeeded; rejected/cancelled/refunded/charged_back →
// failed; pending/in_process/authorized u otros → sin acción (MP re-notificará).
export async function processRealPaymentWebhook(opts: {
  providerPaymentId: string // data.id del webhook (ID del pago en MP)
  fetchFn?: typeof fetch    // inyectable para pruebas
}): Promise<{ ok: boolean; action?: string }> {
  const doFetch = opts.fetchFn ?? fetch
  // Token leído en tiempo de llamada (como en renewal.ts): permite pruebas que
  // simulan la integración real sin recargar el módulo.
  const mpToken = process.env.MERCADO_PAGO_ACCESS_TOKEN

  if (!mpToken) {
    // Sin token no se puede validar contra MP: en dev el cobro simulado entra por
    // el flujo ?paymentId= (GET del webhook) y aquí no hay nada que resolver.
    logger.info('billing.real_payment_webhook_dev_skip', { provider_payment_id: opts.providerPaymentId })
    return { ok: true, action: 'dev_skip' }
  }

  let mp: {
    id?: number | string
    status?: string
    status_detail?: string
    external_reference?: string | null
    transaction_amount?: number
  }
  try {
    const response = await doFetch(`${MP_API_BASE}/v1/payments/${opts.providerPaymentId}`, {
      headers: { 'Authorization': `Bearer ${mpToken}` },
    })
    if (!response.ok) {
      logger.error('billing.real_payment_fetch_failed', { provider_payment_id: opts.providerPaymentId, status: response.status })
      return { ok: false, action: 'mp_fetch_failed' }
    }
    mp = await response.json()
  } catch (error) {
    logger.error('billing.real_payment_fetch_exception', { provider_payment_id: opts.providerPaymentId, error: (error as Error).message }, error as Error)
    return { ok: false, action: 'mp_fetch_exception' }
  }

  const mpStatus = mp.status || ''
  const actionByStatus = (): 'succeeded' | 'failed' | null => {
    if (mpStatus === 'approved') return 'succeeded'
    if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(mpStatus)) return 'failed'
    return null // pending/in_process/authorized/… → MP re-notificará al cambiar
  }
  const mapped = actionByStatus()
  if (!mapped) {
    logger.info('billing.real_payment_ignored_status', { provider_payment_id: opts.providerPaymentId, mp_status: mpStatus })
    return { ok: true, action: `ignored:${mpStatus || 'unknown'}` }
  }

  // Resuelve nuestro Payment: external_reference (canal preferente) o el último
  // pago pendiente del usuario ligado a esta preferencia vía providerPaymentId.
  const payment = (mp.external_reference
    ? await db.payment.findUnique({ where: { id: mp.external_reference } })
    : null)
    ?? await db.payment.findFirst({
      where: { providerPaymentId: opts.providerPaymentId },
      orderBy: { createdAt: 'desc' },
    })
  if (!payment) {
    logger.warn('billing.real_payment_not_resolved', {
      provider_payment_id: opts.providerPaymentId,
      external_reference: mp.external_reference ?? null,
      mp_status: mpStatus,
    })
    return { ok: false, action: 'payment_not_resolved' }
  }

  // Idempotencia: MP re-notifica el mismo pago varias veces (approved, con
  // detalles, etc.); un Payment ya exitoso NO se vuelve a procesar (evita
  // extender la suscripción dos veces).
  if (payment.status === 'succeeded' && mapped === 'succeeded') {
    logger.info('billing.real_payment_already_processed', { payment_id: payment.id, provider_payment_id: opts.providerPaymentId })
    return { ok: true, action: 'already_processed' }
  }

  const processed = await processPaymentWebhook({
    paymentId: payment.id,
    providerPaymentId: String(mp.id ?? opts.providerPaymentId),
    status: mapped,
    failureReason: mapped === 'failed' ? (mp.status_detail || mpStatus) : undefined,
  })

  logger.info('billing.real_payment_webhook_processed', {
    payment_id: payment.id, provider_payment_id: opts.providerPaymentId, mp_status: mpStatus, mapped, ok: processed.ok,
  })
  await audit('billing.real_payment_webhook_processed', {
    userId: payment.userId,
    resourceType: 'payment',
    resourceId: payment.id,
    metadata: {
      providerPaymentId: opts.providerPaymentId,
      mpStatus: mpStatus,
      mapped,
      amount: mp.transaction_amount ?? null,
    },
  })

  return { ok: processed.ok, action: mapped }
}

// Dev-mode success endpoint (for testing without real MP)
export async function devSuccess(paymentId: string): Promise<{ ok: boolean }> {
  return processPaymentWebhook({
    paymentId,
    status: 'succeeded',
  })
}
