// R31-c — alta de preaprobación de Mercado Pago (cobro automático) desde la app.
// El usuario autoriza una vez en el init_point y MP cobra cada periodo; la
// suscripción queda vinculada vía webhook (topic=preapproval) y el ciclo de
// renovación propio deja de cobrarla. En desarrollo (sin token MP) responde con
// el flujo dev del webhook, que activa la suscripción simulando el alta.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { createPreapproval } from '@/lib/billing'
import { type PlanCode } from '@/lib/types'

export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('billing.subscriptions.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    planCode: z.enum(['basico', 'pro', 'equipo', 'enterprise']),
    cadence: z.enum(['monthly', 'annual']).optional(),
  })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const result = await createPreapproval({
    userId: ctx.userId,
    planCode: parse.data.planCode as PlanCode,
    cadence: parse.data.cadence || 'monthly',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    initPoint: result.initPoint,
    preapprovalId: result.preapprovalId ?? null,
    dev: result.dev,
  })
}
