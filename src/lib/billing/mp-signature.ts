// R33-d — verificación de la firma HMAC-SHA256 de los webhooks de Mercado Pago.
// Extraída como módulo puro y testeable (la ruta del webhook la usa en producción
// y — novedad R33 — también en desarrollo cuando MP_WEBHOOK_SECRET está definido).
//
// Formato del header x-signature de MP: "ts=1234567890,v1=abcdef..."
// El HMAC se calcula sobre un "manifest". MP ha documentado dos variantes:
//   id:{data.id};request-id:{x-request-id};ts:{ts}   (vigente)
//   id:{data.id};ts:{ts}                              (variante histórica)
// El data.id del manifest es el ID del recurso notificado (query ?data.id=, cuerpo
// data.id o, como reserva, el header x-request-id). Se verifica contra los
// candidatos × ambas variantes: si alguna coincide, la firma es válida.
// Tolerancia de ts: ±300 s (protección anti-replay, comportamiento preexistente).
//
// R34-d — ventana de rotación: verifyMpSignature acepta un `previousSecret`
// opcional (env MP_WEBHOOK_SECRET_PREVIOUS). Durante la rotación documentada en
// docs/operacion/rotacion-mp-webhook-secret.md, los webhooks firmados con la
// clave VIEJA siguen siendo válidos mientras ambos secretos estén configurados;
// al retirar el previo la ventana se cierra. Sin la variable el comportamiento
// es idéntico al de R33 (cero cambios).
import crypto from 'crypto'

export const MP_SIGNATURE_TOLERANCE_SECONDS = 300

export interface MpSignatureInput {
  secret: string
  previousSecret?: string     // R34-d — secreto anterior durante la ventana de rotación
  signatureHeader: string
  dataIdCandidates: string[] // candidatos del data.id del manifest (query/body/x-request-id)
  requestId?: string         // header x-request-id (para la variante vigente)
  nowMs?: number             // inyectable para pruebas (por defecto Date.now())
}

export function parseMpSignature(header: string): { ts: string; v1: string } | null {
  let ts = ''
  let hash = ''
  for (const part of header.split(',')) {
    const [key, ...rest] = part.split('=')
    const value = rest.join('=').trim()
    if (key.trim() === 'ts') ts = value
    if (key.trim() === 'v1') hash = value
  }
  if (!ts || !hash) return null
  return { ts, v1: hash }
}

// Comparación en tiempo constante segura: timingSafeEqual lanza (DoS → 500) si
// las longitudes difieren o el valor no es hex válido; aquí se degrada a false.
function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'hex')
    const bufB = Buffer.from(b, 'hex')
    if (bufA.length !== bufB.length || bufA.length === 0) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

function hmacHex(manifest: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex')
}

export function verifyMpSignature(opts: MpSignatureInput): boolean {
  const parsed = parseMpSignature(opts.signatureHeader)
  if (!parsed) return false

  const { ts, v1 } = parsed
  const tsNum = parseInt(ts, 10)
  if (Number.isNaN(tsNum)) return false
  const nowSec = Math.floor((opts.nowMs ?? Date.now()) / 1000)
  if (Math.abs(nowSec - tsNum) > MP_SIGNATURE_TOLERANCE_SECONDS) return false

  // Manifests a probar: ambas variantes documentadas × cada candidato de data.id
  const candidates = opts.dataIdCandidates.filter(id => id && id.length > 0)
  if (candidates.length === 0) return false

  // R34-d — secretos aceptados: el vigente y, si está configurado, el anterior
  // (ventana de rotación sin caída de entrega de webhooks)
  const secrets = opts.previousSecret && opts.previousSecret !== opts.secret
    ? [opts.secret, opts.previousSecret]
    : [opts.secret]

  for (const dataId of candidates) {
    const manifests = opts.requestId
      ? [
          `id:${dataId};request-id:${opts.requestId};ts:${ts}`,
          `id:${dataId};ts:${ts}`,
        ]
      : [`id:${dataId};ts:${ts}`]
    for (const manifest of manifests) {
      for (const secret of secrets) {
        if (timingSafeEqualHex(v1, hmacHex(manifest, secret))) return true
      }
    }
  }
  return false
}
