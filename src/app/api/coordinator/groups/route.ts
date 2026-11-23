// R25 — API de coordinación: listar y crear grupos
// GET  /api/coordinator/groups  → grupos del coordinador (o grupos donde es maestro, sólo lectura)
// POST /api/coordinator/groups  → crear grupo { name, institutionId? }
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { listGroupsForUser, createGroup, listVerifiedInstitutions } from '@/lib/coordinator'
import { logger } from '@/lib/observability'

export async function GET() {
  const authCheck = await requirePermission('groups.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const groups = await listGroupsForUser(ctx.userId, ctx.roles)
  const institutions = await listVerifiedInstitutions()

  return NextResponse.json({ ok: true, groups, institutions })
}

export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('groups.manage')
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
    name: z.string().min(2).max(80),
    institutionId: z.string().min(1).optional().nullable(),
  })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const result = await createGroup({
    coordinatorId: ctx.userId,
    name: parse.data.name,
    institutionId: parse.data.institutionId ?? null,
  })
  if (!result.ok) {
    logger.warn('coordinator.group_create_failed', { user_id: ctx.userId, error: result.error })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, groupId: result.groupId })
}
