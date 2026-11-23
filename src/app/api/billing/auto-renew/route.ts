// R29-c — renovación automática: el usuario activa/desactiva la renovación de SU
// propia suscripción activa. Sin permiso especial: billing.subscriptions.read es el
// permiso que ya gobierna leer la suscripción propia, y aquí sólo se toca la propia.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { getUserSubscription } from '@/lib/billing'
import { db } from '@/lib/db'
import { audit } from '@/lib/observability'

export async function PATCH(req: NextRequest) {
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

  const schema = z.object({ autoRenew: z.boolean() })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'autoRenew debe ser booleano' }, { status: 400 })
  }

  const sub = await getUserSubscription(ctx.userId)
  if (!sub) {
    return NextResponse.json({ error: 'No tienes una suscripción activa' }, { status: 404 })
  }

  await db.subscription.update({
    where: { id: sub.id },
    data: { autoRenew: parse.data.autoRenew },
  })
  await audit('billing.auto_renew_changed', {
    userId: ctx.userId,
    resourceType: 'subscription',
    resourceId: sub.id,
    metadata: { autoRenew: parse.data.autoRenew },
  })

  return NextResponse.json({ ok: true, autoRenew: parse.data.autoRenew })
}
