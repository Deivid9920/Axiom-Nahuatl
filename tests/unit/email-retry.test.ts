// R32-b — cola de reintentos de correos fallidos.
// Cubre: el calendario puro (nextEmailRetry), el alta en cola al fallar el envío
// (sendEmail con Resend fallando vía fetch simulado) y processEmailRetries
// (éxito actualiza la MISMA fila, fallo re-agenda con backoff, agotado terminal,
// y no toca correos cuyo reintento aún no vence).
// R33-b — retryEmailNow: reintento manual de un correo concreto (éxito, re-agenda,
// terminal, not_retryable y not_found).
import { describe, test, expect, vi, afterEach } from 'vitest'
import { sendEmail, processEmailRetries, retryEmailNow, nextEmailRetry, EMAIL_RETRY_SCHEDULE_MINUTES } from '@/lib/notifications/email'
import { prisma } from '../setup'

const MIN_MS = 60_000

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.RESEND_API_KEY
  vi.restoreAllMocks()
})

describe('R32-b — nextEmailRetry (calendario puro)', () => {
  test('agenda 5/30/120 min según los intentos fallidos y agota al final', () => {
    const from = new Date('2026-01-10T12:00:00.000Z')
    expect(EMAIL_RETRY_SCHEDULE_MINUTES).toEqual([5, 30, 120])

    const r0 = nextEmailRetry(0, from)
    expect(r0.exhausted).toBe(false)
    expect(r0.nextRetryAt!.getTime()).toBe(from.getTime() + 5 * MIN_MS)

    const r1 = nextEmailRetry(1, from)
    expect(r1.exhausted).toBe(false)
    expect(r1.nextRetryAt!.getTime()).toBe(from.getTime() + 30 * MIN_MS)

    const r2 = nextEmailRetry(2, from)
    expect(r2.exhausted).toBe(false)
    expect(r2.nextRetryAt!.getTime()).toBe(from.getTime() + 120 * MIN_MS)

    const r3 = nextEmailRetry(3, from)
    expect(r3.exhausted).toBe(true)
    expect(r3.nextRetryAt).toBeNull()
  })
})

describe('R32-b — sendEmail encola el reintento cuando el envío falla', () => {
  test('con RESEND_API_KEY y Resend caído, la fila queda failed con nextRetryAt a 5 min y lastError', async () => {
    const tokenAntes = process.env.RESEND_API_KEY
    process.env.RESEND_API_KEY = 'test-key-r32'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))

    try {
      const res = await sendEmail({
        to: 'falla-r32@t.mx',
        subject: 'Aviso que fallará',
        body: 'cuerpo',
        kind: 'renewal_notice',
        dedupeKey: `r32-queue:${Date.now()}`,
      })
      // El envío falló: el resultado es veraz (ok:false) y la fila quedó en cola
      expect(res.ok).toBe(false)
      if (res.ok) throw new Error('inesperado')
      expect(res.error).toBe('resend_error_500')

      const saved = await prisma.emailLog.findFirst({ where: { to: 'falla-r32@t.mx' }, orderBy: { createdAt: 'desc' } })
      expect(saved).not.toBeNull()
      expect(saved!.status).toBe('failed')
      expect(saved!.retryCount).toBe(1)
      expect(saved!.lastError).toBe('resend_error_500')
      expect(saved!.nextRetryAt).not.toBeNull()
      const drift = Math.abs(saved!.nextRetryAt!.getTime() - Date.now() - 5 * MIN_MS)
      expect(drift).toBeLessThan(15_000)
    } finally {
      if (tokenAntes === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = tokenAntes
    }
  })
})

describe('R32-b — processEmailRetries (cola con reintentos)', () => {
  test('re-envío exitoso actualiza la MISMA fila (status sent, nextRetryAt null)', async () => {
    const created = await prisma.emailLog.create({
      data: {
        to: 'reintento-ok-r32@t.mx',
        subject: 'Reintento OK',
        body: 'cuerpo',
        kind: 'renewal_failed',
        status: 'failed',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() - 10 * MIN_MS),
        lastError: 'resend_error_500',
      },
    })

    const result = await processEmailRetries({
      sender: async () => ({ status: 'sent', failure: null }),
    })

    expect(result.scanned).toBeGreaterThanOrEqual(1)
    expect(result.succeeded).toBeGreaterThanOrEqual(1)
    const updated = await prisma.emailLog.findUnique({ where: { id: created.id } })
    expect(updated!.status).toBe('sent')
    expect(updated!.sentAt).not.toBeNull()
    expect(updated!.nextRetryAt).toBeNull()
    expect(updated!.lastError).toBeNull()
    expect(updated!.retryCount).toBe(1) // se conserva como historial
  })

  test('re-envío fallido re-agenda con backoff y aumenta retryCount', async () => {
    const created = await prisma.emailLog.create({
      data: {
        to: 'reintento-falla-r32@t.mx',
        subject: 'Reintento falla',
        body: 'cuerpo',
        kind: 'renewal_failed',
        status: 'failed',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() - 5 * MIN_MS),
        lastError: 'resend_error_500',
      },
    })

    const before = Date.now()
    const result = await processEmailRetries({
      sender: async () => ({ status: 'failed', failure: 'resend_error_503' }),
    })
    expect(result.failed).toBeGreaterThanOrEqual(1)

    const updated = await prisma.emailLog.findUnique({ where: { id: created.id } })
    expect(updated!.status).toBe('failed')
    expect(updated!.retryCount).toBe(2)
    expect(updated!.lastError).toBe('resend_error_503')
    expect(updated!.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(before + 30 * MIN_MS - 15_000)
  })

  test('calendario agotado deja la fila terminal (failed sin nextRetryAt)', async () => {
    const created = await prisma.emailLog.create({
      data: {
        to: 'reintento-agotado-r32@t.mx',
        subject: 'Reintento agotado',
        body: 'cuerpo',
        kind: 'renewal_failed',
        status: 'failed',
        retryCount: 3, // ya agotó el calendario en un fallo previo
        nextRetryAt: new Date(Date.now() - 2 * 60 * MIN_MS),
        lastError: 'resend_error_500',
      },
    })

    const result = await processEmailRetries({
      sender: async () => ({ status: 'failed', failure: 'resend_error_503' }),
    })
    expect(result.exhausted).toBeGreaterThanOrEqual(1)

    const updated = await prisma.emailLog.findUnique({ where: { id: created.id } })
    expect(updated!.status).toBe('failed')
    expect(updated!.nextRetryAt).toBeNull() // terminal: ya no se re-agenda
    expect(updated!.retryCount).toBe(3) // sin más intentos contados
  })

  test('un correo con reintento a futuro no se toca (scanned lo excluye)', async () => {
    await prisma.emailLog.create({
      data: {
        to: 'reintento-futuro-r32@t.mx',
        subject: 'Aún no toca',
        body: 'cuerpo',
        kind: 'renewal_notice',
        status: 'failed',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() + 60 * MIN_MS), // a futuro
        lastError: 'resend_error_500',
      },
    })

    const result = await processEmailRetries({
      sender: async () => ({ status: 'sent', failure: null }),
    })
    expect(result.scanned).toBe(0)

    const untouched = await prisma.emailLog.findFirst({ where: { to: 'reintento-futuro-r32@t.mx' } })
    expect(untouched!.status).toBe('failed')
    expect(untouched!.nextRetryAt).not.toBeNull()
  })
})

