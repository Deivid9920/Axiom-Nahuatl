// R31-c — alta de preaprobaciones de Mercado Pago desde la app (modo desarrollo:
// sin token MP el alta se simula con el flujo dev del webhook de pagos).
// Portabilidad v7/náhuatl: sólo usa el plan «pro» (mismo código y precio en ambos).
import { describe, test, expect } from 'vitest'
import { createPreapproval, processPreapprovalWebhook, seedPlans } from '@/lib/billing'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

async function seedSubscriber(email: string) {
  const passwordHash = await hashPassword('ClaveSegura#123')
  return prisma.user.create({ data: { email, name: 'Alta MP', passwordHash, profile: { create: {} } } })
}

describe('R31-c — createPreapproval (modo desarrollo, sin token MP)', () => {
  test('alta mensual → pago pendiente registrado + initPoint del flujo dev', async () => {
    await seedPlans()
    const user = await seedSubscriber('preapproval-dev@t.mx')

    const result = await createPreapproval({ userId: user.id, planCode: 'pro', cadence: 'monthly' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.dev).toBe(true)
    expect(result.initPoint).toContain('/api/billing/webhook?dev=1&paymentId=')

    const payment = await prisma.payment.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
    expect(payment).not.toBeNull()
    expect(payment!.status).toBe('pending')
    expect(payment!.cadence).toBe('monthly')
    expect(payment!.amountMxnCents).toBe(39900) // Pro mensual
  })

  test('alta anual → monto anual (×10) con cadence annual', async () => {
    await seedPlans()
    const user = await seedSubscriber('preapproval-dev-annual@t.mx')

    const result = await createPreapproval({ userId: user.id, planCode: 'pro', cadence: 'annual' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.dev).toBe(true)

    const payment = await prisma.payment.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
    expect(payment!.cadence).toBe('annual')
    expect(payment!.amountMxnCents).toBe(399000) // Pro anual ($3,990/año)
  })

  test('processPreapprovalWebhook sin token → dev_skip (no hay estado real que consultar)', async () => {
    const result = await processPreapprovalWebhook({ preapprovalId: '2c93808a8b999' })
    expect(result.ok).toBe(true)
    expect(result.action).toBe('dev_skip')
  })
})
