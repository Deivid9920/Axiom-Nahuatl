// R26 — API de instituciones escolares
// GET  /api/coordinator/institutions → lista (admin: todas; otros: VERIFIED + propias PENDING)
// POST /api/coordinator/institutions → solicitar alta { name } (nace PENDING con código)
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { createInstitution, listInstitutionsForUser } from '@/lib/coordinator'
import { logger } from '@/lib/observability'

export async function GET() {
  const authCheck = await requirePermission('groups.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const institutions = await listInstitutionsForUser(ctx.userId, ctx.roles)
  return NextResponse.json({ ok: true, institutions })
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

  const schema = z.object({ name: z.string().min(3).max(120) })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const result = await createInstitution({ requestedById: ctx.userId, name: parse.data.name })
  if (!result.ok) {
    logger.warn('coordinator.institution_create_failed', { user_id: ctx.userId, error: result.error })
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true, institutionId: result.institutionId, verificationCode: result.verificationCode })
}
