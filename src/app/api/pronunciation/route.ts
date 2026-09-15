import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/billing'
import { chatCompletion, LlmNotConfiguredError } from '@/lib/llm'
import { logger, audit } from '@/lib/observability'

// AXIOM — Módulo de PRONUNCIACIÓN
// Genera un texto para leer en voz alta y evalúa la producción del usuario.
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.pronunciation.use')
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

  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  const cefrLevel = profile?.cefrCurrent || 'A2'

  // 1. Corpus curado primero, luego nivel exacto y vecinos
  const cefrPool = getCefrNeighbors(cefrLevel)

  const pool = await db.readingText.findMany({
    where: { isActive: true, cefrLevel: { in: cefrPool } },
    take: 60,
  })

  const exact = pool.filter(t => t.cefrLevel === cefrLevel && t.domain === domain)
  const sameLevel = pool.filter(t => t.cefrLevel === cefrLevel)
  const candidates = exact.length > 0 ? exact : sameLevel.length > 0 ? sameLevel : pool

  if (candidates.length > 0) {
    const picked = candidates[Math.floor(Math.random() * candidates.length)]
    return NextResponse.json({
      ok: true,
      source: 'corpus',
      text: {
        id: picked.id,
        title: picked.title,
        content: picked.content,
        wordCount: picked.wordCount,
        cefrLevel: picked.cefrLevel,
        domain: picked.domain,
        estimatedReadingTimeSec: picked.estimatedReadingTimeSec,
      },
    })
  }

  // 2. Respaldo: generación con el LLM.
  logger.info('pronunciation.corpus_miss', { user_id: ctx.userId, cefrLevel, domain })

  let response
  try {
    response = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: `Eres un generador de textos de lectura para practicar la PRONUNCIACIÓN del náhuatl.
Genera un texto breve (40-80 palabras) en náhuatl clásico con ortografía tradicional, tema "${domain}", nivel ${cefrLevel}.
Usa solo vocabulario bien atestiguado y frases sencillas. Incluye después del texto, en una línea separada que empiece con "---", la traducción al español.
Devuelve SOLO el texto a leer y su traducción, sin preámbulo.`,
      },
      { role: 'user', content: `Genera un texto de lectura en náhuatl sobre ${domain}, nivel ${cefrLevel}.` },
    ],
    temperature: 0.8,
    maxTokens: 300,
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

  // El prompt pide el texto y, tras una línea que empieza con "---", la traducción.
  const [rawContent, ...rest] = raw.split(/^---.*$/m)
  const content = rawContent.trim()
  const translation = rest.join('').trim()

  if (!content) {
    return NextResponse.json(
      { error: 'No se pudo preparar un texto de lectura. Intenta de nuevo.' },
      { status: 502 }
    )
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length

  return NextResponse.json({
    ok: true,
    source: 'generated',
    text: {
      // Identificador efímero: clave estable mientras dura el ejercicio (no se persiste)
      id: `gen_${crypto.randomUUID()}`,
      title: `Práctica de ${domain.replace(/_/g, ' ')} · ${cefrLevel}`,
      content,
      translation,
      wordCount,
      cefrLevel,
      domain,
      // ~2.2 palabras por segundo leyendo en voz alta con cuidado.
      estimatedReadingTimeSec: Math.max(15, Math.round(wordCount / 2.2)),
    },
  })
}