describe('R33-b — retryEmailNow (reintento manual de un correo concreto)', () => {
  test('éxito: la misma fila pasa a enviada (sentAt, nextRetryAt null, lastError null)', async () => {
    const created = await prisma.emailLog.create({
      data: {
        to: 'manual-ok-r33@t.mx',
        subject: 'Reintento manual OK',
        body: 'cuerpo',
        kind: 'renewal_receipt',
        status: 'failed',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() + 30 * MIN_MS), // aún sin vencer: el manual no espera
        lastError: 'resend_error_500',
      },
    })

    const res = await retryEmailNow(created.id, { sender: async () => ({ status: 'sent', failure: null }) })

    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('inesperado')
    expect(res.status).toBe('sent')
    const updated = await prisma.emailLog.findUnique({ where: { id: created.id } })
    expect(updated!.status).toBe('sent')
    expect(updated!.sentAt).not.toBeNull()
    expect(updated!.nextRetryAt).toBeNull()
    expect(updated!.lastError).toBeNull()
    expect(updated!.retryCount).toBe(1) // historial intacto
  })

  test('fallo: re-agenda con backoff y aumenta retryCount', async () => {
    const created = await prisma.emailLog.create({
      data: {
        to: 'manual-falla-r33@t.mx',
        subject: 'Reintento manual falla',
        body: 'cuerpo',
        kind: 'renewal_failed',
        status: 'failed',
        retryCount: 1,
        nextRetryAt: new Date(Date.now() + 30 * MIN_MS),
        lastError: 'resend_error_500',
      },
    })

    const before = Date.now()
    const res = await retryEmailNow(created.id, { sender: async () => ({ status: 'failed', failure: 'resend_error_503' }) })

    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('inesperado')
    expect(res.rescheduled).toBe(true)
    const updated = await prisma.emailLog.findUnique({ where: { id: created.id } })
    expect(updated!.retryCount).toBe(2)
    expect(updated!.lastError).toBe('resend_error_503')
    expect(updated!.nextRetryAt!.getTime()).toBeGreaterThanOrEqual(before + 30 * MIN_MS - 15_000)
  })

  test('fallo con calendario agotado: terminal (nextRetryAt null) y exhausted', async () => {
    const created = await prisma.emailLog.create({
      data: {
        to: 'manual-agotado-r33@t.mx',
        subject: 'Reintento manual agotado',
        body: 'cuerpo',
        kind: 'renewal_failed',
        status: 'failed',
        retryCount: 3, // ya agotó el calendario en fallos previos
        nextRetryAt: null,
        lastError: 'resend_error_500',
      },
    })

    const res = await retryEmailNow(created.id, { sender: async () => ({ status: 'failed', failure: 'resend_error_502' }) })

    expect(res.ok).toBe(false)
    if (res.ok) throw new Error('inesperado')
    expect('exhausted' in res && res.exhausted === true).toBe(true)
    const updated = await prisma.emailLog.findUnique({ where: { id: created.id } })
    expect(updated!.status).toBe('failed')
    expect(updated!.nextRetryAt).toBeNull()
    expect(updated!.retryCount).toBe(3) // sin más intentos contados
    expect(updated!.lastError).toBe('resend_error_502')
  })

  test('not_retryable: un correo ya enviado no se re-envía; inexistente → not_found', async () => {
    const sent = await prisma.emailLog.create({
      data: {
        to: 'manual-enviado-r33@t.mx',
        subject: 'Ya enviado',
        body: 'cuerpo',
        kind: 'renewal_notice',
        status: 'sent',
        sentAt: new Date(),
      },
    })

    const r1 = await retryEmailNow(sent.id, { sender: async () => ({ status: 'sent', failure: null }) })
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.error).toBe('not_retryable')

    const r2 = await retryEmailNow('id-inexistente-r33')
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error).toBe('not_found')
  })
})
