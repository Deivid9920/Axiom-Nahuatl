import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/billing'
import { chatCompletion } from '@/lib/llm'
import { logger, audit } from '@/lib/observability'

// Get a text to read aloud (adapted to user's domain)
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.voice.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const access = await checkFeatureAccess(ctx.userId, 'voiceEnabled')
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const url = new URL(req.url)
  const domain = url.searchParams.get('domain') || 'software_engineering'

  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  const cefrLevel = profile?.cefrCurrent || 'A2'

  // Generate reading text via LLM
  const response = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: `You are a reading text generator for English pronunciation practice.
Generate a 100-150 word professional text for a Mexican ${domain} professional at CEFR level ${cefrLevel}.
The text should use realistic vocabulary and sentence structures from the domain.
Output ONLY the text to read, no preamble.`,
      },
      { role: 'user', content: `Generate a reading text about ${domain} at CEFR ${cefrLevel}.` },
    ],
    temperature: 0.8,
    maxTokens: 300,
    user: ctx.userId,
    model: 'deepseek/deepseek-chat-v4-flash',
  })

  const text = response.choices[0].message.content.trim()

  return NextResponse.json({
    ok: true,
    readingText: text,
    cefrLevel,
    domain,
  })
}

// Submit pronunciation analysis (from Web Speech API transcript)
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('module.voice.use')
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
  const feedbackResponse = await chatCompletion({
    messages: [
      {
        role: 'system',
        content: `You are a pronunciation coach for Mexican English learners.
Compare the original text with what the user spoke (transcribed by Web Speech API).
Provide feedback on:
- Pronunciation accuracy
- Rhythm and cadence
- Pauses and hesitation
- Specific phonemes that need work (especially: /θ/ as in "think", /ð/ as in "this", /ʃ/ as in "she", /r/ vs /ɾ/)

Format feedback as:
[Correction: <word> → <corrected>. Reason: <explanation>]

Then a 2-sentence summary.`,
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
  const origWords = original.toLowerCase().match(/\b[a-z']+\b/g) || []
  const spokenWords = spoken.toLowerCase().match(/\b[a-z']+\b/g) || []

  // Word-level accuracy: how many original words appear in spoken (Levenshtein-like)
  let correct = 0
  for (const orig of origWords) {
    if (spokenWords.some(s => levenshtein(orig, s) <= 1)) correct++
  }
  const accuracy = origWords.length > 0 ? correct / origWords.length : 0

  // Words per minute
  const wordsPerMinute = durationMs
    ? Math.round((spokenWords.length / durationMs) * 60000)
    : 0

  // Hesitation markers: filler words
  const fillers = ['um', 'uh', 'er', 'ah', 'like']
  const hesitationCount = spokenWords.filter(w => fillers.includes(w)).length

  // Problematic phonemes for Spanish speakers (heuristic: count specific words)
  const problemPhonemes: string[] = []
  if (/think|three|through/.test(original) && !spoken.toLowerCase().match(/think|three|through/)) {
    problemPhonemes.push('/θ/ (as in "think")')
  }
  if (/this|that|those|these/.test(original) && !spoken.toLowerCase().match(/this|that|those|these/)) {
    problemPhonemes.push('/ð/ (as in "this")')
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
