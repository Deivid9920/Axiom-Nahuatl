import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { getUserPlan } from '@/lib/adaptive'

// GET: plan de los 10 módulos CEFR del usuario — tarjetas del Inicio con
// progreso, desbloqueo dinámico (módulo anterior + métricas) y temas por módulo.
export async function GET() {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const plan = await getUserPlan(authCheck.ctx.userId)
  if (!plan) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, ...plan })
}
