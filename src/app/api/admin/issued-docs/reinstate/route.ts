// R29-b — reversión de revocaciones (sólo ADMIN, permiso documents.revoke)
// POST /api/admin/issued-docs/reinstate { folio }
// El documento recupera su validez: /verificar/[folio] vuelve a «Documento válido».
// Idempotente: reinstaurar un documento vigente no cambia nada (wasRevoked: false).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { reinstateIssuedDocument } from '@/lib/issued-docs'

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
  })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const result = await reinstateIssuedDocument({
    actorId: ctx.userId,
    folio: parse.data.folio,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Documento no encontrado' ? 404 : 400 })
  }
  return NextResponse.json({ ok: true, wasRevoked: result.wasRevoked })
}
