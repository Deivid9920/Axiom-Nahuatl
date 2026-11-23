import { NextRequest, NextResponse } from 'next/server'
import { processPaymentWebhook, devSuccess, processPreapprovalWebhook, processRealPaymentWebhook } from '@/lib/billing'
import { verifyMpSignature } from '@/lib/billing/mp-signature'
import { logger } from '@/lib/observability'

function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_BILLING === 'true'
}

// Mercado Pago webhook receiver
export async function POST(req: NextRequest) {
  // SECURITY: Read raw body for signature verification
  const rawBody = await req.text()

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const url = new URL(req.url)
  const isDev = url.searchParams.get('dev') === '1'
  const paymentId = url.searchParams.get('paymentId')

  // SECURITY: Dev-mode success only in development
  if (isDev && paymentId) {
    if (!isDevMode()) {
      return NextResponse.json({ error: 'Dev mode disabled' }, { status: 403 })
    }
    const result = await devSuccess(paymentId)
    return NextResponse.json(result)
  }

  // R33-d — firma HMAC opcional también en dev: con MP_WEBHOOK_SECRET definido la
  // firma se exige SIEMPRE (desarrollo incluido); sin secret, dev permite sin firma
  // (flujo de pruebas) y producción rechaza como antes. El verificador es puro y
  // acepta ambas variantes del manifest documentadas por MP; una firma malformada
  // degrada a 401 (antes un hash no-hex lanzaba y producía un 500).
  // R34-d — ventana de rotación: mientras MP_WEBHOOK_SECRET_PREVIOUS esté
  // definido, también se aceptan firmas hechas con la clave anterior
  // (runbook completo en docs/operacion/rotacion-mp-webhook-secret.md).
  const mpWebhookSecret = process.env.MP_WEBHOOK_SECRET
  if (mpWebhookSecret) {
    const dataIdCandidates = [
      url.searchParams.get('data.id') || '',
      body?.data?.id ? String(body.data.id) : '',
      req.headers.get('x-request-id') || '',
    ].filter(id => id.length > 0)
    const signatureValid = verifyMpSignature({
      secret: mpWebhookSecret,
      previousSecret: process.env.MP_WEBHOOK_SECRET_PREVIOUS || undefined,
      signatureHeader: req.headers.get('x-signature') || '',
      dataIdCandidates,
      requestId: req.headers.get('x-request-id') || undefined,
    })
    if (!signatureValid) {
      logger.warn('billing.webhook_signature_invalid', {
        ip: req.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.error('billing.mp_webhook_secret_missing', {})
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const topic = body.type || body.topic
  const providerPaymentId = body.data?.id || body.resource

  logger.info('billing.webhook_received', { topic, provider_payment_id: providerPaymentId })

  if (topic === 'payment' && providerPaymentId) {
    // R32-c — pago real de MP: se consulta GET /v1/payments/{data.id} para validar
    // estado/external_reference y se procesa con la lógica interna completa.
    // Sin token (dev) processRealPaymentWebhook responde dev_skip sin acción.
    const result = await processRealPaymentWebhook({ providerPaymentId: String(providerPaymentId) })
    return NextResponse.json({ ok: result.ok, action: result.action ?? null })
  }

  // R31-c — notificaciones de preaprobación (alta de cobro automático):
  // authorized vincula la suscripción a MP; cancelled/paused la dan de baja.
  if (topic === 'preapproval' && providerPaymentId) {
    const result = await processPreapprovalWebhook({ preapprovalId: String(providerPaymentId) })
    return NextResponse.json({ ok: result.ok, action: result.action ?? null })
  }

  return NextResponse.json({ ok: true, message: 'No action taken' })
}

export async function GET(req: NextRequest) {
  if (!isDevMode()) {
    return NextResponse.json({ error: 'Not available' }, { status: 403 })
  }

  const url = new URL(req.url)
  const paymentId = url.searchParams.get('paymentId')
  if (paymentId) {
    const result = await devSuccess(paymentId)
    return NextResponse.json(result)
  }
  return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 })
}
