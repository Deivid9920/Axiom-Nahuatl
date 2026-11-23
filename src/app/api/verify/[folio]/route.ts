// R27 — verificación pública de documentos por folio (sin sesión)
// GET /api/verify/[folio] → estado, titular (correo enmascarado), integridad y snapshot
import { NextRequest, NextResponse } from 'next/server'
import { verifyDocumentByFolio } from '@/lib/issued-docs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ folio: string }> }
) {
  const { folio } = await params
  if (!folio || folio.length > 40) {
    return NextResponse.json({ error: 'Folio inválido' }, { status: 400 })
  }

  const result = await verifyDocumentByFolio(folio)
  if (!result.found) {
    return NextResponse.json({ ok: true, found: false }, { status: 200 })
  }

  return NextResponse.json({
    ok: true,
    found: true,
    folio: result.folio,
    kind: result.kind,
    holderName: result.holderName,
    holderEmailMasked: result.holderEmailMasked,
    issuedAt: result.issuedAt,
    revoked: result.revoked,
    integrity: result.integrity,
    payloadHash: result.payloadHash,
    snapshot: result.snapshot,
  })
}
