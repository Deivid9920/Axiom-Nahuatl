import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { logger } from '@/lib/observability'

// Get user progress (theta trajectory, sessions, vocabulary)
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.listening.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '30')

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [profile, sessions, evaluations, vocabCount, dueReviews] = await Promise.all([
    db.userProfile.findUnique({ where: { userId: ctx.userId } }),
    db.learningSession.findMany({
      where: { userId: ctx.userId, startedAt: { gt: since } },
      orderBy: { startedAt: 'desc' },
      take: 50,
    }),
    db.sessionEvaluation.findMany({
      where: { session: { userId: ctx.userId }, createdAt: { gt: since } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    db.vocabularyItem.count({ where: { userId: ctx.userId } }),
    db.vocabularyItem.count({
      where: {
        userId: ctx.userId,
        nextReviewAt: { lte: new Date() },
      },
    }),
  ])

  // Compute trajectory
  const trajectory = evaluations
    .map(e => ({ date: e.createdAt.toISOString().slice(0, 10), theta: e.thetaAfter }))
    .reverse()

  // Sessions per day
  const sessionsPerDay: Record<string, number> = {}
  for (const s of sessions) {
    const day = s.startedAt.toISOString().slice(0, 10)
    sessionsPerDay[day] = (sessionsPerDay[day] || 0) + 1
  }

  // Module breakdown
  const moduleBreakdown: Record<string, number> = {}
  for (const s of sessions) {
    moduleBreakdown[s.module] = (moduleBreakdown[s.module] || 0) + 1
  }

  // Error types
  const errorTypes: Record<string, number> = {}
  for (const ev of evaluations) {
    try {
      const errs = JSON.parse(ev.errorsJson || '[]') as { type: string }[]
      for (const e of errs) errorTypes[e.type] = (errorTypes[e.type] || 0) + 1
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    progress: {
      theta: profile?.theta ?? -2,
      thetaSE: profile?.thetaSE ?? 1,
      cefrCurrent: profile?.cefrCurrent || 'A2',
      cefrInitial: profile?.cefrInitial || 'A2',
      // 4 fundamental skills
      skills: {
        reading: profile?.skillReading ?? 20,
        writing: profile?.skillWriting ?? 20,
        listening: profile?.skillListening ?? 20,
        speaking: profile?.skillSpeaking ?? 20,
      },
      skillCEFRs: {
        reading: profile?.cefrReading || 'A2',
        writing: profile?.cefrWriting || 'A2',
        listening: profile?.cefrListening || 'A2',
        speaking: profile?.cefrSpeaking || 'A2',
      },
      learningMode: profile?.learningMode || 'moderado',
      vocabularyCount: vocabCount,
      dueReviews,
      sessionsCount: sessions.length,
      totalActiveMinutes: sessions.reduce((s, sess) => s + Math.round((sess.durationSec || 0) / 60), 0),
      trajectory,
      sessionsPerDay,
      moduleBreakdown,
      errorTypes,
    },
  })
}
