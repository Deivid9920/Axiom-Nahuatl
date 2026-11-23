// R30-a — cobro automático efectivo de la renovación (runRenewalCycle).
// Antes: autoRenew era sólo una bandera informativa — al vencer el periodo no pasaba
// nada (la suscripción quedaba active/expirada indefinidamente y nadie cobraba).
// Ahora: el ciclo encuentra las suscripciones vencidas con autoRenew y procesa el
// cobro (en desarrollo por el stub del webhook), extiende el periodo, envía recibo
// por correo (R30-b), y las vencidas sin autoRenew pasan a past_due con aviso.
import { describe, test, expect } from 'vitest'
import { runRenewalCycle, seedPlans } from '@/lib/billing'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

const DAY_MS = 24 * 60 * 60 * 1000

async function seedSubscriber(email: string) {
  const passwordHash = await hashPassword('ClaveSegura#123')
  return prisma.user.create({ data: { email, name: 'Suscriptor', passwordHash, profile: { create: {} } } })
}

async function createSub(opts: {
  userId: string
  planId: string
  cadence?: 'monthly' | 'annual'
  endInDays: number
  autoRenew?: boolean
  cancelAtPeriodEnd?: boolean
  status?: string
  mercadoPagoSubscriptionId?: string
}) {
  return prisma.subscription.create({
    data: {
      userId: opts.userId,
      planId: opts.planId,
      status: opts.status ?? 'active',
      cadence: opts.cadence ?? 'monthly',
      currentPeriodStart: new Date(Date.now() - 20 * DAY_MS),
      currentPeriodEnd: new Date(Date.now() + opts.endInDays * DAY_MS),
      autoRenew: opts.autoRenew ?? true,
      cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
      ...(opts.mercadoPagoSubscriptionId ? { mercadoPagoSubscriptionId: opts.mercadoPagoSubscriptionId } : {}),
    },
  })
}

describe('R30-a — runRenewalCycle: cobro automático de renovaciones', () => {
  test('suscripción vencida con autoRenew → cobro procesado, periodo extendido 30 días y recibo por correo', async () => {
    await seedPlans()
    const user = await seedSubscriber('auto-renew@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    // Vencida hace 2 días (la renovación automática debió ocurrir al vencer)
    const sub = await createSub({ userId: user.id, planId: pro!.id, endInDays: -2, cadence: 'monthly' })

    const result = await runRenewalCycle()
    expect(result.scannedRenewals).toBeGreaterThanOrEqual(1)
    expect(result.charged).toBeGreaterThanOrEqual(1)

    const renewed = await prisma.subscription.findUnique({ where: { id: sub.id } })
    expect(renewed!.status).toBe('active')
    const drift = Math.abs(renewed!.currentPeriodEnd.getTime() - (Date.now() + 30 * DAY_MS))
    expect(drift).toBeLessThan(10_000) // vencida → arranca ahora + 30 días

    const payments = await prisma.payment.findMany({ where: { userId: user.id } })
    expect(payments).toHaveLength(1)
    expect(payments[0]!.status).toBe('succeeded')
    expect(payments[0]!.amountMxnCents).toBe(39900) // Pro mensual
    expect(payments[0]!.cadence).toBe('monthly')

    const receipt = await prisma.emailLog.findFirst({ where: { userId: user.id, kind: 'renewal_receipt' } })
    expect(receipt).not.toBeNull()
    expect(receipt!.subject).toContain('renovación confirmada')
  })

  test('suscripción vencida con autoRenew=false → pasa a past_due con aviso de vencimiento, SIN cobro', async () => {
    await seedPlans()
    const user = await seedSubscriber('manual-expired@t.mx')
    const basico = await prisma.plan.findUnique({ where: { code: 'basico' } })
    expect(basico).not.toBeNull()

    await createSub({ userId: user.id, planId: basico!.id, endInDays: -1, autoRenew: false })

    const result = await runRenewalCycle()
    expect(result.charged).toBe(0)
    expect(result.lapsed).toBeGreaterThanOrEqual(1)

    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.status).toBe('past_due')

    const payments = await prisma.payment.findMany({ where: { userId: user.id } })
    expect(payments).toHaveLength(0) // sin cobro

    const notice = await prisma.emailLog.findFirst({ where: { userId: user.id, kind: 'renewal_notice' } })
    expect(notice).not.toBeNull()
    expect(notice!.subject).toContain('ha vencido')
  })

  test('cancelAtPeriodEnd=true → no se cobra aunque autoRenew esté activo', async () => {
    await seedPlans()
    const user = await seedSubscriber('canceled@t.mx')
    const basico = await prisma.plan.findUnique({ where: { code: 'basico' } })
    expect(basico).not.toBeNull()

    await createSub({ userId: user.id, planId: basico!.id, endInDays: -1, autoRenew: true, cancelAtPeriodEnd: true })

    const result = await runRenewalCycle()
    expect(result.charged).toBe(0)
    const payments = await prisma.payment.findMany({ where: { userId: user.id } })
    expect(payments).toHaveLength(0)
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.status).toBe('past_due') // lapsed, no renovada
  })

  test('preaprobación de Mercado Pago → se omite (MP gestiona su propia renovación)', async () => {
    await seedPlans()
    const user = await seedSubscriber('mp-preapproval@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    await createSub({
      userId: user.id, planId: pro!.id, endInDays: -1,
      mercadoPagoSubscriptionId: '2c93808a8b123456',
    })

    const result = await runRenewalCycle()
    expect(result.skipped).toBeGreaterThanOrEqual(1)
    const payments = await prisma.payment.findMany({ where: { userId: user.id } })
    expect(payments).toHaveLength(0)
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.status).toBe('active') // intacta, MP la renovará
  })

  test('vencida hace más del periodo de gracia (90 días) → past_due sin intento de cobro', async () => {
    await seedPlans()
    const user = await seedSubscriber('grace-exceeded@t.mx')
    const basico = await prisma.plan.findUnique({ where: { code: 'basico' } })
    expect(basico).not.toBeNull()

    await createSub({ userId: user.id, planId: basico!.id, endInDays: -100 })

    const result = await runRenewalCycle()
    expect(result.failed).toBeGreaterThanOrEqual(1)
    const payments = await prisma.payment.findMany({ where: { userId: user.id } })
    expect(payments).toHaveLength(0)
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.status).toBe('past_due')
  })

  test('cobro anual renovado: la suscripción anual vencida se extiende 365 días con el monto anual (×10)', async () => {
    await seedPlans()
    const user = await seedSubscriber('auto-renew-annual@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    await createSub({ userId: user.id, planId: pro!.id, endInDays: -1, cadence: 'annual' })

    const result = await runRenewalCycle()
    expect(result.charged).toBeGreaterThanOrEqual(1)
    const payment = await prisma.payment.findFirst({ where: { userId: user.id } })
    expect(payment!.amountMxnCents).toBe(399000) // Pro anual ($3,990/año)
    expect(payment!.cadence).toBe('annual')
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    const drift = Math.abs(sub!.currentPeriodEnd.getTime() - (Date.now() + 365 * DAY_MS))
    expect(drift).toBeLessThan(10_000)
  })
})

