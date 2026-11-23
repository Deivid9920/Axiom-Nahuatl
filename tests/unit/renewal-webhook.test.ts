// R29-a — renovación anual desde el fin del periodo vigente (integración del webhook).
// Antes: cualquier pago anual con suscripción anual vigente creaba una SEGUNDA fila
// active con inicio hoy (y 365 días desde el pago), perdiendo los días ya pagados.
// Ahora: el pago anual del mismo plan EXTIENDE la suscripción vigente
// (fin nuevo = fin vigente + 365) sin duplicar filas.
import { describe, test, expect } from 'vitest'
import { processPaymentWebhook, seedPlans } from '@/lib/billing'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

const DAY_MS = 24 * 60 * 60 * 1000

async function seedSubscriber(email: string) {
  const passwordHash = await hashPassword('ClaveSegura#123')
  return prisma.user.create({ data: { email, name: 'Suscriptor', passwordHash, profile: { create: {} } } })
}

async function createAnnualPayment(userId: string, amountMxnCents: number) {
  return prisma.payment.create({
    data: {
      userId,
      amountMxnCents,
      amountUsdCents: Math.ceil(amountMxnCents / 17.2),
      currency: 'MXN',
      cadence: 'annual',
      provider: 'mercado_pago',
      status: 'pending',
    },
  })
}

describe('R29-a — renovación anual extiende el periodo vigente', () => {
  test('pago anual del mismo plan extiende la suscripción vigente (sin duplicar fila, sin perder días)', async () => {
    await seedPlans()
    const user = await seedSubscriber('renewal@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    // Suscripción anual Pro vigente: termina en 200 días
    const oldEnd = new Date(Date.now() + 200 * DAY_MS)
    const existing = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: pro!.id,
        status: 'active',
        cadence: 'annual',
        currentPeriodStart: new Date(Date.now() - 165 * DAY_MS),
        currentPeriodEnd: oldEnd,
      },
    })

    // Pago anual Pro (399000 centavos = $3,990/año)
    const payment = await createAnnualPayment(user.id, 399000)
    const result = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(result.ok).toBe(true)
    expect(result.subscriptionId).toBe(existing.id) // extiende la misma fila

    const subs = await prisma.subscription.findMany({ where: { userId: user.id } })
    expect(subs).toHaveLength(1) // NO duplica
    const expectedEnd = new Date(oldEnd.getTime() + 365 * DAY_MS)
    expect(subs[0]!.currentPeriodEnd.getTime()).toBe(expectedEnd.getTime()) // fin vigente + 365
    expect(subs[0]!.currentPeriodStart.getTime()).toBe(oldEnd.getTime()) // el nuevo ciclo arranca al terminar el vigente
    expect(subs[0]!.cadence).toBe('annual')
    expect(subs[0]!.status).toBe('active')
  })

  test('pago anual sin suscripción previa sigue creando una suscripción (365 días desde hoy)', async () => {
    await seedPlans()
    const user = await seedSubscriber('fresh-annual@t.mx')
    const payment = await createAnnualPayment(user.id, 399000)
    const result = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(result.ok).toBe(true)

    const subs = await prisma.subscription.findMany({ where: { userId: user.id } })
    expect(subs).toHaveLength(1)
    const drift = Math.abs(subs[0]!.currentPeriodEnd.getTime() - (Date.now() + 365 * DAY_MS))
    expect(drift).toBeLessThan(10_000) // ~365 días desde el pago
  })

  test('pago anual sobre suscripción mensual vigente NO extiende desde el fin mensual (proration R28 lo cubre)', async () => {
    await seedPlans()
    const user = await seedSubscriber('upgrade-annual@t.mx')
    const basico = await prisma.plan.findUnique({ where: { code: 'basico' } })
    expect(basico).not.toBeNull()

    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: basico!.id,
        status: 'active',
        cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 20 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() + 10 * DAY_MS),
      },
    })

    // Pago anual Pro (plan distinto: es un upgrade, no renovación) → nueva fila activa hoy
    const payment = await createAnnualPayment(user.id, 399000)
    const result = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(result.ok).toBe(true)

    const subs = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(subs).toHaveLength(2)
    const nueva = subs[1]!
    const drift = Math.abs(nueva.currentPeriodEnd.getTime() - (Date.now() + 375 * DAY_MS))
    expect(drift).toBeLessThan(10_000) // 365 + 10 días de proration desde hoy
    expect(nueva.cadence).toBe('annual')
  })
})

describe('R30-c — renovación mensual con ancla al fin del periodo vigente', () => {
  test('pago mensual del mismo plan extiende la suscripción mensual vigente (fin nuevo = fin vigente + 30, sin duplicar fila)', async () => {
    await seedPlans()
    const user = await seedSubscriber('monthly-renewal@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    // Suscripción mensual Pro vigente: termina en 12 días
    const oldEnd = new Date(Date.now() + 12 * DAY_MS)
    const existing = await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: pro!.id,
        status: 'active',
        cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 18 * DAY_MS),
        currentPeriodEnd: oldEnd,
      },
    })

    // Pago mensual Pro sin subscriptionId (compra nueva desde planes) → 39900 centavos
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        amountMxnCents: 39900,
        amountUsdCents: Math.ceil(39900 / 17.2),
        currency: 'MXN',
        cadence: 'monthly',
        provider: 'mercado_pago',
        status: 'pending',
      },
    })
    const result = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(result.ok).toBe(true)
    expect(result.subscriptionId).toBe(existing.id) // extiende la misma fila

    const subs = await prisma.subscription.findMany({ where: { userId: user.id } })
    expect(subs).toHaveLength(1) // NO duplica (antes: creaba una segunda fila active con inicio hoy)
    const expectedEnd = new Date(oldEnd.getTime() + 30 * DAY_MS)
    expect(subs[0]!.currentPeriodEnd.getTime()).toBe(expectedEnd.getTime()) // fin vigente + 30
    expect(subs[0]!.currentPeriodStart.getTime()).toBe(oldEnd.getTime())
    expect(subs[0]!.cadence).toBe('monthly')
  })

  test('upgrade mensual a otro plan (misma cadence, plan distinto) empieza HOY: el guard por plan no regala días', async () => {
    await seedPlans()
    const user = await seedSubscriber('monthly-upgrade@t.mx')
    const basico = await prisma.plan.findUnique({ where: { code: 'basico' } })
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(basico).not.toBeNull()
    expect(pro).not.toBeNull()

    // Básico mensual vigente (le quedan 20 días)
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: basico!.id,
        status: 'active',
        cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 10 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() + 20 * DAY_MS),
      },
    })

    // Pago mensual Pro (upgrade, plan distinto) → nueva fila que arranca HOY con 30 días
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        amountMxnCents: 39900,
        amountUsdCents: Math.ceil(39900 / 17.2),
        currency: 'MXN',
        cadence: 'monthly',
        provider: 'mercado_pago',
        status: 'pending',
      },
    })
    const result = await processPaymentWebhook({ paymentId: payment.id, status: 'succeeded' })
    expect(result.ok).toBe(true)

    const subs = await prisma.subscription.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    })
    expect(subs).toHaveLength(2)
    const nueva = subs[1]!
    const drift = Math.abs(nueva.currentPeriodEnd.getTime() - (Date.now() + 30 * DAY_MS))
    expect(drift).toBeLessThan(10_000) // 30 días desde HOY (no desde el fin de Básico)
    expect(nueva.currentPeriodStart.getTime()).toBeLessThanOrEqual(Date.now() + 10_000)
  })
})
