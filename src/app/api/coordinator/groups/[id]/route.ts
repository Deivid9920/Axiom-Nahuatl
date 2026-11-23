// R25 — API de coordinación: eliminar grupo (sólo el coordinador creador)
// DELETE /api/coordinator/groups/[id]
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { deleteGroup } from '@/lib/coordinator'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('groups.manage')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck
  const { id } = await params

  const result = await deleteGroup({ coordinatorId: ctx.userId, groupId: id })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error.includes('Sólo') ? 403 : 404 })
  }
  return NextResponse.json({ ok: true })
}
