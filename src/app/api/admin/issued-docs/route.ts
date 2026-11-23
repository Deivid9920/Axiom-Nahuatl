// R28 — listado de documentos emitidos para el panel admin (sólo ADMIN)
// GET /api/admin/issued-docs → últimos 50 documentos con estado e integridad
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { listIssuedDocuments } from '@/lib/issued-docs'

export async function GET() {
  const authCheck = await requirePermission('admin.users.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const docs = await listIssuedDocuments(50)
  return NextResponse.json({ ok: true, docs })
}
