// R26 — importación masiva de miembros
// POST /api/coordinator/groups/[id]/members/bulk { text }
// Formato del texto: un correo por línea, opcionalmente "correo,student|maestro"
// o "correo;maestro". Sin rol explícito → student. Máximo 100 entradas por llamada.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { bulkAddMembers, parseBulkText, type RoleInGroup } from '@/lib/coordinator'

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

  const schema = z.object({ text: z.string().min(3).max(20000) })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const parsed = parseBulkText(parse.data.text)
  if (parsed.length === 0) {
    return NextResponse.json({ error: 'La lista está vacía' }, { status: 400 })
  }
  if (parsed.length > 100) {
    return NextResponse.json({ error: 'Máximo 100 correos por importación. Divide la lista.' }, { status: 400 })
  }

  // Las líneas malformadas (correo inválido / rol desconocido) no llegan al
  // servicio: se reportan una sola vez como aviso al final de la lista.
  const valid = parsed.filter(p => !p.invalid)
  const warnings = parsed.filter(p => p.invalid).map(p => ({ email: p.email, status: 'error' as const, message: p.invalid! }))
  if (valid.length === 0) {
    return NextResponse.json({ error: 'No hay correos válidos en la lista' }, { status: 400 })
  }

  const result = await bulkAddMembers({
    coordinatorId: ctx.userId,
    groupId: id,
    entries: valid.map(p => ({ email: p.email, roleInGroup: p.roleInGroup })),
  })
  if (!result.ok) {
    const forbidden = result.error.startsWith('Sólo')
    return NextResponse.json({ error: result.error }, { status: forbidden ? 403 : 400 })
  }

  return NextResponse.json({
    ok: true,
    results: [...result.results, ...warnings],
    added: result.added,
    updated: result.updated,
    failed: result.failed + warnings.length,
  })
}
