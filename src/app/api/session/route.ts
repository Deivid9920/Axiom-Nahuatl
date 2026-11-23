import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { composeSession, applySession } from '@/lib/session'

// GET /api/session?topicId=... — compone la siguiente sesión de práctica del
// nodo (warmup SRS + historia + descubrimiento + práctica + producción +
// checkpoint). Sin LLM: todo lo compone el motor algorítmico.
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const topicId = new URL(req.url).searchParams.get('topicId')
  if (!topicId) {
    return NextResponse.json({ error: 'topicId requerido' }, { status: 400 })
  }
  const data = await composeSession(authCheck.ctx.userId, topicId)
  if ('error' in data) {
    return NextResponse.json({ error: data.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true, ...data })
}

const applySchema = z.object({
  topicId: z.string().min(1),
  secondsSpent: z.number().int().min(0).max(7200).optional(),
  warmup: z.array(z.object({ id: z.string(), q: z.number().min(0).max(1) })).optional(),
  practice: z.object({ correct: z.number().int().min(0), total: z.number().int().min(1) }).optional(),
  writing: z.object({ text: z.string().max(4000).optional() }).optional(),
  speaking: z.object({ transcript: z.string().max(2000).optional(), selfReported: z.boolean().optional() }).optional(),
  checkpoint: z.object({ correct: z.number().int().min(0), total: z.number().int().min(1) }).optional(),
})

// POST /api/session — registra la sesión completa: SRS, práctica, producción,
// checkpoint y gating de dominio (3 sesiones + checkpoint >= 80).
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
  const parse = applySchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 })
  }
  const result = await applySession(authCheck.ctx.userId, parse.data)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json(result)
}
