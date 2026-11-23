// R24 — Cadencia mensual/anual: persistencia en Payment + procesamiento del webhook
// Cubre los 4 bugs corregidos:
//   1) Payment persiste planCode + cadence al crear la preferencia
//   2) Pago anual (monto ×10) resuelve su plan (antes: plan_not_found_for_amount)
//   3) El webhook ya no hardcodea cadence 'monthly' / 30 días
//   4) Renovación extiende desde el fin vigente; cambio de cadencia reinicia el ciclo
import { describe, test, expect, beforeAll } from 'vitest'
import { PLAN_CONFIG, PERIOD_DAYS, createPaymentPreference, processPaymentWebhook } from '@/lib/billing'
import { seedPlans } from '@/lib/billing'
import { prisma } from '../setup'

const DAY = 24 * 60 * 60 * 1000

async function makeUser(tag: string) {
  return prisma.user.create({
    data: {
      email: `r24-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
      passwordHash: 'hash',
      profile: { create: {} },
    },
  })
}

// Pago "legado" simulado: fila directa (sin planCode, como antes de R24)
// Nota: cadence es no-nulable con default 'monthly' — las filas legadas quedaron backfiladas así por db push
async function makePayment(userId: string, amountMxnCents: number, planCode?: string | null, cadence?: 'monthly' | 'annual') {
  return prisma.payment.create({
    data: {
      userId,
      amountMxnCents,
      amountUsdCents: Math.ceil(amountMxnCents / 17.2),
      currency: 'MXN',
      provider: 'mercado_pago',
      status: 'pending',
      ...(planCode !== undefined ? { planCode } : {}),
      ...(cadence ? { cadence } : {}),
    },
  })
}

beforeAll(async () => {
  await seedPlans()
})

describe('R24 — preferencia de pago persiste plan y cadencia', () => {
  test('mensual: monto mensual, planCode y cadence guardados', async () => {
    const user = await makeUser('pref-m')
    const res = await createPaymentPreference({ userId: user.id, planCode: 'pro', cadence: 'monthly' })
    expect(res.ok).toBe(true)
    const paymentId = res.ok ? res.initPoint.split('paymentId=')[1] : ''
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment!.amountMxnCents).toBe(PLAN_CONFIG.pro.priceMxnCents)
    expect(payment!.planCode).toBe('pro')
    expect(payment!.cadence).toBe('monthly')
  })

  test('anual: monto ×10 (2 meses gratis), planCode y cadence guardados', async () => {
    const user = await makeUser('pref-a')
    const res = await createPaymentPreference({ userId: user.id, planCode: 'pro', cadence: 'annual' })
    expect(res.ok).toBe(true)
    const paymentId = res.ok ? res.initPoint.split('paymentId=')[1] : ''
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    expect(payment!.amountMxnCents).toBe(PLAN_CONFIG.pro.priceMxnCents * 10) // $3,990/año
    expect(payment!.planCode).toBe('pro')
    expect(payment!.cadence).toBe('annual')
  })
})

describe('R24 — webhook crea suscripción con cadencia correcta', () => {
  test('pago anual: cadence annual + periodo ≈ 365 días (antes forzaba monthly/30)', async () => {
    const user = await makeUser('wh-annual')
    const payment = await makePayment(user.id, PLAN_CONFIG.pro.priceMxnCents * 10, 'pro', 'annual')
    const res = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(res.ok).toBe(true)

    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.cadence).toBe('annual')
    expect(sub!.status).toBe('active')
    const days = (sub!.currentPeriodEnd.getTime() - Date.now()) / DAY
    expect(days).toBeGreaterThan(PERIOD_DAYS.annual - 1)
    expect(days).toBeLessThan(PERIOD_DAYS.annual + 1)
    // el pago queda vinculado a la suscripción (futuros webhooks extienden, no duplican)
    const linked = await prisma.payment.findUnique({ where: { id: payment.id } })
    expect(linked!.subscriptionId).toBe(sub!.id)
  })

  test('pago mensual: cadence monthly + periodo ≈ 30 días', async () => {
    const user = await makeUser('wh-monthly')
    const payment = await makePayment(user.id, PLAN_CONFIG.basico.priceMxnCents, 'basico')
    const res = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(res.ok).toBe(true)

    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.cadence).toBe('monthly')
    const days = (sub!.currentPeriodEnd.getTime() - Date.now()) / DAY
    expect(days).toBeGreaterThan(PERIOD_DAYS.monthly - 1)
    expect(days).toBeLessThan(PERIOD_DAYS.monthly + 1)
  })

  test('legado sin planCode con monto anual: resuelve plan por monto/10', async () => {
    const user = await makeUser('wh-legacy-annual')
    // pagos previos a R24 no tenían planCode; el monto anual ×10 no matcheaba ningún plan
    const payment = await makePayment(user.id, PLAN_CONFIG.pro.priceMxnCents * 10, null)
    const res = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(res.ok).toBe(true)

    const sub = await prisma.subscription.findFirst({ where: { userId: user.id }, include: { plan: true } })
    expect(sub!.plan.code).toBe('pro')
    expect(sub!.cadence).toBe('monthly') // legado sin cadence → default mensual
  })

  test('monto desconocido sin planCode: ok=false y sin suscripción', async () => {
    const user = await makeUser('wh-unknown')
    const payment = await makePayment(user.id, 123456789, null)
    const res = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(res.ok).toBe(false)
    const count = await prisma.subscription.count({ where: { userId: user.id } })
    expect(count).toBe(0)
  })
})

describe('R24 — renovación y cambio de cadencia sobre suscripción existente', () => {
  test('renovación misma cadencia: extiende desde el fin vigente (no desde hoy)', async () => {
    const user = await makeUser('renew')
    const plan = await prisma.plan.findUnique({ where: { code: 'equipo' } })
    const inTenDays = new Date(Date.now() + 10 * DAY)
    const existing = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan!.id,
        status: 'active',
        cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 20 * DAY),
        currentPeriodEnd: inTenDays,
      },
    })
    const payment = await makePayment(user.id, PLAN_CONFIG.equipo.priceMxnCents, 'equipo')
    await prisma.payment.update({ where: { id: payment.id }, data: { subscriptionId: existing.id } })

    const res = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(res.ok).toBe(true)

    const sub = await prisma.subscription.findUnique({ where: { id: existing.id } })
    const days = (sub!.currentPeriodEnd.getTime() - Date.now()) / DAY
    expect(days).toBeGreaterThan(39) // 10 restantes + 30 nuevos
    expect(days).toBeLessThan(41)
    expect(sub!.cadence).toBe('monthly')
  })

  test('cambio de cadencia mensual → anual: reinicia el ciclo a 365 días', async () => {
    const user = await makeUser('upgrade-cad')
    const plan = await prisma.plan.findUnique({ where: { code: 'basico' } })
    const existing = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: plan!.id,
        status: 'active',
        cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 5 * DAY),
        currentPeriodEnd: new Date(Date.now() + 25 * DAY),
      },
    })
    const payment = await makePayment(user.id, PLAN_CONFIG.basico.priceMxnCents * 10, 'basico', 'annual')
    await prisma.payment.update({ where: { id: payment.id }, data: { subscriptionId: existing.id } })

    await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })

    const sub = await prisma.subscription.findUnique({ where: { id: existing.id } })
    expect(sub!.cadence).toBe('annual')
    const days = (sub!.currentPeriodEnd.getTime() - Date.now()) / DAY
    expect(days).toBeGreaterThan(PERIOD_DAYS.annual - 1)
    expect(days).toBeLessThan(PERIOD_DAYS.annual + 1)
    expect(sub!.currentPeriodStart.getTime()).toBeGreaterThan(Date.now() - 60 * 1000) // arrancó hoy
  })
})
