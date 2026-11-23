// R28 — consulta pública del código de institución (sin sesión)
// GET /api/institutions/lookup?code=AX-INST-DEMO
// Devuelve sólo nombre y estado de verificación (sin PII ni datos internos).
import { NextRequest, NextResponse } from 'next/server'
import { lookupInstitutionByCode } from '@/lib/coordinator'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code') || ''
  if (!code.trim()) {
    return NextResponse.json({ ok: true, found: false })
  }
  if (code.trim().length > 40) {
    return NextResponse.json({ error: 'Código demasiado largo' }, { status: 400 })
  }
  const result = await lookupInstitutionByCode(code)
  return NextResponse.json({ ok: true, ...result })
}
