// R35-c — prueba HTTP de la ventana dual de rotación del secreto del webhook.
// A diferencia de mp-signature.test.ts (verificador puro), aquí se ejercita la
// RUTA real POST /api/billing/webhook con NextRequest + cabeceras x-signature,
// tal como llegaría la notificación de Mercado Pago:
//   · Con MP_WEBHOOK_SECRET + MP_WEBHOOK_SECRET_PREVIOUS definidos, una firma
//     hecha con la clave ANTERIOR pasa la puerta de firma (ventana dual abierta).
//   · La clave VIGENTE sigue siendo aceptada durante la ventana.
//   · Al retirar el secreto anterior la ventana se cierra: firma vieja → 401.
//   · Firma incorrecta o ausente → 401 (puerta de firma intacta).
// El cuerpo usa un topic desconocido para que la aserción mida EXACTAMENTE la
// puerta de firma (401 vs 200 «No action taken») sin tocar facturación.
import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/billing/webhook/route'

const SECRET_NEW = 'test-mp-rotacion-nueva'
const SECRET_OLD = 'test-mp-rotacion-anterior'

// Respaldos para restaurar el entorno del proceso al terminar (process.env es
// compartido por toda la corrida de vitest)
const BACKUP = {
  secret: process.env.MP_WEBHOOK_SECRET,
  previous: process.env.MP_WEBHOOK_SECRET_PREVIOUS,
}

beforeEach(() => {
  process.env.MP_WEBHOOK_SECRET = SECRET_NEW
  delete process.env.MP_WEBHOOK_SECRET_PREVIOUS
})

afterEach(() => {
  if (BACKUP.secret === undefined) delete process.env.MP_WEBHOOK_SECRET
  else process.env.MP_WEBHOOK_SECRET = BACKUP.secret
  if (BACKUP.previous === undefined) delete process.env.MP_WEBHOOK_SECRET_PREVIOUS
  else process.env.MP_WEBHOOK_SECRET_PREVIOUS = BACKUP.previous
})

// Firma el manifest vigente (variante id;request-id;ts) con el secreto dado y
// construye la petición HTTP completa que MP enviaría a la ruta.
function signedRequest(opts: {
  secret: string
  dataId?: string
  requestId?: string
  body?: Record<string, unknown>
  omitSignature?: boolean
}): NextRequest {
  const dataId = opts.dataId ?? '424242'
  const requestId = opts.requestId ?? 'req-rotacion-http'
  const ts = Math.floor(Date.now() / 1000) // la ruta usa Date.now(): ts fresco dentro de ±300 s
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts}`
  const v1 = crypto.createHmac('sha256', opts.secret).update(manifest).digest('hex')
  const body = opts.body ?? { type: 'topic.desconocido', data: { id: dataId } }
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-request-id': requestId,
  }
  if (!opts.omitSignature) headers['x-signature'] = `ts=${ts},v1=${v1}`
  return new NextRequest('http://localhost:3000/api/billing/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

describe('R35-c — puerta de firma del webhook a nivel HTTP (ventana dual de rotación)', () => {
  test('firma hecha con la clave ANTERIOR pasa cuando MP_WEBHOOK_SECRET_PREVIOUS está definido (ventana abierta)', async () => {
    process.env.MP_WEBHOOK_SECRET_PREVIOUS = SECRET_OLD
    const res = await POST(signedRequest({ secret: SECRET_OLD }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
    expect(d.message).toBe('No action taken') // topic desconocido: midió exactamente la puerta de firma
  })

  test('la clave VIGENTE sigue siendo aceptada durante la ventana dual', async () => {
    process.env.MP_WEBHOOK_SECRET_PREVIOUS = SECRET_OLD
    const res = await POST(signedRequest({ secret: SECRET_NEW }))
    expect(res.status).toBe(200)
    const d = await res.json()
    expect(d.ok).toBe(true)
  })

  test('retirado el secreto anterior, la firma vieja es rechazada con 401 (ventana cerrada)', async () => {
    // MP_WEBHOOK_SECRET_PREVIOUS sin definir (beforeEach lo elimina)
    const res = await POST(signedRequest({ secret: SECRET_OLD }))
    expect(res.status).toBe(401)
    const d = await res.json()
    expect(d.error).toBe('Invalid signature')
  })

  test('firma hecha con un secreto distinto → 401 aunque haya ventana dual', async () => {
    process.env.MP_WEBHOOK_SECRET_PREVIOUS = SECRET_OLD
    const res = await POST(signedRequest({ secret: 'secreto-intruso' }))
    expect(res.status).toBe(401)
  })

  test('sin cabecera x-signature → 401 (la firma se exige con MP_WEBHOOK_SECRET definido)', async () => {
    const res = await POST(signedRequest({ secret: SECRET_NEW, omitSignature: true }))
    expect(res.status).toBe(401)
  })

  test('cuerpo no JSON → 400 (validación previa a la firma intacta)', async () => {
    const req = new NextRequest('http://localhost:3000/api/billing/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{esto-no-es-json',
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const d = await res.json()
    expect(d.error).toBe('JSON inválido')
  })
})
