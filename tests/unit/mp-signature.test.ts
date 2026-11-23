// R33-d — verificación HMAC-SHA256 de la firma de webhooks de Mercado Pago.
// Cubre: parseo del header x-signature, firma válida en ambas variantes del
// manifest (con y sin request-id), firma incorrecta, ts fuera de tolerancia
// (anti-replay), header malformado y hash no-hex (degrada a false sin lanzar,
// antes era un 500 por timingSafeEqual).
import { describe, test, expect } from 'vitest'
import crypto from 'crypto'
import { verifyMpSignature, parseMpSignature, MP_SIGNATURE_TOLERANCE_SECONDS } from '@/lib/billing/mp-signature'

const SECRET = 'test-mp-webhook-secret-r33'

function sign(manifest: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex')
}

function headerFor(manifest: string, ts: number, secret?: string): string {
  return `ts=${ts},v1=${sign(manifest, secret)}`
}

const NOW_MS = 1_760_000_000_000 // fecha fija para pruebas deterministas
const NOW_SEC = Math.floor(NOW_MS / 1000)

describe('R33-d — parseMpSignature', () => {
  test('extrae ts y v1 del header; null si falta alguno', () => {
    expect(parseMpSignature('ts=123,v1=abc')).toEqual({ ts: '123', v1: 'abc' })
    expect(parseMpSignature('v1=abc')).toBeNull()
    expect(parseMpSignature('ts=123')).toBeNull()
    expect(parseMpSignature('')).toBeNull()
  })
})

describe('R33-d — verifyMpSignature', () => {
  const dataIdCandidates = ['1234567890']
  const requestId = 'req-id-xyz'

  test('firma válida en la variante vigente (id;request-id;ts)', () => {
    const manifest = `id:1234567890;request-id:${requestId};ts:${NOW_SEC}`
    const ok = verifyMpSignature({
      secret: SECRET,
      signatureHeader: headerFor(manifest, NOW_SEC),
      dataIdCandidates,
      requestId,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(true)
  })

  test('firma válida en la variante histórica (id;ts) sin request-id', () => {
    const manifest = `id:1234567890;ts:${NOW_SEC}`
    const ok = verifyMpSignature({
      secret: SECRET,
      signatureHeader: headerFor(manifest, NOW_SEC),
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(true)
  })

  test('firma válida aunque el candidato venga del body (dataIdCandidates múltiples)', () => {
    const manifest = `id:del-body;ts:${NOW_SEC}`
    const ok = verifyMpSignature({
      secret: SECRET,
      signatureHeader: headerFor(manifest, NOW_SEC),
      dataIdCandidates: ['de-la-query', 'del-body', requestId],
      requestId,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(true)
  })

  test('firma incorrecta (secret distinto) → false', () => {
    const manifest = `id:1234567890;ts:${NOW_SEC}`
    const ok = verifyMpSignature({
      secret: SECRET,
      signatureHeader: headerFor(manifest, NOW_SEC, 'otro-secreto'),
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(false)
  })

  test('ts fuera de tolerancia (replay) → false', () => {
    const oldSec = NOW_SEC - MP_SIGNATURE_TOLERANCE_SECONDS - 60
    const manifest = `id:1234567890;ts:${oldSec}`
    const ok = verifyMpSignature({
      secret: SECRET,
      signatureHeader: headerFor(manifest, oldSec),
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(false)
  })

  test('header malformado y sin candidatos → false sin lanzar', () => {
    const base = { secret: SECRET, nowMs: NOW_MS }
    expect(verifyMpSignature({ ...base, signatureHeader: 'no-tiene-nada', dataIdCandidates })).toBe(false)
    expect(verifyMpSignature({ ...base, signatureHeader: `ts=${NOW_SEC},v1=${'0'.repeat(64)}`, dataIdCandidates: [] })).toBe(false)
    expect(verifyMpSignature({ ...base, signatureHeader: 'ts=abc,v1=xyz', dataIdCandidates })).toBe(false)
  })

  test('hash no-hex / longitud distinta → false sin lanzar (antes 500)', () => {
    const ok1 = verifyMpSignature({
      secret: SECRET,
      signatureHeader: `ts=${NOW_SEC},v1=no-es-hexadecimal`,
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok1).toBe(false)
    const ok2 = verifyMpSignature({
      secret: SECRET,
      signatureHeader: `ts=${NOW_SEC},v1=abcd`, // hex válido pero longitud incorrecta
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok2).toBe(false)
  })

  test('ts no numérico → false', () => {
    const ok = verifyMpSignature({
      secret: SECRET,
      signatureHeader: `ts=NaN,v1=${sign(`id:1234567890;ts:NaN`)}`,
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(false)
  })
})

// R34-d — ventana de rotación: mientras MP_WEBHOOK_SECRET_PREVIOUS esté
// configurado, las firmas hechas con la clave ANTERIOR siguen siendo válidas;
// al retirar el previo se rechazan (comportamiento R33 intacto).
describe('R34-d — verifyMpSignature con previousSecret (ventana de rotación)', () => {
  const OLD_SECRET = 'test-mp-webhook-secret-vieja'
  const dataIdCandidates = ['1234567890']

  test('firma hecha con la clave anterior → válida durante la ventana dual', () => {
    const manifest = `id:1234567890;request-id:req-rot;ts:${NOW_SEC}`
    const ok = verifyMpSignature({
      secret: SECRET,
      previousSecret: OLD_SECRET,
      signatureHeader: headerFor(manifest, NOW_SEC, OLD_SECRET),
      dataIdCandidates,
      requestId: 'req-rot',
      nowMs: NOW_MS,
    })
    expect(ok).toBe(true)
  })

  test('firma hecha con la clave anterior → rechazada sin previousSecret (ventana cerrada)', () => {
    const manifest = `id:1234567890;ts:${NOW_SEC}`
    const ok = verifyMpSignature({
      secret: SECRET,
      signatureHeader: headerFor(manifest, NOW_SEC, OLD_SECRET),
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(false)
  })

  test('la clave vigente sigue siendo aceptada durante la ventana dual', () => {
    const manifest = `id:1234567890;ts:${NOW_SEC}`
    const ok = verifyMpSignature({
      secret: SECRET,
      previousSecret: OLD_SECRET,
      signatureHeader: headerFor(manifest, NOW_SEC, SECRET),
      dataIdCandidates,
      nowMs: NOW_MS,
    })
    expect(ok).toBe(true)
  })
})
