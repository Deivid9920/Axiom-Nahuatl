import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth'
import { BANKS } from '@/lib/books'
import { thetaToCefrGroup, thetaToAvance } from '@/lib/adaptive/avance'
import type { McqItem } from '@/lib/books'

// R15 — Test de colocación: 12 ítems en escalera de dificultad (m1 -> m10).
// Fija el theta inicial real del usuario y su nivel MCER de salida.

const LADDER_MODULES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 3, 8]

export interface PlacementItem extends McqItem {
  module: number
}

function buildLadder(): PlacementItem[] {
  const items: PlacementItem[] = []
  for (const moduleId of LADDER_MODULES) {
    const bank = BANKS.find(b => b.moduleId === moduleId && b.lessonKey.endsWith('-g1'))
    const mcq = bank?.content.mcq?.[items.length % 2 === 0 ? 0 : 1]
    if (mcq) items.push({ ...mcq, module: moduleId })
    if (items.length >= 12) break
  }
  return items
}

// GET /api/placement — estado de colocación + escalera de ítems
export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }
  return NextResponse.json({
    ok: true,
    placed: Boolean(profile.placedAt),
    avance: thetaToAvance(profile.theta),
    items: buildLadder(),
  })
}

const answerSchema = z.object({
  answers: z.array(z.object({ module: z.number().int().min(1).max(10), correct: z.boolean() })).min(1).max(12),
})

// POST /api/placement — calcula theta inicial desde el patrón de respuestas
export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parse = answerSchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }

  // theta = -3 + suma de deltas: acertar un ítem del módulo m aporta 0.1+0.04m;
  // fallarlo resta lo mismo. Acertar todo llega a ~+2; fallar todo a -3.
  let theta = -3
  for (const a of parse.data.answers) {
    const delta = 0.1 + a.module * 0.04
    theta += a.correct ? delta : -delta
  }
  theta = Math.max(-3, Math.min(2, theta))

  const group = thetaToCefrGroup(theta)
  const now = new Date()
  await db.userProfile.update({
    where: { userId: ctx.userId },
    data: {
      theta,
      thetaSE: 0.5,
      thetaUpdatedAt: now,
      cefrInitial: group,
      cefrCurrent: group,
      cefrReading: group,
      cefrWriting: group,
      cefrListening: group,
      cefrSpeaking: group,
      placedAt: now,
    },
  })

  return NextResponse.json({ ok: true, theta, avance: thetaToAvance(theta), cefr: group })
}
