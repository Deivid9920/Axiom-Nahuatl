import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth'
import { audit } from '@/lib/observability'

// R20 — Prospecto Enterprise: «Hablar con ventas» del apartado Planes.
// Público (un prospecto puede escribir antes de pagar), con validación estricta
// y auditabilidad; si hay sesión activa se asocia el usuario.

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  company: z.string().max(120).optional(),
  teamSize: z.string().max(20).optional(),
  message: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  let userId: string | null = null
  try {
    const ctx = await getAuthContext()
    userId = ctx?.userId || null
  } catch { /* prospecto anónimo */ }

  const lead = await db.salesLead.create({
    data: {
      userId,
      name: parse.data.name,
      email: parse.data.email,
      company: parse.data.company || null,
      teamSize: parse.data.teamSize || null,
      message: parse.data.message || null,
    },
  })

  await audit('sales.lead_created', {
    userId: userId || undefined,
    resourceType: 'sales_lead',
    resourceId: lead.id,
    metadata: { teamSize: parse.data.teamSize || null },
  })

  return NextResponse.json({ ok: true, id: lead.id })
}
