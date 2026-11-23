import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { getDueItems, gradeReview, dueCount } from '@/lib/srs/server'

// GET /api/srs — ítems vencidos para repasar hoy (cola de repetición espaciada)
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const limitParam = new URL(req.url).searchParams.get('limit')
  const limit = Math.max(1, Math.min(20, Number(limitParam) || 5))
  const [items, total] = await Promise.all([
    getDueItems(authCheck.ctx.userId, limit),
    dueCount(authCheck.ctx.userId),
  ])
  return NextResponse.json({ ok: true, items, dueCount: total })
}

const reviewSchema = z.object({
  reviews: z.array(z.object({ id: z.string(), q: z.number().min(0).max(1) })).min(1).max(20),
})

// POST /api/srs — califica ítems repasados y reprograma sus fechas (SM-2-lite)
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parse = reviewSchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const results: { id: string; itemKey: string; intervalDays: number; dueAt: Date }[] = []
  for (const r of parse.data.reviews) {
    const updated = await gradeReview(authCheck.ctx.userId, r.id, r.q)
    if (updated) {
      results.push({ id: updated.id, itemKey: updated.itemKey, intervalDays: updated.intervalDays, dueAt: updated.dueAt })
    }
  }
  const remaining = await dueCount(authCheck.ctx.userId)
  return NextResponse.json({ ok: true, results, dueCount: remaining })
}
