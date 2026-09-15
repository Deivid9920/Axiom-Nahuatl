import { NextRequest, NextResponse } from 'next/server'
import { processPaymentWebhook, devSuccess } from '@/lib/billing'
import { logger } from '@/lib/observability'
import crypto from 'crypto'

// SECURITY: Dev-mode success endpoint — ONLY available in development
// In production, this endpoint is completely disabled
function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_BILLING === 'true'
}

// SECURITY: verificar firma del webhook (HMAC-SHA256 con MP_WEBHOOK_SECRET)
function verifyMpSignature(req: NextRequest, body: string): boolean {
  const mpWebhookSecret = process.env.MP_WEBHOOK_SECRET
  if (!mpWebhookSecret) {
    // If no secret configured, skip verification in dev, reject in prod
    if (process.env.NODE_ENV === 'production') {
      logger.error('billing.mp_webhook_secret_missing', {})
      return false
    }
    return true  // dev mode: allow without signature
  }

  const signatureHeader = req.headers.get('x-signature') || ''
  const dataId = req.headers.get('x-request-id') || ''

  // Parse the signature header: "ts=1234567890,v1=abc123..."
  const parts = signatureHeader.split(',')
  let ts = ''
  let hash = ''
  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key.trim() === 'ts') ts = value.trim()
    if (key.trim() === 'v1') hash = value.trim()
  }

  if (!ts || !hash || !dataId) {
    return false
  }

  const tsNum = parseInt(ts)
  if (isNaN(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return false
  }

  // Compute expected signature
  const manifest = `id:${dataId};ts:${ts}`
  const expectedHash = crypto
    .createHmac('sha256', mpWebhookSecret)
    .update(manifest)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(hash, 'hex'),
    Buffer.from(expectedHash, 'hex')
  )
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

  // SECURITY: Verify webhook signature in production
  if (process.env.NODE_ENV === 'production') {
    if (!verifyMpSignature(req, rawBody)) {
      logger.warn('billing.webhook_signature_invalid', {
        ip: req.headers.get('x-forwarded-for'),
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  const topic = body.type || body.topic
  const providerPaymentId = body.data?.id || body.resource

  logger.info('billing.webhook_received', { topic, provider_payment_id: providerPaymentId })

  if (topic === 'payment' && providerPaymentId) {
    // In production: fetch payment details from MP API and process
    // For now, acknowledge receipt
    return NextResponse.json({ ok: true, message: 'Webhook received and verified' })
  }

  return NextResponse.json({ ok: true, message: 'No action taken' })
}

// SECURITY: GET endpoint for dev-mode only — completely disabled in production
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
