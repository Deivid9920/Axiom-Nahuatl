// R27 — emisión del documento formal con folio en BD
// POST /api/issued-docs/issue
// Cualquier usuario puede emitir SU reporte; emitir el de otro requiere admin.users.read
// (el flujo del panel admin emite con la sesión del administrador/coordinador).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthContext, hasPermission } from '@/lib/auth'
import { issueReportDocument } from '@/lib/issued-docs'

const schema = z.object({
  userId: z.string().min(1),
  holderName: z.string().max(120).default(''),
  holderEmail: z.string().email(),
  windowDays: z.number().int().min(7).max(365),
  snapshot: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const data = parse.data
  const isSelf = data.userId === ctx.userId
  if (!isSelf && !hasPermission(ctx.roles, 'admin.users.read')) {
    return NextResponse.json({ error: 'Sólo puedes emitir documentos a tu nombre' }, { status: 403 })
  }

  const result = await issueReportDocument({
    userId: data.userId,
    holderName: data.holderName,
    holderEmail: data.holderEmail,
    windowDays: data.windowDays,
    snapshot: data.snapshot,
    issuedBy: ctx.userId,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ...result })
}
