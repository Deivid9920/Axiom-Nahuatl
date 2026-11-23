import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { chatCompletion } from '@/lib/llm'
import { logger } from '@/lib/observability'
import { rateLimiter } from '@/lib/security/rate-limiter'

// R20 — Reportes del Estudio Premium:
// kind=interview → reporte de entrevista (fluidez, muletillas, vocabulario, STAR)
// kind=meeting   → minuta de reunión (asistentes, acuerdos, acciones, correcciones)

const schema = z.object({
  kind: z.enum(['interview', 'meeting']),
  sessionId: z.string().min(1),
})

const INTERVIEW_PROMPT = `You are a senior interview coach evaluating a mock job interview conducted in English with a Mexican professional.
You receive the transcript (INTERVIEWER / CANDIDATE turns). Analyze ONLY the candidate's performance.
Return ONLY valid JSON (no markdown, no extra text) with this exact shape:
{
  "fluidez": <0-100 overall communication score>,
  "resumen": "<2-3 sentences in Spanish about the overall performance>",
  "muletillas": [{"palabra": "<filler like 'like', 'you know'>", "veces": <int>}],
  "vocabulario": ["<strong words/phrases the candidate used correctly>"],
  "star": {"fortalezas": ["<2-4 strengths in Spanish>"], "mejorar": ["<2-4 concrete improvements in Spanish>"]},
  "consejo": "<one actionable tip in Spanish>"
}`

const MEETING_PROMPT = `You are an executive assistant producing the minutes of a simulated work meeting held in English with a Mexican professional and AI colleagues.
You receive the transcript (turns labeled with speaker names). Produce the meeting minutes.
Return ONLY valid JSON (no markdown, no extra text) with this exact shape:
{
  "asistentes": ["<participant names>"],
  "resumen": "<2-4 sentences in Spanish summarizing the meeting>",
  "acuerdos": ["<agreements reached, in English as they were said>"],
  "acciones": [{"quien": "<owner>", "que": "<action item in English>", "cuando": "<deadline or 'next meeting'>"}],
  "correcciones": [{"original": "<wrong/awkward English said in the meeting>", "corregido": "<better version>", "explicacion": "<brief reason in Spanish>"}]
}`

// POST /api/premium/report
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

  const session = await db.learningSession.findUnique({ where: { id: parse.data.sessionId } })
  if (!session || session.userId !== ctx.userId) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  // SECURITY: the report is an LLM call — apply the same LLM rate limit as messages
  const llmRateCheck = rateLimiter.checkLlm(ctx.userId)
  if (!llmRateCheck.allowed) {
    return NextResponse.json(
      { error: 'Estás generando reportes muy rápido. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(llmRateCheck.retryAfter) } }
    )
  }

  const msgs = await db.sessionMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    take: 60,
  })
  if (msgs.length < 2) {
    return NextResponse.json({ error: 'La sesión no tiene conversación suficiente para generar un reporte.' }, { status: 400 })
  }

  const transcript = msgs
    .map(m => {
      const who = m.role === 'user'
        ? (parse.data.kind === 'interview' ? 'CANDIDATE' : session.scenarioTitle || 'USER')
        : (parse.data.kind === 'interview' ? 'INTERVIEWER' : 'MEETING')
      return `${who}: ${m.content}`
    })
    .join('\n\n')

  const systemPrompt = parse.data.kind === 'interview' ? INTERVIEW_PROMPT : MEETING_PROMPT

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Transcript of the session:\n\n${transcript.slice(0, 12000)}` },
      ],
      temperature: 0.3,
      maxTokens: 1200,
      user: ctx.userId,
      sessionId: session.id,
      model: 'deepseek/deepseek-chat-v4-flash',
    })

    const raw = response.choices[0].message.content || ''
    // Tolerante a respuestas que envuelven el JSON en fences
    const jsonText = raw.replace(/```json|```/g, '').trim()
    const start = jsonText.indexOf('{')
    const end = jsonText.lastIndexOf('}')
    if (start === -1 || end === -1) {
      throw new Error('La respuesta del modelo no contiene JSON')
    }
    const report = JSON.parse(jsonText.slice(start, end + 1))

    return NextResponse.json({
      ok: true,
      report,
      tokensIn: response.usage.promptTokens,
      tokensOut: response.usage.completionTokens,
    })
  } catch (error) {
    logger.error('premium.report_failed', { session_id: session.id, error: (error as Error).message }, error as Error)
    return NextResponse.json({ error: 'No se pudo generar el reporte. Intenta de nuevo.' }, { status: 500 })
  }
}
