// R32-c — webhook de pago REAL de Mercado Pago (topic=payment con data.id).
// Cubre: dev_skip sin token, approved → succeeded extiende/crea suscripción,
// rejected → failed con status_detail, estados transitorios ignorados,
// pago no resoluble y la idempotencia (un Payment ya succeeded no se reprocesa).
import { describe, test, expect, vi, afterEach } from 'vitest'
import { processRealPaymentWebhook, seedPlans } from '@/lib/billing'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

const DAY_MS = 24 * 60 * 60 * 1000

const MP_BODY = (over: Record<string, unknown> = {}) => ({
  ok: true,
  json: async () => ({
    id: 987654321,
    status: 'approved',
    status_detail: 'accredited',
    external_reference: null,
    transaction_amount: 399,
    ...over,
  }),
})

async function seedSubscriber(email: string) {
  const passwordHash = await hashPassword('ClaveSegura#123')
  return prisma.user.create({ data: { email, name: 'Suscriptor MP', passwordHash, profile: { create: {} } } })
}

async function createPendingPayment(userId: string, amountMxnCents: number, cadence: 'monthly' | 'annual' = 'monthly') {
  return prisma.payment.create({
    data: {
      userId,
      amountMxnCents,
      amountUsdCents: Math.ceil(amountMxnCents / 17.2),
      currency: 'MXN',
      cadence,
      provider: 'mercado_pago',
      status: 'pending',
    },
  })
}

function withToken(fn: () => Promise<void>) {
  const antes = process.env.MERCADO_PAGO_ACCESS_TOKEN
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-MP-TOKEN-r32'
  return fn().finally(() => {
    if (antes === undefined) delete process.env.MERCADO_PAGO_ACCESS_TOKEN
    else process.env.MERCADO_PAGO_ACCESS_TOKEN = antes
  })
}

afterEach(() => {
  delete process.env.MERCADO_PAGO_ACCESS_TOKEN
})

describe('R32-c — processRealPaymentWebhook', () => {
  test('sin token responde dev_skip sin consultar MP', async () => {
    const fetchSpy = vi.fn() // no debe llamarse
    const res = await processRealPaymentWebhook({ providerPaymentId: 'MP-1', fetchFn: fetchSpy as unknown as typeof fetch })
    expect(res).toEqual({ ok: true, action: 'dev_skip' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('approved con external_reference procesa el pago y extiende/crea la suscripción', () => withToken(async () => {
    await seedPlans()
    const user = await seedSubscriber('real-mp-r32@t.mx')
    const payment = await createPendingPayment(user.id, 39900, 'monthly') // Pro mensual

    const res = await processRealPaymentWebhook({
      providerPaymentId: 'MP-APPROVED-1',
      fetchFn: (async () => MP_BODY({ external_reference: payment.id })) as unknown as typeof fetch,
    })
    expect(res).toEqual({ ok: true, action: 'succeeded' })

    const updated = await prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updated!.status).toBe('succeeded')
    expect(updated!.providerPaymentId).toBe('987654321') // ID de MP guardado

    const subs = await prisma.subscription.findMany({ where: { userId: user.id } })
    expect(subs).toHaveLength(1)
    expect(subs[0]!.status).toBe('active')
    expect(subs[0]!.cadence).toBe('monthly')
    const drift = Math.abs(subs[0]!.currentPeriodEnd.getTime() - (Date.now() + 30 * DAY_MS))
    expect(drift).toBeLessThan(10_000)
  }))

  test('rejected marca el pago failed con el status_detail de MP', () => withToken(async () => {
    await seedPlans()
    const user = await seedSubscriber('real-mp-rechazo-r32@t.mx')
    const payment = await createPendingPayment(user.id, 39900, 'monthly')

    const res = await processRealPaymentWebhook({
      providerPaymentId: 'MP-REJECTED-1',
      fetchFn: (async () => MP_BODY({
        status: 'rejected',
        status_detail: 'cc_rejected_insufficient_amount',
        external_reference: payment.id,
      })) as unknown as typeof fetch,
    })
    expect(res).toEqual({ ok: true, action: 'failed' })

    const updated = await prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updated!.status).toBe('failed')
    expect(updated!.failureReason).toBe('cc_rejected_insufficient_amount')
  }))

  test('estado transitorio (pending) no toca el pago: MP re-notificará', () => withToken(async () => {
    const user = await seedSubscriber('real-mp-pending-r32@t.mx')
    const payment = await createPendingPayment(user.id, 39900, 'monthly')

    const res = await processRealPaymentWebhook({
      providerPaymentId: 'MP-PENDING-1',
      fetchFn: (async () => MP_BODY({ status: 'pending', external_reference: payment.id })) as unknown as typeof fetch,
    })
    expect(res).toEqual({ ok: true, action: 'ignored:pending' })

    const updated = await prisma.payment.findUnique({ where: { id: payment.id } })
    expect(updated!.status).toBe('pending') // intacto
  }))

  test('pago no resoluble (sin external_reference ni match) responde payment_not_resolved', () => withToken(async () => {
    const res = await processRealPaymentWebhook({
      providerPaymentId: 'MP-DESCONOCIDO-1',
      fetchFn: (async () => MP_BODY({ external_reference: null })) as unknown as typeof fetch,
    })
    expect(res).toEqual({ ok: false, action: 'payment_not_resolved' })
  }))

  test('idempotencia: un Payment ya succeeded no se vuelve a procesar (no extiende dos veces)', () => withToken(async () => {
    await seedPlans()
    const user = await seedSubscriber('real-mp-idem-r32@t.mx')
    const payment = await createPendingPayment(user.id, 39900, 'monthly')

    // 1er webhook: procesa y crea la suscripción
    await processRealPaymentWebhook({
      providerPaymentId: 'MP-IDEM-1',
      fetchFn: (async () => MP_BODY({ external_reference: payment.id })) as unknown as typeof fetch,
    })
    const subs1 = await prisma.subscription.findMany({ where: { userId: user.id } })
    const end1 = subs1[0]!.currentPeriodEnd.getTime()

    // 2ª notificación del MISMO pago de MP: ya procesado → no-op
    const res = await processRealPaymentWebhook({
      providerPaymentId: 'MP-IDEM-1',
      fetchFn: (async () => MP_BODY({ external_reference: payment.id })) as unknown as typeof fetch,
    })
    expect(res).toEqual({ ok: true, action: 'already_processed' })

    const subs2 = await prisma.subscription.findMany({ where: { userId: user.id } })
    expect(subs2).toHaveLength(1)
    expect(subs2[0]!.currentPeriodEnd.getTime()).toBe(end1) // SIN doble extensión
  }))
})
