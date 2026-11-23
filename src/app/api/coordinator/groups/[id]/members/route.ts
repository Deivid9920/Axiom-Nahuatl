// R25 — API de coordinación: membresías de un grupo
// POST   /api/coordinator/groups/[id]/members  → agregar { email, roleInGroup }
// DELETE /api/coordinator/groups/[id]/members?userId=... → remover
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { addMember, removeMember, type RoleInGroup } from '@/lib/coordinator'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('groups.manage')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck
  const { id } = await params

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    email: z.string().email(),
    roleInGroup: z.enum(['student', 'maestro']).default('student'),
  })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const result = await addMember({
    coordinatorId: ctx.userId,
    groupId: id,
    email: parse.data.email,
    roleInGroup: parse.data.roleInGroup as RoleInGroup,
  })
  if (!result.ok) {
    const forbidden = result.error.startsWith('Sólo')
    return NextResponse.json({ error: result.error }, { status: forbidden ? 403 : 400 })
  }
  return NextResponse.json({ ok: true, memberId: result.memberId })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requirePermission('groups.manage')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck
  const { id } = await params

  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'Falta userId' }, { status: 400 })
  }

  const result = await removeMember({ coordinatorId: ctx.userId, groupId: id, userId })
  if (!result.ok) {
    const forbidden = result.error.startsWith('Sólo')
    return NextResponse.json({ error: result.error }, { status: forbidden ? 403 : 404 })
  }
  return NextResponse.json({ ok: true })
}
