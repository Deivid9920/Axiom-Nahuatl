import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { audit } from '@/lib/observability'

// Panel admin: busqueda de usuarios y reporte de estadisticas de cualquier usuario
export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('admin.users.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() || ''
  const userId = url.searchParams.get('userId')?.trim() || ''
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 7), 365)

  // Lista para el panel: busqueda por nombre/correo o registros recientes
  if (!userId) {
    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        lastLoginAt: true,
        profile: {
          select: {
            cefrCurrent: true,
            skillReading: true,
            skillWriting: true,
            skillListening: true,
            skillSpeaking: true,
          },
        },
        userRoles: { select: { role: { select: { name: true } } } },
        _count: { select: { learningSessions: true, vocabularyItems: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 300,
    })

    const mapped = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      roles: u.userRoles.map(r => r.role.name),
      cefrCurrent: u.profile?.cefrCurrent || 'A2',
      sessionsCount: u._count.learningSessions,
      vocabularyCount: u._count.vocabularyItems,
      skills: {
        reading: u.profile?.skillReading ?? 20,
        writing: u.profile?.skillWriting ?? 20,
        listening: u.profile?.skillListening ?? 20,
        speaking: u.profile?.skillSpeaking ?? 20,
      },
    }))

    const filtered = q
      ? mapped.filter(u => `${u.name || ''} ${u.email}`.toLowerCase().includes(q))
      : mapped

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const [totalUsers, sessionsWindow, errorsWindow] = await Promise.all([
      db.user.count(),
      db.learningSession.count({ where: { startedAt: { gte: since } } }),
      db.errorEvent.count({ where: { createdAt: { gte: since } } }),
    ])

    return NextResponse.json({
      ok: true,
      query: q,
      users: filtered.slice(0, 12),
      system: { totalUsers, sessionsWindow, errorsWindow, windowDays: 30 },
    })
  }

  // Reporte completo de un usuario
  const target = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      lastLoginAt: true,
      profile: {
        select: {
          cefrInitial: true,
          cefrCurrent: true,
          theta: true,
          skillReading: true,
          skillWriting: true,
          skillListening: true,
          skillSpeaking: true,
          cefrReading: true,
          cefrWriting: true,
          cefrListening: true,
          cefrSpeaking: true,
          learningMode: true,
          professionalDomain: true,
          weeklyMinutesGoal: true,
        },
      },
      userRoles: { select: { role: { select: { name: true } } } },
    },
  })

  if (!target) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [sessions, evaluations, vocabCount, dueReviews, allTime, platformAvg] = await Promise.all([
    db.learningSession.findMany({
      where: { userId, startedAt: { gte: since } },
      orderBy: { startedAt: 'desc' },
      take: 200,
    }),
    db.sessionEvaluation.findMany({
      where: { session: { userId }, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.vocabularyItem.count({ where: { userId } }),
    db.vocabularyItem.count({ where: { userId, nextReviewAt: { lte: new Date() } } }),
    db.learningSession.aggregate({
      where: { userId },
      _count: true,
      _sum: { durationSec: true },
    }),
    db.userProfile.aggregate({
      _avg: { skillReading: true, skillWriting: true, skillListening: true, skillSpeaking: true },
    }),
  ])

  const trajectory = evaluations
    .map(e => ({ date: e.createdAt.toISOString().slice(0, 10), theta: e.thetaAfter }))
    .reverse()

  const moduleBreakdown: Record<string, number> = {}
  for (const s of sessions) {
    moduleBreakdown[s.module] = (moduleBreakdown[s.module] || 0) + 1
  }

  await audit('admin.user.report.viewed', {
    userId: ctx.userId,
    resourceType: 'user',
    resourceId: userId,
    requestId: ctx.requestId,
  })

  return NextResponse.json({
    ok: true,
    report: {
      windowDays: days,
      user: {
        id: target.id,
        name: target.name,
        email: target.email,
        roles: target.userRoles.map(r => r.role.name),
        createdAt: target.createdAt,
        lastLoginAt: target.lastLoginAt,
        learningMode: target.profile?.learningMode || 'moderado',
        professionalDomain: target.profile?.professionalDomain || null,
        weeklyMinutesGoal: target.profile?.weeklyMinutesGoal ?? 150,
      },
      progress: {
        cefrInitial: target.profile?.cefrInitial || 'A2',
        cefrCurrent: target.profile?.cefrCurrent || 'A2',
        theta: target.profile?.theta ?? -2,
        skills: {
          reading: target.profile?.skillReading ?? 20,
          writing: target.profile?.skillWriting ?? 20,
          listening: target.profile?.skillListening ?? 20,
          speaking: target.profile?.skillSpeaking ?? 20,
        },
        skillCEFRs: {
          reading: target.profile?.cefrReading || 'A2',
          writing: target.profile?.cefrWriting || 'A2',
          listening: target.profile?.cefrListening || 'A2',
          speaking: target.profile?.cefrSpeaking || 'A2',
        },
        sessionsCount: sessions.length,
        totalActiveMinutes: sessions.reduce((s2, sess) => s2 + Math.round((sess.durationSec || 0) / 60), 0),
        vocabularyCount: vocabCount,
        dueReviews,
        trajectory,
        moduleBreakdown,
      },
      platformAvg: {
        reading: Math.round(platformAvg._avg.skillReading ?? 0),
        writing: Math.round(platformAvg._avg.skillWriting ?? 0),
        listening: Math.round(platformAvg._avg.skillListening ?? 0),
        speaking: Math.round(platformAvg._avg.skillSpeaking ?? 0),
      },
      allTime: {
        sessions: allTime._count,
        minutes: Math.round((allTime._sum.durationSec || 0) / 60),
      },
    },
  })
}