// Submit pronunciation analysis (from Web Speech API transcript)
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.pronunciation.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const access = await checkFeatureAccess(ctx.userId, 'voiceEnabled')
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    originalText: z.string().min(10),
    spokenText: z.string().min(1),
    durationMs: z.number().optional(),  // total reading duration
    pauses: z.array(z.object({ start: z.number(), end: z.number() })).optional(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // Compute pronunciation metrics (heuristic for MVP)
  const metrics = computePronunciationMetrics(parse.data.originalText, parse.data.spokenText, parse.data.durationMs)

  // Use LLM to provide detailed feedback
  let feedbackResponse
  try {
    feedbackResponse = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: `Eres un coach de pronunciación de náhuatl para hispanohablantes.
Compara el texto original en náhuatl con lo que el usuario dijo (transcrito por Web Speech API con modelo de español,
por lo que la transcripción es una APROXIMACIÓN fonética — evalúa la similitud sonora, no la ortografía exacta).
Da retroalimentación en español sobre:
- Precisión de pronunciación
- Ritmo y cadencia (acento siempre en la penúltima sílaba)
- Pausas y titubeos
- Sonidos específicos a trabajar (especialmente: tl /t͡ɬ/, x /ʃ/ como "sh", saltillo /ʔ/, hu /w/, vocales largas)

Formato de retroalimentación:
[Correction: <palabra> → <corrección>. Reason: <explicación>]

Después, un resumen de 2 oraciones.`,
      },
      {
        role: 'user',
        content: `Original text:\n${parse.data.originalText}\n\nSpoken text (transcribed):\n${parse.data.spokenText}`,
      },
    ],
    temperature: 0.5,
    maxTokens: 500,
    user: ctx.userId,
    model: 'deepseek/deepseek-chat-v4-flash',
    })
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      // Las métricas algorítmicas sí están: se devuelven sin la parte del LLM.
      return NextResponse.json(
        { ok: true, metrics, feedback: null, feedbackUnavailable: error.message },
        { status: 200 }
      )
    }
    throw error
  }

  const feedback = feedbackResponse.choices[0].message.content

  await audit('voice.pronunciation_analyzed', {
    userId: ctx.userId,
    metadata: {
      accuracy: metrics.accuracy,
      wordsPerMinute: metrics.wordsPerMinute,
    },
  })

  return NextResponse.json({
    ok: true,
    metrics,
    feedback,
  })
}

function computePronunciationMetrics(original: string, spoken: string, durationMs?: number) {
  const origWords = original.toLowerCase().match(/[\p{L}']+/gu) || []
  const spokenWords = spoken.toLowerCase().match(/[\p{L}']+/gu) || []

  // Word-level accuracy con margen fuzzy amplio (transcripción es-MX)
  let correct = 0
  for (const orig of origWords) {
    if (spokenWords.some(s => levenshtein(orig, s) <= 2)) correct++
  }
  const accuracy = origWords.length > 0 ? correct / origWords.length : 0

  // Words per minute
  const wordsPerMinute = durationMs
    ? Math.round((spokenWords.length / durationMs) * 60000)
    : 0

  // Hesitation markers: filler words (Spanish fillers — the learner thinks in Spanish)
  const fillers = ['este', 'eh', 'em', 'mmm', 'osea', 'pues']
  const hesitationCount = spokenWords.filter(w => fillers.includes(w)).length

  // Sonidos problemáticos del náhuatl para hispanohablantes (heurística es-MX)
  const problemPhonemes: string[] = []
  const spokenLower = spoken.toLowerCase()
  const origHasTl = /tl/.test(original.toLowerCase())
  if (origHasTl && !/tl/.test(spokenLower)) {
    problemPhonemes.push('tl /t͡ɬ/ (africada lateral, como en "náhuatl")')
  }
  const origHasX = /x/.test(original.toLowerCase())
  if (origHasX && !/x|sh|ch/.test(spokenLower)) {
    problemPhonemes.push('x /ʃ/ (como "sh" en inglés, ej. "xochitl")')
  }
  const origHasHu = /hu[aei]|[aei]uh/.test(original.toLowerCase())
  if (origHasHu && !/hu|w|gu/.test(spokenLower)) {
    problemPhonemes.push('hu /w/ (como "w", ej. "huehuetl")')
  }

  return {
    accuracy: Math.round(accuracy * 100) / 100,
    wordsPerMinute,
    hesitationCount,
    problemPhonemes,
    originalWordCount: origWords.length,
    spokenWordCount: spokenWords.length,
  }
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[b.length][a.length]
}

// Niveles vecinos (±1) en la escala interna tipo MCER
function getCefrNeighbors(level: string): string[] {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const idx = levels.indexOf(level)
  if (idx === -1) return [level]
  const result = [level]
  if (idx > 0) result.push(levels[idx - 1])
  if (idx < levels.length - 1) result.push(levels[idx + 1])
  return result
}
