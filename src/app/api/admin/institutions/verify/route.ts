// R26 — verificación de instituciones (sólo ADMIN, permiso institutions.verify)
// POST /api/admin/institutions/verify { institutionId } → status VERIFIED
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { verifyInstitution } from '@/lib/coordinator'

export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('institutions.verify')
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

  const schema = z.object({ institutionId: z.string().min(1) })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const result = await verifyInstitution({ verifierId: ctx.userId, institutionId: parse.data.institutionId })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Institución no encontrada' ? 404 : 400 })
  }
  return NextResponse.json({ ok: true })
}
