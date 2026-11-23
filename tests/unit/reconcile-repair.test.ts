// R34-a — acción de reparación desde la conciliación: reprocessa el webhook
// perdido de UN pago de MP reutilizando processRealPaymentWebhook (R32-c).
// Cubre: dev_skip sin token (con auditoría registrada), reparación efectiva de
// un webhook perdido (MP approved vs interno pending → suscripción aplicada) y
// huérfano sin Payment interno (payment_not_resolved, sin inventar registros).
import { describe, test, expect, vi, afterEach } from 'vitest'
import { repairReconciledPayment } from '@/lib/billing/reconcile'
import { seedPlans } from '@/lib/billing'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

const TOKEN_KEY = 'MERCADO_PAGO_ACCESS_TOKEN'
const tokenAntes = process.env[TOKEN_KEY]

afterEach(() => {
  if (tokenAntes === undefined) delete process.env[TOKEN_KEY]
  else process.env[TOKEN_KEY] = tokenAntes!
})

const MP_BODY = (over: Record<string, unknown> = {}) => ({
  ok: true,
  json: async () => ({
    id: 424242,
    status: 'approved',
    status_detail: 'accredited',
    external_reference: null,
    transaction_amount: 399,
    ...over,
  }),
})

async function seedSubscriberAndPendingPayment(email: string, providerPaymentId: string | null, externalRef: string | null) {
  await seedPlans()
  const passwordHash = await hashPassword('ClaveSegura#123')
  const user = await prisma.user.create({ data: { email, name: 'Reparación R34', passwordHash, profile: { create: {} } } })
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      amountMxnCents: 39900,
      amountUsdCents: 1990,
      cadence: 'monthly',
      status: 'pending',
      provider: 'mercado_pago',
      ...(providerPaymentId ? { providerPaymentId } : {}),
      ...(externalRef ? { id: externalRef } : {}),
    },
  })
  return { user, payment }
}

describe('R34-a — repairReconciledPayment', () => {
  test('sin token (dev) responde dev_skip y audita la intención de reparación', async () => {
    const fetchSpy = vi.fn() // no debe llamarse
    const res = await repairReconciledPayment({ providerPaymentId: 'MP-R34-DEV', fetchFn: fetchSpy as unknown as typeof fetch })
    expect(res).toEqual({ ok: true, action: 'dev_skip' })
    expect(fetchSpy).not.toHaveBeenCalled()
    const audited = await prisma.auditLog.findFirst({ where: { action: 'billing.reconcile_repair_applied', resourceId: 'MP-R34-DEV' } })
    expect(audited).toBeTruthy()
  })

  test('repara un webhook perdido: MP approved con Payment pendiente → suscripción aplicada', async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-MP-TOKEN-r34'
    const { user, payment } = await seedSubscriberAndPendingPayment(`r34-repair-${Date.now()}@t.mx`, 'MP-R34-OK', null)
    try {
      const fetchFn = vi.fn(async (url: string | URL | Request) => MP_BODY({ external_reference: payment.id }) as unknown as Response)
      const res = await repairReconciledPayment({ providerPaymentId: 'MP-R34-OK', fetchFn: fetchFn as unknown as typeof fetch })
      expect(res).toEqual({ ok: true, action: 'succeeded' })

      const fixed = await prisma.payment.findUnique({ where: { id: payment.id } })
      expect(fixed?.status).toBe('succeeded')
      // processPaymentWebhook guarda el ID numérico de MP (mp.id) como providerPaymentId
      expect(fixed?.providerPaymentId).toBe('424242')
      const sub = await prisma.subscription.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
      expect(sub?.status).toBe('active')

      const audited = await prisma.auditLog.findFirst({
        where: { action: 'billing.reconcile_repair_applied', resourceId: 'MP-R34-OK' },
        orderBy: { createdAt: 'desc' },
      })
      expect(audited).toBeTruthy()
      expect(JSON.parse(audited!.metadataJson || '{}')).toMatchObject({ ok: true, action: 'succeeded' })
    } finally {
      await prisma.payment.deleteMany({ where: { userId: user.id } })
      await prisma.subscription.deleteMany({ where: { userId: user.id } })
      await prisma.user.delete({ where: { id: user.id } })
    }
  })

  test('huérfano sin Payment interno → payment_not_resolved (no inventa registros)', async () => {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-MP-TOKEN-r34'
    const fetchFn = vi.fn(async () => MP_BODY({ external_reference: 'no-existe' }) as unknown as Response)
    const res = await repairReconciledPayment({ providerPaymentId: 'MP-R34-HUERFANO', fetchFn: fetchFn as unknown as typeof fetch })
    expect(res).toEqual({ ok: false, action: 'payment_not_resolved' })
  })
})
