import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { createPaymentPreference, processPaymentWebhook, getEffectivePlan, getUserSubscription } from '@/lib/billing'
import { type PlanCode } from '@/lib/types'
import { logger } from '@/lib/observability'

// Get current subscription & plan
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('billing.subscriptions.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const { planCode, features, subscription } = await getEffectivePlan(ctx.userId)

  return NextResponse.json({
    ok: true,
    plan: {
      code: planCode,
      features,
    },
    subscription: subscription ? {
      id: subscription.id,
      status: subscription.status,
      cadence: subscription.cadence,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    } : null,
  })
}

// Create payment preference for plan upgrade
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

  const result = await createPaymentPreference({
    userId: ctx.userId,
    planCode: parse.data.planCode as PlanCode,
    cadence: parse.data.cadence || 'monthly',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    preferenceId: result.preferenceId,
    initPoint: result.initPoint,
    sandboxInitPoint: result.sandboxInitPoint,
  })
}
