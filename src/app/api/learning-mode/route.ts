import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth'
import { audit } from '@/lib/observability'
import { LEARNING_MODES, type LearningMode } from '@/lib/types'

// GET: Get current learning mode and schedule
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
    config: {
      learningMode: profile.learningMode,
      learningDays: JSON.parse(profile.learningDays),
      learningTimeStart: profile.learningTimeStart,
      learningTimeEnd: profile.learningTimeEnd,
      sessionDurationMin: profile.sessionDurationMin,
    },
  })
}

// PATCH: Update learning mode and schedule
export async function PATCH(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    learningMode: z.enum(LEARNING_MODES as unknown as [string, ...string[]]).optional(),
    learningDays: z.array(z.number().int().min(1).max(7)).optional(),
    learningTimeStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    learningTimeEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    sessionDurationMin: z.number().int().min(10).max(120).optional(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  // If learningMode is changing, auto-adjust session duration and weekly goal
  let updates: Record<string, unknown> = {}
  if (parse.data.learningMode) {
    const mode = parse.data.learningMode as LearningMode
    const modeConfig = {
      tranquilo: { sessionDurationMin: 15, weeklyMinutesGoal: 30 },
      moderado: { sessionDurationMin: 25, weeklyMinutesGoal: 100 },
      agresivo: { sessionDurationMin: 40, weeklyMinutesGoal: 240 },
    }
    updates = {
      learningMode: mode,
      ...modeConfig[mode],
    }
  }

  // Apply explicit overrides
  if (parse.data.learningDays) updates.learningDays = JSON.stringify(parse.data.learningDays)
  if (parse.data.learningTimeStart) updates.learningTimeStart = parse.data.learningTimeStart
  if (parse.data.learningTimeEnd) updates.learningTimeEnd = parse.data.learningTimeEnd
  if (parse.data.sessionDurationMin) updates.sessionDurationMin = parse.data.sessionDurationMin

  const profile = await db.userProfile.update({
    where: { userId: ctx.userId },
    data: updates,
  })

  await audit('learning_mode.updated', {
    userId: ctx.userId,
    metadata: updates,
  })

  return NextResponse.json({
    ok: true,
    config: {
      learningMode: profile.learningMode,
      learningDays: JSON.parse(profile.learningDays),
      learningTimeStart: profile.learningTimeStart,
      learningTimeEnd: profile.learningTimeEnd,
      sessionDurationMin: profile.sessionDurationMin,
    },
  })
}
