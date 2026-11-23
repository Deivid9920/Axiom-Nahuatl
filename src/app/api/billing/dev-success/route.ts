import { NextRequest, NextResponse } from 'next/server'
import { devSuccess } from '@/lib/billing'

// R24 — Confirmación de pago en modo sandbox/desarrollo.
// La preferencia dev de createPaymentPreference apunta aquí cuando no hay
// MERCADO_PAGO_ACCESS_TOKEN; procesa el pago localmente (webhook simulado).
// En producción la ruta queda deshabilitada: los pagos reales llegan por
// /api/billing/webhook con firma de Mercado Pago.

function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_BILLING === 'true'
}

async function handle(paymentId: string | null) {
  if (!isDevMode()) {
    return NextResponse.json({ error: 'Dev mode disabled' }, { status: 403 })
  }
  if (!paymentId) {
    return NextResponse.json({ error: 'Missing paymentId' }, { status: 400 })
  }
  const result = await devSuccess(paymentId)
  return NextResponse.json(result)
}

export async function GET(req: NextRequest) {
  return handle(new URL(req.url).searchParams.get('paymentId'))
}

export async function POST(req: NextRequest) {
  let paymentId: string | null = new URL(req.url).searchParams.get('paymentId')
  if (!paymentId) {
    try {
      const body = await req.json()
      if (body && typeof body.paymentId === 'string') paymentId = body.paymentId
    } catch {
      // sin cuerpo JSON: cae al 400 de handle()
    }
  }
  return handle(paymentId)
}
