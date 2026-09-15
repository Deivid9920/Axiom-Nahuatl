import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/billing'
import { chatCompletion, LlmNotConfiguredError } from '@/lib/llm'
import { logger, audit } from '@/lib/observability'
import { LISTENING_MODES, type ListeningMode } from '@/lib/types'
import { evaluateDictation, getDictationAdvice } from '@/lib/algorithms'

const MODE_BRIEFS: Record<ListeningMode, string> = {
  comprension_guiada:
    'Un fragmento narrativo breve. Las preguntas verifican que la persona entendió el sentido general y dos detalles concretos.',
  dictado:
    'Una o dos frases claras y bien articuladas, pensadas para ser transcritas palabra por palabra. Sin nombres propios poco comunes.',
  discriminacion:
    'Frases que contrastan pares mínimos característicos del náhuatl (tl/t, tz/s, ch/x, saltillo). Las preguntas piden identificar cuál se escuchó.',
}

// GET: obtener un ejercicio de escucha
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.listening.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const access = await checkFeatureAccess(ctx.userId, 'voiceEnabled')
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const url = new URL(req.url)
  const domain = url.searchParams.get('domain') || 'vida_cotidiana'
  const requestedMode = url.searchParams.get('mode') || 'comprension_guiada'

  if (!LISTENING_MODES.includes(requestedMode as ListeningMode)) {
    return NextResponse.json({ error: 'Modo de escucha no válido' }, { status: 400 })
  }
  const mode = requestedMode as ListeningMode

  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  const cefrLevel = profile?.cefrCurrent || 'A2'

  let response
  try {
    response = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: `Eres un generador de ejercicios de COMPRENSIÓN AUDITIVA de náhuatl.

Modo solicitado: ${mode}. ${MODE_BRIEFS[mode]}

Genera un fragmento en náhuatl clásico con ortografía tradicional, tema "${domain}", nivel ${cefrLevel}.
El fragmento debe poder escucharse en menos de 30 segundos (30-60 palabras).
Usa solo vocabulario bien atestiguado.

Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta forma, sin texto alrededor y sin bloque de código:
{
  "audioText": "<el texto en náhuatl que se leerá en voz alta>",
  "translation": "<traducción al español>",
  "questions": [
    { "prompt": "<pregunta en español>", "options": ["<a>", "<b>", "<c>"], "answerIndex": 0 }
  ]
}
Incluye entre 2 y 3 preguntas.`,
      },
      {
        role: 'user',
        content: `Genera un ejercicio de escucha en náhuatl sobre ${domain}, nivel ${cefrLevel}, modo ${mode}.`,
      },
    ],
    temperature: 0.8,
    maxTokens: 700,
    user: ctx.userId,
    model: 'deepseek/deepseek-chat-v4-flash',
    })
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 503 })
    }
    throw error
  }

  const raw = response.choices[0].message.content.trim()

  // El modelo puede envolver el JSON en un bloque de código pese a la instrucción.
  const jsonText = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

  const exerciseSchema = z.object({
    audioText: z.string().min(1).max(2000),
    translation: z.string().max(2000),
    questions: z
      .array(
        z.object({
          prompt: z.string().min(1).max(500),
          options: z.array(z.string().max(300)).min(2).max(5),
          answerIndex: z.number().int().min(0),
        })
      )
      .min(1)
      .max(5),
  })

  let parsed
  try {
    parsed = exerciseSchema.safeParse(JSON.parse(jsonText))
  } catch {
    logger.warn('listening.exercise_unparseable', { user_id: ctx.userId, mode })
    return NextResponse.json(
      { error: 'No se pudo generar el ejercicio. Intenta de nuevo.' },
      { status: 502 }
    )
  }

  if (!parsed.success) {
    logger.warn('listening.exercise_invalid', { user_id: ctx.userId, mode })
    return NextResponse.json(
      { error: 'No se pudo generar el ejercicio. Intenta de nuevo.' },
      { status: 502 }
    )
  }

  // Descarta preguntas cuyo índice de respuesta cae fuera de sus opciones.
  const questions = parsed.data.questions.filter(q => q.answerIndex < q.options.length)
  if (questions.length === 0) {
    return NextResponse.json(
      { error: 'No se pudo generar el ejercicio. Intenta de nuevo.' },
      { status: 502 }
    )
  }

  return NextResponse.json({
    ok: true,
    mode,
    cefrLevel,
    domain,
    audioText: parsed.data.audioText,
    translation: parsed.data.translation,
    questions,
  })
}

// POST: registrar las respuestas de un ejercicio de escucha
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.listening.use')
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

  const schema = z.discriminatedUnion('mode', [
    z.object({
      mode: z.literal('dictado'),
      audioText: z.string().min(1).max(2000),
      transcription: z.string().min(1).max(2000),
      durationSec: z.number().int().min(0).max(3600).optional(),
    }),
    z.object({
      mode: z.enum(['comprension_guiada', 'discriminacion']),
      audioText: z.string().max(2000),
      answers: z
        .array(z.object({ questionIndex: z.number().int().min(0), correct: z.boolean() }))
        .min(1)
        .max(5),
      durationSec: z.number().int().min(0).max(3600).optional(),
    }),
  ])

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // Dictado: evaluación algorítmica, sin LLM
  if (parse.data.mode === 'dictado') {
    const result = evaluateDictation(parse.data.transcription, parse.data.audioText)
    const advice = getDictationAdvice(result)

    await audit('listening.exercise_completed', {
      userId: ctx.userId,
      resourceType: 'listening',
      metadata: {
        mode: 'dictado',
        wordAccuracy: result.wordAccuracy,
        phonemesAtRisk: result.phonemesAtRisk.length,
      },
    })

    logger.info('listening.completed', {
      user_id: ctx.userId,
      mode: 'dictado',
      accuracy: result.wordAccuracy,
    })

    return NextResponse.json({
      ok: true,
      mode: 'dictado',
      total: result.totalWords,
      correct: result.correctWords,
      accuracy: Math.round(result.wordAccuracy * 100) / 100,
      score: result.score,
      errors: result.errors,
      phonemesAtRisk: result.phonemesAtRisk,
      advice,
    })
  }

  // Comprensión y discriminación: recuento de aciertos
  const total = parse.data.answers.length
  const correct = parse.data.answers.filter(a => a.correct).length
  const accuracy = total > 0 ? correct / total : 0

  await audit('listening.exercise_completed', {
    userId: ctx.userId,
    resourceType: 'listening',
    metadata: { mode: parse.data.mode, total, correct },
  })

  logger.info('listening.completed', {
    user_id: ctx.userId,
    mode: parse.data.mode,
    accuracy,
  })

  return NextResponse.json({
    ok: true,
    mode: parse.data.mode,
    total,
    correct,
    accuracy: Math.round(accuracy * 100) / 100,
    score: Math.round(accuracy * 1000) / 10,
  })
}
