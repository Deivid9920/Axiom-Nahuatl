// R30-b — servicio de correo: registro en EmailLog en desarrollo + idempotencia
// por dedupeKey (el mismo aviso no se envía dos veces aunque el ciclo repita).
import { describe, test, expect } from 'vitest'
import { sendEmail, renewalNoticeEmail, renewalReceiptEmail, renewalFailedEmail } from '@/lib/notifications/email'
import { prisma } from '../setup'

describe('R30-b — sendEmail: registro con idempotencia', () => {
  test('sin proveedor configurado → status dev_logged y fila auditable en EmailLog', async () => {
    const user = await prisma.user.create({
      data: { email: 'mail@t.mx', passwordHash: 'hash', profile: { create: {} } },
    })
    const result = await sendEmail({
      to: 'mail@t.mx',
      userId: user.id,
      subject: 'Axiom: prueba',
      body: 'cuerpo de prueba',
      kind: 'renewal_notice',
      dedupeKey: 'test:dedupe:1',
      relatedType: 'subscription',
      relatedId: 'sub-xyz',
    })
    if (!result.ok) throw new Error('sendEmail falló')
    expect(result.status).toBe('dev_logged')
    expect(result.duplicate).toBe(false)

    const row = await prisma.emailLog.findUnique({ where: { dedupeKey: 'test:dedupe:1' } })
    expect(row).not.toBeNull()
    expect(row!.to).toBe('mail@t.mx')
    expect(row!.kind).toBe('renewal_notice')
    expect(row!.relatedId).toBe('sub-xyz')
  })

  test('misma dedupeKey → skipped (duplicate) y NO crea segunda fila', async () => {
    await sendEmail({ to: 'a@t.mx', subject: 's1', body: 'b', kind: 'renewal_notice', dedupeKey: 'test:dedupe:2' })
    const second = await sendEmail({ to: 'a@t.mx', subject: 's1 otra vez', body: 'b', kind: 'renewal_notice', dedupeKey: 'test:dedupe:2' })
    if (!second.ok) throw new Error('sendEmail falló')
    expect(second.duplicate).toBe(true)
    expect(second.status).toBe('skipped')
    const rows = await prisma.emailLog.findMany({ where: { dedupeKey: 'test:dedupe:2' } })
    expect(rows).toHaveLength(1)
  })

  test('dedupeKey distinta → sí crea fila nueva', async () => {
    await sendEmail({ to: 'b@t.mx', subject: 's', body: 'b', kind: 'renewal_notice', dedupeKey: 'test:dedupe:3a' })
    await sendEmail({ to: 'b@t.mx', subject: 's', body: 'b', kind: 'renewal_notice', dedupeKey: 'test:dedupe:3b' })
    const rows = await prisma.emailLog.findMany({ where: { dedupeKey: { startsWith: 'test:dedupe:3' } } })
    expect(rows).toHaveLength(2)
  })

  test('sin dedupeKey → siempre registra (ej. recibos por pago distinto)', async () => {
    await sendEmail({ to: 'c@t.mx', subject: 's', body: 'b', kind: 'renewal_receipt' })
    await sendEmail({ to: 'c@t.mx', subject: 's', body: 'b', kind: 'renewal_receipt' })
    const rows = await prisma.emailLog.findMany({ where: { to: 'c@t.mx', kind: 'renewal_receipt' } })
    expect(rows).toHaveLength(2)
  })
})

describe('R30-b — plantillas de correo (español)', () => {
  test('aviso warning con autoRenew habla de renovación automática', () => {
    const tpl = renewalNoticeEmail({
      planName: 'Pro',
      daysLeft: 5,
      level: 'warning',
      autoRenew: true,
      periodEnd: new Date('2026-10-14T12:00:00.000Z'),
    })
    expect(tpl.subject).toContain('Pro')
    expect(tpl.subject).toContain('5 días')
    expect(tpl.body).toContain('renovación automática')
    expect(tpl.body).toContain('14 de octubre de 2026')
  })

  test('aviso expirado sin autoRenew pide renovación manual', () => {
    const tpl = renewalNoticeEmail({
      planName: 'Básico',
      daysLeft: 0,
      level: 'expired',
      autoRenew: false,
      periodEnd: new Date('2026-10-08T12:00:00.000Z'),
    })
    expect(tpl.subject).toContain('ha vencido')
    expect(tpl.body).toContain('renueva manualmente')
  })

  test('recibo con monto en MXN y fecha de vigencia', () => {
    const tpl = renewalReceiptEmail({
      planName: 'Pro',
      amountMxnCents: 39900,
      cadence: 'monthly',
      newPeriodEnd: new Date('2026-11-08T12:00:00.000Z'),
    })
    expect(tpl.subject).toContain('renovación confirmada')
    expect(tpl.body).toContain('$399.00 MXN')
    expect(tpl.body).toContain('8 de noviembre de 2026')
  })

  test('aviso de cobro fallido menciona el estado «pago pendiente»', () => {
    const tpl = renewalFailedEmail({ planName: 'Pro', reason: 'funds_insufficient' })
    expect(tpl.subject).toContain('no pudimos procesar')
    expect(tpl.body).toContain('pago pendiente')
    expect(tpl.body).toContain('funds_insufficient')
  })
})
