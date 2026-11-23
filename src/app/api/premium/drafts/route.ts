import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { getEffectivePlan } from '@/lib/billing'
import { audit } from '@/lib/observability'

// R20 — Estudio Premium: biblioteca de borradores (redacción / entrevistas / reuniones)

const createSchema = z.object({
  kind: z.enum(['writing', 'interview', 'meeting']),
  title: z.string().min(1).max(120),
  template: z.string().max(40).optional(),
  tone: z.string().max(20).optional(),
  industry: z.string().max(40).optional(),
  originalText: z.string().max(20000).optional(),
  finalText: z.string().max(20000).optional(),
  rubric: z.object({
    estructura: z.number().min(0).max(100),
    gramatica: z.number().min(0).max(100),
    tono: z.number().min(0).max(100),
    precision: z.number().min(0).max(100),
  }).optional(),
  cefrOriginal: z.string().max(4).optional(),
  cefrImproved: z.string().max(4).optional(),
  meta: z.any().optional(),
})

// GET /api/premium/drafts — lista la biblioteca del usuario (o devuelve uno por id)
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind')
  const id = url.searchParams.get('id')

  if (id) {
    const draft = await db.premiumDraft.findUnique({ where: { id } })
    if (!draft || draft.userId !== ctx.userId) {
      return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, draft })
  }

  const drafts = await db.premiumDraft.findMany({
    where: { userId: ctx.userId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true, kind: true, title: true, template: true, tone: true,
      cefrOriginal: true, cefrImproved: true, createdAt: true,
    },
  })
  return NextResponse.json({ ok: true, drafts })
}

// POST /api/premium/drafts — guarda un borrador respetando el límite del plan
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parse = createSchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }
  const d = parse.data

  const { features } = await getEffectivePlan(ctx.userId)
  const used = await db.premiumDraft.count({ where: { userId: ctx.userId } })
  if (used >= features.maxDocuments) {
    return NextResponse.json(
      { error: `Tu plan permite ${features.maxDocuments} documentos guardados y ya llegaste al límite. Mejora de plan o elimina borradores antiguos.` },
      { status: 402 }
    )
  }

  const draft = await db.premiumDraft.create({
    data: {
      userId: ctx.userId,
      kind: d.kind,
      title: d.title,
      template: d.template || null,
      tone: d.tone || null,
      industry: d.industry || null,
      originalText: d.originalText || null,
      finalText: d.finalText || null,
      rubricJson: d.rubric ? JSON.stringify(d.rubric) : null,
      cefrOriginal: d.cefrOriginal || null,
      cefrImproved: d.cefrImproved || null,
      metaJson: d.meta ? JSON.stringify(d.meta) : null,
    },
  })

  await audit('premium.draft_saved', {
    userId: ctx.userId,
    resourceType: 'premium_draft',
    resourceId: draft.id,
    metadata: { kind: d.kind },
  })

  return NextResponse.json({ ok: true, id: draft.id })
}

// DELETE /api/premium/drafts?id= — elimina un borrador propio
export async function DELETE(req: NextRequest) {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck
  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Falta id' }, { status: 400 })
  }
  const draft = await db.premiumDraft.findUnique({ where: { id } })
  if (!draft || draft.userId !== ctx.userId) {
    return NextResponse.json({ error: 'Borrador no encontrado' }, { status: 404 })
  }
  await db.premiumDraft.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
