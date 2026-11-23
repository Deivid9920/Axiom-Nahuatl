// R26 — métricas agregadas de un grupo
// GET /api/coordinator/groups/[id]/metrics
// Coordinador dueño o admin: acceso total; maestro miembro: lectura de su grupo.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { getGroupMetrics } from '@/lib/coordinator'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('groups.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck
  const { id } = await params

  const result = await getGroupMetrics({ userId: ctx.userId, roles: ctx.roles, groupId: id })
  if (!result.ok) {
    const forbidden = result.error.startsWith('Sólo') || result.error.startsWith('No participas')
    return NextResponse.json({ error: result.error }, { status: forbidden ? 403 : 404 })
  }
  return NextResponse.json({ ok: true, metrics: result.metrics })
}