describe('R30-b — runRenewalCycle: avisos de vencimiento por correo', () => {
  test('suscripción que vence en 5 días → aviso warning (autoRenew activo); al re-correr el ciclo no se duplica', async () => {
    await seedPlans()
    const user = await seedSubscriber('notice-warning@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    await createSub({ userId: user.id, planId: pro!.id, endInDays: 5 })

    const first = await runRenewalCycle()
    expect(first.noticesSent).toBeGreaterThanOrEqual(1)
    const notice = await prisma.emailLog.findFirst({ where: { userId: user.id, kind: 'renewal_notice' } })
    expect(notice).not.toBeNull()
    expect(notice!.subject).toContain('5 días')
    expect(notice!.body).toContain('renovación automática')

    const second = await runRenewalCycle()
    expect(second.noticesSent).toBe(0) // dedupe: mismo nivel + mismo periodo
    expect(second.noticeDuplicates).toBeGreaterThanOrEqual(1)
    const all = await prisma.emailLog.findMany({ where: { userId: user.id, kind: 'renewal_notice' } })
    expect(all).toHaveLength(1)
  })

  test('autoRenew desactivado → el aviso habla de renovación manual', async () => {
    await seedPlans()
    const user = await seedSubscriber('notice-manual@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    await createSub({ userId: user.id, planId: pro!.id, endInDays: 3, autoRenew: false })

    await runRenewalCycle()
    const notice = await prisma.emailLog.findFirst({ where: { userId: user.id, kind: 'renewal_notice' } })
    expect(notice).not.toBeNull()
    expect(notice!.body).toContain('renueva manualmente')
  })

  test('suscripción con más de 14 días de vigencia → sin aviso (nivel none)', async () => {
    await seedPlans()
    const user = await seedSubscriber('notice-none@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    await createSub({ userId: user.id, planId: pro!.id, endInDays: 30 })

    const result = await runRenewalCycle()
    expect(result.noticesSent).toBe(0)
    const notices = await prisma.emailLog.findMany({ where: { userId: user.id } })
    expect(notices).toHaveLength(0)
  })
})
