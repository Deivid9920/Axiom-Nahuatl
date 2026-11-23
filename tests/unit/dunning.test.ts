// R31-b — dunning: reintento de cobros fallidos con backoff.
// El webhook de cobro se inyecta como stub determinista (punto de inyección de
// runRenewalCycle); todo lo demás (programación de reintentos, correos, estados y
// auditoría) es código real.
// Portabilidad v7/náhuatl: sólo usa el plan «pro» (mismo código y precio en ambos).
import { describe, test, expect } from 'vitest'
import { runRenewalCycle, seedPlans } from '@/lib/billing'
import { RENEWAL_RETRY_SCHEDULE_DAYS } from '@/lib/billing/renewal'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

const DAY_MS = 24 * 60 * 60 * 1000

const failWebhook = async () => ({ ok: false as const })
const okWebhook = async () => ({ ok: true as const, subscriptionId: 'sim' })

async function seedSubscriber(email: string) {
  const passwordHash = await hashPassword('ClaveSegura#123')
  return prisma.user.create({ data: { email, name: 'Suscriptor', passwordHash, profile: { create: {} } } })
}

describe('R31-b — dunning: reintento de cobros fallidos con backoff', () => {
  test('primer cobro fallido → past_due con reintento agendado a +2 días, aviso por correo y pago fallido', async () => {
    await seedPlans()
    const user = await seedSubscriber('dunning-first@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    expect(pro).not.toBeNull()

    const sub = await prisma.subscription.create({
      data: {
        userId: user.id, planId: pro!.id, status: 'active', cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 30 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() - 1 * DAY_MS),
        autoRenew: true,
      },
    })

    const before = Date.now()
    const result = await runRenewalCycle({ chargeWebhook: failWebhook })
    expect(result.retriesScheduled).toBeGreaterThanOrEqual(1)
    expect(result.dunningExhausted).toBe(0)

    const after = await prisma.subscription.findUnique({ where: { id: sub.id } })
    expect(after!.status).toBe('past_due')
    expect(after!.renewalRetryCount).toBe(1)
    const expected = RENEWAL_RETRY_SCHEDULE_DAYS[0] * DAY_MS
    expect(after!.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(before + expected - 5000)
    expect(after!.nextRetryAt!.getTime()).toBeLessThanOrEqual(Date.now() + expected + 5000)

    const payment = await prisma.payment.findFirst({ where: { userId: user.id } })
    expect(payment!.status).toBe('failed')
    expect(payment!.failureReason).toBe('webhook_rejected')

    const failedMail = await prisma.emailLog.findFirst({ where: { userId: user.id, kind: 'renewal_failed' } })
    expect(failedMail).not.toBeNull()
    expect(failedMail!.subject).toContain('no pudimos procesar la renovación')
    expect(failedMail!.body).toContain('lo reintentaremos automáticamente')
  })

  test('reintento exitoso → dunning reiniciado (contador a 0, sin próxima fecha) y recibo enviado', async () => {
    await seedPlans()
    const user = await seedSubscriber('dunning-recovered@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })

    await prisma.subscription.create({
      data: {
        userId: user.id, planId: pro!.id, status: 'past_due', cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 35 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() - 3 * DAY_MS),
        autoRenew: true,
        renewalRetryCount: 1,
        nextRetryAt: new Date(Date.now() - 60 * 60 * 1000), // reintento ya vencido
      },
    })

    const result = await runRenewalCycle({ chargeWebhook: okWebhook })
    expect(result.retriesExecuted).toBeGreaterThanOrEqual(1)
    expect(result.charged).toBeGreaterThanOrEqual(1)

    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.renewalRetryCount).toBe(0)
    expect(sub!.nextRetryAt).toBeNull()

    const receipt = await prisma.emailLog.findFirst({ where: { userId: user.id, kind: 'renewal_receipt' } })
    expect(receipt).not.toBeNull()
  })

  test('fallos sucesivos escalan el backoff (+2, +5, +10) y al agotarse el calendario queda past_due terminal', async () => {
    await seedPlans()
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
    const emails = ['dunning-b0@t.mx', 'dunning-b1@t.mx', 'dunning-b2@t.mx']
    const subs: { id: string }[] = []
    for (let i = 0; i < 3; i++) {
      const user = await seedSubscriber(emails[i]!)
      subs.push(await prisma.subscription.create({
        data: {
          userId: user.id, planId: pro!.id, status: 'active', cadence: 'monthly',
          currentPeriodStart: new Date(Date.now() - 30 * DAY_MS),
          currentPeriodEnd: new Date(Date.now() - 1 * DAY_MS),
          autoRenew: true,
          renewalRetryCount: i, // 0, 1, 2 → intentos 1, 2, 3
        },
      }))
    }

    await runRenewalCycle({ chargeWebhook: failWebhook })

    // Backoff escalonado según el calendario
    for (let i = 0; i < 3; i++) {
      const s = await prisma.subscription.findUnique({ where: { id: subs[i]!.id } })
      expect(s!.renewalRetryCount).toBe(i + 1)
      const deltaDays = Math.round((s!.nextRetryAt!.getTime() - Date.now()) / DAY_MS)
      expect(deltaDays).toBe(RENEWAL_RETRY_SCHEDULE_DAYS[i])
    }

    // Siguiente fallo tras agendar el 3er reintento → calendario agotado
    await prisma.subscription.updateMany({
      where: { id: { in: subs.map(s => s.id) } },
      data: { status: 'past_due', renewalRetryCount: 3, nextRetryAt: new Date(Date.now() - 60 * 60 * 1000) },
    })
    const result = await runRenewalCycle({ chargeWebhook: failWebhook })
    expect(result.dunningExhausted).toBeGreaterThanOrEqual(3)
    for (const s of subs) {
      const after = await prisma.subscription.findUnique({ where: { id: s.id } })
      expect(after!.status).toBe('past_due')
      expect(after!.nextRetryAt).toBeNull() // terminal: sin más reintentos automáticos
    }
  })

  test('suscripción de preaprobación MP en dunning → se limpia y se omite (MP gestiona su ciclo)', async () => {
    await seedPlans()
    const user = await seedSubscriber('dunning-mp@t.mx')
    const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })

    await prisma.subscription.create({
      data: {
        userId: user.id, planId: pro!.id, status: 'past_due', cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 35 * DAY_MS),
        currentPeriodEnd: new Date(Date.now() - 3 * DAY_MS),
        autoRenew: true,
        renewalRetryCount: 1,
        nextRetryAt: new Date(Date.now() - 60 * 60 * 1000),
        mercadoPagoSubscriptionId: '2c93808a8b123456',
      },
    })

    const result = await runRenewalCycle({ chargeWebhook: failWebhook })
    expect(result.skipped).toBeGreaterThanOrEqual(1)
    const sub = await prisma.subscription.findFirst({ where: { userId: user.id } })
    expect(sub!.nextRetryAt).toBeNull()
  })
})
