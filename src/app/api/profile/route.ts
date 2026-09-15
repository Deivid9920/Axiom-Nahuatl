import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission, getAuthContext } from '@/lib/auth'
import { audit } from '@/lib/observability'
import { type Domain, type CefrLevel, CEFR_LEVELS, DOMAINS } from '@/lib/types'

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
    profile: {
      userId: profile.userId,
      cefrInitial: profile.cefrInitial,
      cefrCurrent: profile.cefrCurrent,
      theta: profile.theta,
      thetaSE: profile.thetaSE,
      // 4 fundamental skills
      skills: {
        reading: profile.skillReading,
        writing: profile.skillWriting,
        listening: profile.skillListening,
        speaking: profile.skillSpeaking,
      },
      skillCEFRs: {
        reading: profile.cefrReading,
        writing: profile.cefrWriting,
        listening: profile.cefrListening,
        speaking: profile.cefrSpeaking,
      },
      // Learning mode + schedule
      learningMode: profile.learningMode,
      learningDays: JSON.parse(profile.learningDays),
      learningTimeStart: profile.learningTimeStart,
      learningTimeEnd: profile.learningTimeEnd,
      sessionDurationMin: profile.sessionDurationMin,
      // Professional context
      professionalDomain: profile.professionalDomain,
      jobRole: profile.jobRole,
      learningGoals: profile.learningGoals ? JSON.parse(profile.learningGoals) : [],
      weeklyMinutesGoal: profile.weeklyMinutesGoal,
      onboardingCompleted: profile.onboardingCompleted,
    },
  })
}

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
    cefrInitial: z.enum(CEFR_LEVELS as unknown as [string, ...string[]]).optional(),
    professionalDomain: z.enum(DOMAINS as unknown as [string, ...string[]]).optional(),
    jobRole: z.string().max(100).optional(),
    learningGoals: z.array(z.string()).max(10).optional(),
    weeklyMinutesGoal: z.number().int().min(15).max(600).optional(),
    onboardingCompleted: z.boolean().optional(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const profile = await db.userProfile.update({
    where: { userId: ctx.userId },
    data: {
      ...(parse.data.cefrInitial ? { cefrInitial: parse.data.cefrInitial, cefrCurrent: parse.data.cefrInitial } : {}),
      ...(parse.data.professionalDomain ? { professionalDomain: parse.data.professionalDomain } : {}),
      ...(parse.data.jobRole !== undefined ? { jobRole: parse.data.jobRole } : {}),
      ...(parse.data.learningGoals ? { learningGoals: JSON.stringify(parse.data.learningGoals) } : {}),
      ...(parse.data.weeklyMinutesGoal ? { weeklyMinutesGoal: parse.data.weeklyMinutesGoal } : {}),
      ...(parse.data.onboardingCompleted !== undefined ? { onboardingCompleted: parse.data.onboardingCompleted, onboardedAt: new Date() } : {}),
    },
  })

  await audit('profile.updated', { userId: ctx.userId, metadata: parse.data })

  return NextResponse.json({
    ok: true,
    profile: {
      userId: profile.userId,
      cefrCurrent: profile.cefrCurrent,
      professionalDomain: profile.professionalDomain,
      onboardingCompleted: profile.onboardingCompleted,
    },
  })
}
