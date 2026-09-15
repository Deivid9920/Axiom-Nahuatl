import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { processLearningRequest, type LilResponse } from '@/lib/lil'
import { checkFeatureAccess, checkSessionLimit } from '@/lib/billing'
import { events } from '@/lib/events'
import { type Module } from '@/lib/types'
import { logger } from '@/lib/observability'
import { rateLimiter } from '@/lib/security/rate-limiter'
import '@/lib/agents/agents'  // side-effect: registers all 5 agents + event subscribers

// Start a new learning session
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

  const schema = z.object({
    module: z.enum(['listening', 'pronunciation']),
    mode: z.string(),
    domain: z.string().optional(),
    cefrTarget: z.string().optional(),
    scenarioTitle: z.string().optional(),
    scenarioConfig: z.record(z.string(), z.any()).optional(),
    message: z.string().optional(),  // optional first message
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // Feature gating: ambos módulos son de voz y requieren el plan con audio.
  const access = await checkFeatureAccess(ctx.userId, 'voiceEnabled')
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  // Session limit check
  const sessionLimit = await checkSessionLimit(ctx.userId)
  if (!sessionLimit.allowed) {
    return NextResponse.json({ error: sessionLimit.reason }, { status: 402 })  // Payment Required
  }

  // Get user profile
  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  // Create session
  const session = await db.learningSession.create({
    data: {
      userId: ctx.userId,
      module: parse.data.module,
      mode: parse.data.mode,
      domain: parse.data.domain || profile.professionalDomain,
      cefrTarget: parse.data.cefrTarget || profile.cefrCurrent,
      scenarioTitle: parse.data.scenarioTitle || null,
      scenarioConfig: parse.data.scenarioConfig ? JSON.stringify(parse.data.scenarioConfig) : null,
      status: 'active',
    },
  })

  await events.publish({
    name: 'SESSION_STARTED',
    producer: 'module:' + parse.data.module,
    producerUserId: ctx.userId,
    payload: {
      sessionId: session.id,
      userId: ctx.userId,
      module: parse.data.module,
      mode: parse.data.mode,
    },
  })

  // If first message provided, process it immediately
  let firstResponse: LilResponse | null = null
  if (parse.data.message) {
    try {
      firstResponse = await processLearningRequest({
        userId: ctx.userId,
        sessionId: session.id,
        module: parse.data.module as Module,
        mode: parse.data.mode,
        userMessage: parse.data.message,
      })
      await events.publish({
        name: 'MESSAGE_SENT',
        producer: 'module:' + parse.data.module,
        producerUserId: ctx.userId,
        payload: {
          sessionId: session.id,
          userId: ctx.userId,
          messageId: 'first',
          contentLength: parse.data.message.length,
        },
      })
    } catch (error) {
      logger.error('modules.first_message_failed', {
        session_id: session.id,
        user_id: ctx.userId,
        error: (error as Error).message,
      }, error as Error)
    }
  }

  return NextResponse.json({
    ok: true,
    session: {
      id: session.id,
      module: session.module,
      mode: session.mode,
      startedAt: session.startedAt,
    },
    firstResponse,
  })
}

// Send a message to an existing session
export async function PUT(req: NextRequest) {
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

  const schema = z.object({
    sessionId: z.string(),
    message: z.string().min(1).max(5000),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // Verify session belongs to user
  const session = await db.learningSession.findUnique({
    where: { id: parse.data.sessionId },
  })
  if (!session || session.userId !== ctx.userId) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }
  if (session.status !== 'active') {
    return NextResponse.json({ error: 'La sesión no está activa' }, { status: 400 })
  }

  // SECURITY: LLM rate limiting — 10 LLM calls per minute per user
  const llmRateCheck = rateLimiter.checkLlm(ctx.userId)
  if (!llmRateCheck.allowed) {
    return NextResponse.json(
      { error: 'Estás enviando mensajes muy rápido. Espera un momento.' },
      { status: 429, headers: { 'Retry-After': String(llmRateCheck.retryAfter) } }
    )
  }

  await events.publish({
    name: 'MESSAGE_SENT',
    producer: 'module:' + session.module,
    producerUserId: ctx.userId,
    payload: {
      sessionId: session.id,
      userId: ctx.userId,
      messageId: crypto.randomUUID(),
      contentLength: parse.data.message.length,
    },
  })

  try {
    const response = await processLearningRequest({
      userId: ctx.userId,
      sessionId: session.id,
      module: session.module as Module,
      mode: session.mode,
      userMessage: parse.data.message,
    })

    return NextResponse.json({
      ok: true,
      response,
    })
  } catch (error) {
    logger.error('modules.message_failed', { session_id: session.id, error: (error as Error).message }, error as Error)
    // SECURITY: Don't expose internal error details to client
    return NextResponse.json({ error: 'Error procesando el mensaje. Intenta de nuevo.' }, { status: 500 })
  }
}

// End a session (triggers Learning Agent evaluation)
export async function PATCH(req: NextRequest) {
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

  const schema = z.object({
    sessionId: z.string(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const session = await db.learningSession.findUnique({
    where: { id: parse.data.sessionId },
  })
  if (!session || session.userId !== ctx.userId) {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  }

  const endedAt = new Date()
  const durationSec = Math.round((endedAt.getTime() - session.startedAt.getTime()) / 1000)

  await db.learningSession.update({
    where: { id: session.id },
    data: {
      status: 'completed',
      endedAt,
      durationSec,
    },
  })

  await events.publish({
    name: 'USER_COMPLETED_LESSON',
    producer: 'module:' + session.module,
    producerUserId: ctx.userId,
    payload: {
      sessionId: session.id,
      userId: ctx.userId,
      durationSec,
      thetaDelta: 0,  // will be updated by Learning Agent
    },
  })

  return NextResponse.json({ ok: true, durationSec })
}

// List user's sessions
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.listening.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') || '20')
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const mod = url.searchParams.get('module')

  const sessions = await db.learningSession.findMany({
    where: {
      userId: ctx.userId,
      ...(mod ? { module: mod } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: Math.min(limit, 100),
    skip: offset,
    include: {
      _count: { select: { messages: true } },
    },
  })

  return NextResponse.json({
    ok: true,
    sessions: sessions.map(s => ({
      id: s.id,
      module: s.module,
      mode: s.mode,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      durationSec: s.durationSec,
      messagesCount: s.messagesCount,
      status: s.status,
    })),
  })
}
