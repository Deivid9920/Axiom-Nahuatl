// AXIOM — Billing (Mercado Pago integration)

import { db } from '@/lib/db'
import { logger, audit } from '@/lib/observability'
import { events } from '@/lib/events'
import { type PlanCode } from '@/lib/types'

// Plan configuration (per docs Ch. 5 §5.1)
export const PLAN_CONFIG: Record<PlanCode, {
  name: string
  priceMxnCents: number
  priceUsdCents: number
  features: {
    maxSessionsPerMonth: number
    maxDocuments: number
    ragEnabled: boolean
    voiceEnabled: boolean
    teamEnabled: boolean
    adminEnabled: boolean
    prioritySupport: boolean
  }
}> = {
  basico: {
    name: 'Básico',
    priceMxnCents: 19900,    // $199.00 MXN
    priceUsdCents: 1157,
    features: {
      maxSessionsPerMonth: 30,
      maxDocuments: 0,
      ragEnabled: false,
      voiceEnabled: false,
      teamEnabled: false,
      adminEnabled: false,
      prioritySupport: false,
    },
  },
  pro: {
    name: 'Pro',
    priceMxnCents: 39900,    // $399.00 MXN
    priceUsdCents: 2320,
    features: {
      maxSessionsPerMonth: 9999,  // unlimited
      maxDocuments: 50,
      ragEnabled: true,
      voiceEnabled: true,
      teamEnabled: false,
      adminEnabled: false,
      prioritySupport: false,
    },
  },
  equipo: {
    name: 'Equipo',
    priceMxnCents: 99900,    // $999.00 MXN
    priceUsdCents: 5808,
    features: {
      maxSessionsPerMonth: 9999,
      maxDocuments: 500,
      ragEnabled: true,
      voiceEnabled: true,
      teamEnabled: true,
      adminEnabled: true,
      prioritySupport: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    priceMxnCents: 299900,   // $2,999.00 MXN+
    priceUsdCents: 17436,
    features: {
      maxSessionsPerMonth: 9999,
      maxDocuments: 9999,
      ragEnabled: true,
      voiceEnabled: true,
      teamEnabled: true,
      adminEnabled: true,
      prioritySupport: true,
    },
  },
}

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

  // Create pending payment record
  const payment = await db.payment.create({
    data: {
      userId: opts.userId,
      amountMxnCents: amount,
      amountUsdCents: Math.ceil(amount / 17.2),
      currency: 'MXN',
      provider: 'mercado_pago',
      status: 'pending',
    },
  })

  // If no MP token, return dev-mode stub
  if (!MP_ACCESS_TOKEN) {
    logger.warn('billing.mp_no_token_dev_mode', { user_id: opts.userId, payment_id: payment.id })
    // Return a fake preference pointing to a local webhook
    return {
      ok: true,
      preferenceId: `dev_pref_${payment.id}`,
      initPoint: `/api/billing/dev-success?paymentId=${payment.id}`,
      sandboxInitPoint: `/api/billing/dev-success?paymentId=${payment.id}`,
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
    // Determine plan from subscription or metadata
    let subscription = payment.subscription
    if (!subscription) {
      // Create a new subscription (for fresh upgrade)
      // Get plan from payment amount
      const plan = await db.plan.findFirst({
        where: { priceMxn: payment.amountMxnCents },
      })
      if (!plan) {
        logger.error('billing.plan_not_found_for_amount', { payment_id: payment.id, amount: payment.amountMxnCents })
        return { ok: false }
      }
      subscription = await db.subscription.create({
        data: {
          userId: payment.userId,
          planId: plan.id,
          status: 'active',
          cadence: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
    } else {
      // Extend existing subscription
      await db.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'active',
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      })
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
      metadata: { amountMxnCents: payment.amountMxnCents },
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

// Dev-mode success endpoint (for testing without real MP)
export async function devSuccess(paymentId: string): Promise<{ ok: boolean }> {
  return processPaymentWebhook({
    paymentId,
    status: 'succeeded',
  })
}
