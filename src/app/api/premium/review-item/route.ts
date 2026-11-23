import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import crypto from 'crypto'

// R20 — Puente Estudio Premium → Repasos (FSRS/SM-2): convierte una corrección
// en una tarjeta de repaso para fijar el error corregido con repetición espaciada.

const schema = z.object({
  corrections: z.array(z.object({
    original: z.string().min(1).max(300),
    corrected: z.string().min(1).max(300),
  })).min(1).max(10),
})

// POST /api/premium/review-item
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
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  let created = 0
  for (const c of parse.data.corrections) {
    // itemKey estable: la misma corrección no se duplica en la cola
    const hash = crypto.createHash('sha1').update(`${c.original}→${c.corrected}`).digest('hex').slice(0, 12)
    const itemKey = `premium:${hash}`
    await db.reviewItem.upsert({
      where: { userId_itemKey: { userId: ctx.userId, itemKey } },
      create: {
        userId: ctx.userId,
        itemKey,
        kind: 'phrase',
        front: `Corrige: «${c.original}»`,
        back: c.corrected,
        dueAt: new Date(),
      },
      update: { dueAt: new Date() },
    })
    created++
  }

  return NextResponse.json({ ok: true, created })
}
