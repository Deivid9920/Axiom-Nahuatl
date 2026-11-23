import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth'
import { COURSE_MODULES } from '@/lib/books'
import { applyAttempt } from '@/lib/adaptive'

// GET: Get curriculum topics for the user's dashboard cards
// Returns: topics being studied + upcoming topics based on CEFR level
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const skill = url.searchParams.get('skill')  // reading | writing | listening | speaking
  // Camino de lecciones: un módulo (o grupo) muestra todos sus temas, cualquier nivel
  const moduleParam = url.searchParams.get('module')
  const modulesParam = url.searchParams.get('modules')
  const moduleGroup = moduleParam ? [moduleParam] : (modulesParam ? modulesParam.split(',') : null)

  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  if (!profile) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const userCefr = profile.cefrCurrent

  // Get CEFR levels for current and next level
  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const currentIdx = cefrOrder.indexOf(userCefr)
  const nextCefr = currentIdx < cefrOrder.length - 1 ? cefrOrder[currentIdx + 1] : userCefr

  // Get topics for current level (in progress) and next level (upcoming)
  const whereClause = {
    isActive: true,
    ...(skill ? { skill } : {}),
    ...(moduleGroup ? { module: { in: moduleGroup } } : { cefrLevel: { in: [userCefr, nextCefr] } }),
  }

  const topics = await db.curriculumTopic.findMany({
    where: whereClause,
    orderBy: [{ cefrLevel: 'asc' }, { order: 'asc' }],
    take: moduleGroup ? 60 : 20,
  })

  // Get user's progress for these topics
  const topicIds = topics.map(t => t.id)
  const userProgress = await db.userTopicProgress.findMany({
    where: { userId: ctx.userId, topicId: { in: topicIds } },
  })

  const progressMap = new Map(userProgress.map(p => [p.topicId, p]))

  // Categorize: in_progress, completed, upcoming
  const result = topics.map(t => {
    const progress = progressMap.get(t.id)
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      skill: t.skill,
      cefrLevel: t.cefrLevel,
      module: t.module,
      icon: t.icon || 'school',
      color: t.color || '#0ECFB1',
      order: t.order,
      status: progress?.status || 'not_started',
      progress: progress?.progress || 0,
      score: progress?.score || null,
      sessionsCount: progress?.sessionsCount || 0,
      isUpcoming: t.cefrLevel === nextCefr && userCefr !== nextCefr,
    }
  })

  // Get 4 skill scores for overview
  const skillScores = {
    reading: profile.skillReading,
    writing: profile.skillWriting,
    listening: profile.skillListening,
    speaking: profile.skillSpeaking,
  }

  const skillCEFRs = {
    reading: profile.cefrReading,
    writing: profile.cefrWriting,
    listening: profile.cefrListening,
    speaking: profile.cefrSpeaking,
  }

  return NextResponse.json({
    ok: true,
    currentLevel: userCefr,
    nextLevel: nextCefr,
    skillScores,
    skillCEFRs,
    topics: result,
  })
}

// POST: marca el avance de un tema del camino (lección completada)
export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { topicId?: string; score?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const topicId = typeof body?.topicId === 'string' ? body.topicId : null
  if (!topicId) {
    return NextResponse.json({ error: 'topicId requerido' }, { status: 400 })
  }
  // score llega 0-1 desde los módulos; se guarda 0-100 como el resto de la BD
  const score = typeof body?.score === 'number' ? Math.round(body.score * 100) : null

  const topic = await db.curriculumTopic.findUnique({ where: { id: topicId } })
  if (!topic) {
    return NextResponse.json({ error: 'Tema no encontrado' }, { status: 404 })
  }

  // Nodos de los 10 módulos CEFR: el intento pasa por el motor adaptativo
  // (progreso + EMA de habilidad + theta acotado). Sin LLM en la práctica.
  if (COURSE_MODULES.some(m => m.code === topic.module)) {
    // applyAttempt espera el score crudo 0-1 del módulo; la escala 0-100 es interna
    const rawScore = typeof body?.score === 'number' ? Math.max(0, Math.min(1, body.score)) : 0
    const result = await applyAttempt(ctx.userId, topicId, rawScore)
    if (!result) {
      return NextResponse.json({ error: 'No se pudo registrar el intento' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, progress: result.progress, metrics: { skill: result.skill, newSkill: result.newSkill, theta: result.newTheta } })
  }

  const progress = await db.userTopicProgress.upsert({
    where: { userId_topicId: { userId: ctx.userId, topicId } },
    create: {
      userId: ctx.userId,
      topicId,
      status: 'completed',
      progress: 1,
      score: score ?? null,
      attemptsCount: 1,
      lastAttemptedAt: new Date(),
      completedAt: new Date(),
    },
    update: {
      status: 'completed',
      progress: 1,
      score: score ?? undefined,
      attemptsCount: { increment: 1 },
      lastAttemptedAt: new Date(),
      completedAt: new Date(),
    },
  })

  return NextResponse.json({ ok: true, progress })
}
