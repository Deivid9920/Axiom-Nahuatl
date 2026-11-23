// R28 — revocación de documentos emitidos (sólo ADMIN, permiso documents.revoke)
// POST /api/admin/issued-docs/revoke { folio, reason? }
// Idempotente: revocar un documento ya revocado no cambia nada.
// La página pública /verificar/[folio] pasa a mostrar «Documento revocado».
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { revokeIssuedDocument } from '@/lib/issued-docs'

export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('documents.revoke')
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
    folio: z.string().min(1).max(40),
    reason: z.string().max(200).optional(),
  })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const result = await revokeIssuedDocument({
    actorId: ctx.userId,
    folio: parse.data.folio,
    reason: parse.data.reason,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Documento no encontrado' ? 404 : 400 })
  }
  return NextResponse.json({ ok: true, alreadyRevoked: Boolean(result.alreadyRevoked) })
}
