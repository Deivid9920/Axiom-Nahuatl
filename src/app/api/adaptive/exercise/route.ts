import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { getExercisesForTopic } from '@/lib/adaptive'

// POST: ejercicios adaptativos de un nodo (banco del «Libro» calibrado contra
// theta). Sin LLM: la generación es puramente algorítmica.
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.conversation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({ topicId: z.string().min(1), count: z.number().int().min(1).max(12).optional() })
  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'topicId requerido' }, { status: 400 })
  }

  const data = await getExercisesForTopic(authCheck.ctx.userId, parse.data.topicId, parse.data.count || 6)
  if (!data) {
    return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, ...data })
}
