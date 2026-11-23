import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { evaluateTranslation, getTranslationAdvice } from '@/lib/algorithms'
import { audit, recordMetric } from '@/lib/observability'
import { events } from '@/lib/events'

// GET: Fetch a translation exercise from DB (not LLM-generated)
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.text.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const url = new URL(req.url)
  const cefrLevel = url.searchParams.get('cefr') || undefined
  const direction = url.searchParams.get('direction') || 'es_to_en'
  const domain = url.searchParams.get('domain') || undefined

  const sourceLanguage = direction === 'es_to_en' ? 'es' : 'en'
  const targetLanguage = direction === 'es_to_en' ? 'en' : 'es'

  const exercises = await db.translationExercise.findMany({
    where: {
      isActive: true,
      sourceLanguage,
      targetLanguage,
      ...(cefrLevel ? { cefrLevel } : {}),
      ...(domain ? { domain } : {}),
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  if (exercises.length === 0) {
    return NextResponse.json({ error: 'No hay ejercicios de traducción disponibles' }, { status: 404 })
  }

  const randomIndex = Math.floor(Math.random() * exercises.length)
  const exercise = exercises[randomIndex]

  return NextResponse.json({
    ok: true,
    exercise: {
      id: exercise.id,
      sourceText: exercise.sourceText,
      sourceLanguage: exercise.sourceLanguage,
      targetLanguage: exercise.targetLanguage,
      cefrLevel: exercise.cefrLevel,
      topic: exercise.topic,
      vocabulary: exercise.vocabularyJson ? JSON.parse(exercise.vocabularyJson) : [],
      hints: exercise.hintsJson ? JSON.parse(exercise.hintsJson) : [],
    },
  })
}

// POST: Submit translation (evaluated by algorithm, not LLM)
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
    exerciseId: z.string().optional(),
    userTranslation: z.string().min(1).max(2000),
    sourceText: z.string(),
    targetText: z.string(),  // correct translation
    sourceLanguage: z.string().default('es'),
    targetLanguage: z.string().default('en'),
    targetVocab: z.array(z.string()).optional().default([]),
    durationSec: z.number().positive().optional(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // Evaluate using pure mathematical algorithm (NO LLM)
  const evaluation = evaluateTranslation(
    parse.data.userTranslation,
    parse.data.targetText,
    parse.data.targetVocab
  )

  const advice = getTranslationAdvice(evaluation)

  // Persist to DB
  const result = await db.translationResult.create({
    data: {
      userId: ctx.userId,
      exerciseId: parse.data.exerciseId || null,
      userTranslation: parse.data.userTranslation,
      sourceText: parse.data.sourceText,
      targetText: parse.data.targetText,
      sourceLanguage: parse.data.sourceLanguage,
      targetLanguage: parse.data.targetLanguage,
      bleuScore: evaluation.bleuScore,
      levenshteinDist: evaluation.levenshteinDist,
      wordAccuracy: evaluation.wordAccuracy,
      semanticSimilarity: evaluation.semanticSimilarity,
      grammarScore: evaluation.grammarScore,
      vocabularyScore: evaluation.vocabularyScore,
      overallScore: evaluation.overallScore,
      errorsJson: JSON.stringify(evaluation.errors),
      matchedVocab: JSON.stringify(evaluation.matchedVocab),
      missedVocab: JSON.stringify(evaluation.missedVocab),
      cefrLevel: evaluation.cefrLevel,
      durationSec: parse.data.durationSec || 0,
    },
  })

  // Update user's reading + writing skill scores
  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  if (profile) {
    const { updateSkillScore, skillScoreToCEFR } = await import('@/lib/algorithms')
    // Translation exercises both reading (understanding source) and writing (producing target)
    const newReadingScore = updateSkillScore(profile.skillReading, evaluation.overallScore)
    const newWritingScore = updateSkillScore(profile.skillWriting, evaluation.overallScore)
    await db.userProfile.update({
      where: { userId: ctx.userId },
      data: {
        skillReading: newReadingScore,
        skillWriting: newWritingScore,
        cefrReading: skillScoreToCEFR(newReadingScore),
        cefrWriting: skillScoreToCEFR(newWritingScore),
        skillsUpdatedAt: new Date(),
      },
    })
  }

  await recordMetric('translation.bleu', evaluation.bleuScore, { type: 'gauge', unit: 'score', userId: ctx.userId })
  await recordMetric('translation.overall', evaluation.overallScore, { type: 'gauge', unit: 'score', userId: ctx.userId })

  await events.publish({
    name: 'USER_COMPLETED_LESSON',
    producer: 'module:translation',
    producerUserId: ctx.userId,
    payload: {
      sessionId: result.id,
      userId: ctx.userId,
      durationSec: parse.data.durationSec || 0,
      thetaDelta: 0,
    },
  })

  await audit('translation.completed', {
    userId: ctx.userId,
    resourceType: 'translation_result',
    resourceId: result.id,
    metadata: { overallScore: evaluation.overallScore, cefrLevel: evaluation.cefrLevel },
  })

  return NextResponse.json({
    ok: true,
    evaluation: {
      ...evaluation,
      advice,
    },
  })
}
