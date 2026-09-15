import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthContext } from '@/lib/auth'

// GET: Get curriculum topics for the user's dashboard cards
// Returns: topics being studied + upcoming topics based on CEFR level
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const skill = url.searchParams.get('skill')  // reading | writing | listening | speaking

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
    cefrLevel: { in: [userCefr, nextCefr] },
  }

  const topics = await db.curriculumTopic.findMany({
    where: whereClause,
    orderBy: [{ cefrLevel: 'asc' }, { order: 'asc' }],
    take: 20,
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
