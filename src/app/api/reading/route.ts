import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('module.voice.use')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const url = new URL(req.url)
  const cefrLevel = url.searchParams.get('cefr') || undefined
  const domain = url.searchParams.get('domain') || undefined
  const topic = url.searchParams.get('topic') || undefined
  const textId = url.searchParams.get('id')

  // If specific ID requested, return that text
  if (textId) {
    const text = await db.readingText.findUnique({ where: { id: textId } })
    if (!text || !text.isActive) {
      return NextResponse.json({ error: 'Texto no encontrado' }, { status: 404 })
    }
    return NextResponse.json({
      ok: true,
      text: {
        id: text.id,
        title: text.title,
        content: text.content,
        wordCount: text.wordCount,
        cefrLevel: text.cefrLevel,
        domain: text.domain,
        topic: text.topic,
        difficultyScore: text.difficultyScore,
        estimatedReadingTimeSec: text.estimatedReadingTimeSec,
      },
    })
  }

  // Otherwise, get user's CEFR level and fetch appropriate texts
  const profile = await db.userProfile.findUnique({ where: { userId: ctx.userId } })
  const userCefr = cefrLevel || profile?.cefrCurrent || 'A2'

  const texts = await db.readingText.findMany({
    where: {
      isActive: true,
      cefrLevel: userCefr,
      ...(domain ? { domain } : {}),
      ...(topic ? { topic } : {}),
    },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  if (texts.length === 0) {
    const fallback = await db.readingText.findMany({
      where: { isActive: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    })
    if (fallback.length === 0) {
      return NextResponse.json({ error: 'No hay textos de lectura disponibles' }, { status: 404 })
    }
    const text = fallback[Math.floor(Math.random() * fallback.length)]
    return NextResponse.json({
      ok: true,
      text: {
        id: text.id,
        title: text.title,
        content: text.content,
        wordCount: text.wordCount,
        cefrLevel: text.cefrLevel,
        domain: text.domain,
        topic: text.topic,
        difficultyScore: text.difficultyScore,
        estimatedReadingTimeSec: text.estimatedReadingTimeSec,
      },
    })
  }

  const randomIndex = Math.floor(Math.random() * texts.length)
  const text = texts[randomIndex]

  return NextResponse.json({
    ok: true,
    text: {
      id: text.id,
      title: text.title,
      content: text.content,
      wordCount: text.wordCount,
      cefrLevel: text.cefrLevel,
      domain: text.domain,
      topic: text.topic,
      difficultyScore: text.difficultyScore,
      estimatedReadingTimeSec: text.estimatedReadingTimeSec,
    },
  })
}
