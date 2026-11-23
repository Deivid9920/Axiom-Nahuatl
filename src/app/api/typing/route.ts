import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { evaluateTyping, getTypingAdvice, type TypingKeystroke } from '@/lib/algorithms'
import { audit, recordMetric } from '@/lib/observability'
import { events } from '@/lib/events'

// GET: Fetch a typing text from DB (not LLM-generated)
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.text.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const url = new URL(req.url)
  const cefrLevel = url.searchParams.get('cefr') || undefined
  const topic = url.searchParams.get('topic') || undefined
  const domain = url.searchParams.get('domain') || undefined

  // Get a random typing text from DB matching criteria
  const texts = await db.typingText.findMany({
    where: {
      isActive: true,
      ...(cefrLevel ? { cefrLevel } : {}),
      ...(topic ? { topic } : {}),
      ...(domain ? { domain } : {}),
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  if (texts.length === 0) {
    return NextResponse.json({ error: 'No hay textos de mecanografía disponibles' }, { status: 404 })
  }

  // Pick random text
  const randomIndex = Math.floor(Math.random() * texts.length)
  const text = texts[randomIndex]

  return NextResponse.json({
    ok: true,
    text: {
      id: text.id,
      content: text.content,
      wordCount: text.wordCount,
      cefrLevel: text.cefrLevel,
      topic: text.topic,
      domain: text.domain,
    },
  })
}

// POST: Submit typing result (evaluated by algorithm, not LLM)
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.text.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    typingTextId: z.string().optional(),
    targetText: z.string().min(1).max(5000),
    keystrokes: z.array(z.object({
      char: z.string(),
      expected: z.string(),
      position: z.number().int(),
      timestamp: z.number(),
      correct: z.boolean(),
      corrected: z.boolean().optional().default(false),
    })),
    durationSec: z.number().positive(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // Evaluate using pure mathematical algorithm (NO LLM)
  const result = evaluateTyping(
    parse.data.targetText,
    parse.data.keystrokes as TypingKeystroke[],
    parse.data.durationSec
  )

  const advice = getTypingAdvice(result)

  // Persist to DB
  const typingResult = await db.typingResult.create({
    data: {
      userId: ctx.userId,
      typingTextId: parse.data.typingTextId || null,
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      accuracy: result.accuracy,
      consistency: result.consistency,
      errorCount: result.errorCount,
      correctedErrors: result.correctedErrors,
      uncorrectedErrors: result.uncorrectedErrors,
      totalKeystrokes: result.totalKeystrokes,
      correctKeystrokes: result.correctKeystrokes,
      durationSec: result.durationSec,
      errorsJson: JSON.stringify(result.errors),
      skillScore: result.skillScore,
      cefrLevel: result.cefrLevel,
    },
  })

  // Update user's writing skill score
  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  if (profile) {
    const { updateSkillScore, skillScoreToCEFR } = await import('@/lib/algorithms')
    const newWritingScore = updateSkillScore(profile.skillWriting, result.skillScore)
    await db.userProfile.update({
      where: { userId: ctx.userId },
      data: {
        skillWriting: newWritingScore,
        cefrWriting: skillScoreToCEFR(newWritingScore),
        skillsUpdatedAt: new Date(),
      },
    })
  }

  // Record metrics
  await recordMetric('typing.wpm', result.wpm, { type: 'gauge', unit: 'wpm', userId: ctx.userId })
  await recordMetric('typing.accuracy', result.accuracy, { type: 'gauge', unit: 'ratio', userId: ctx.userId })

  // Emit event
  await events.publish({
    name: 'USER_COMPLETED_LESSON',
    producer: 'module:typing',
    producerUserId: ctx.userId,
    payload: {
      sessionId: typingResult.id,
      userId: ctx.userId,
      durationSec: result.durationSec,
      thetaDelta: 0,
    },
  })

  await audit('typing.completed', {
    userId: ctx.userId,
    resourceType: 'typing_result',
    resourceId: typingResult.id,
    metadata: { wpm: result.wpm, accuracy: result.accuracy, skillScore: result.skillScore },
  })

  return NextResponse.json({
    ok: true,
    result: {
      ...result,
      advice,
    },
  })
}
