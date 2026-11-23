// Seed R15 — capa demo de la pedagogía inmersiva sobre el seed R14:
// usuario colocado (test de nivel), sesiones de práctica con tendencia de
// Avance, nodo en curso con gating (sesión 2 de 3) y cola SRS con ítems
// vencidos para el repaso del día. Idempotente.

import { PrismaClient } from '@prisma/client'
import { seedBooks, seedCourseModules, seedDemoActivity } from './seed_r14'
import { bankForLesson, deriveNodeContent } from '../src/lib/books'

const db = new PrismaClient()

export async function seedDemoImmersiveR15() {
  const user = await db.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (!user) return { placed: false, sessions: 0, reviewItems: 0 }

  // Idempotencia: si ya hay sesiones de práctica, nada por hacer
  const existing = await db.practiceSession.count({ where: { userId: user.id } })

  // 1. Usuario colocado (el overlay del test no bloquea la demo)
  await db.userProfile.updateMany({
    where: { userId: user.id, placedAt: null },
    data: { placedAt: new Date(), theta: -2.0, cefrCurrent: 'A1', cefrInitial: 'A1' },
  })

  if (existing > 0) {
    return { placed: true, sessions: 0, reviewItems: 0 }
  }

  const m1Topics = await db.curriculumTopic.findMany({ where: { module: 'm1', order: { not: 99 } }, orderBy: { order: 'asc' } })
  const completedTitles = ['Pronombres y verbo to be', 'Artículos, sustantivos y demostrativos', 'Posesivos, preguntas y There is/are', 'Vocabulario de presentación personal']
  const now = Date.now()

  // 2. Nodos completados: coherentes con el gating (3 sesiones cada uno)
  let sessionRows = 0
  let thetaCursor = -2.35
  for (let ci = 0; ci < completedTitles.length; ci++) {
    const t = m1Topics.find(x => x.title === completedTitles[ci])
    if (!t) continue
    const daysAgo = 14 - ci * 3
    await db.userTopicProgress.updateMany({
      where: { userId: user.id, topicId: t.id, status: 'completed' },
      data: { sessionsCount: 3 },
    })
    for (let s = 1; s <= 3; s++) {
      const created = new Date(now - (daysAgo - (s - 1) * 0.6) * 86400000)
      thetaCursor = Math.min(-2.0, thetaCursor + 0.028)
      await db.practiceSession.create({
        data: {
          userId: user.id,
          topicId: t.id,
          sessionNumber: s,
          secondsSpent: 900 + s * 60,
          warmupScore: s > 1 ? 0.8 : null,
          practiceScore: 0.7 + (s % 2) * 0.1,
          writingScore: 0.65,
          speakingScore: 0.75,
          checkpointScore: s === 3 ? 85 + ci : null,
          thetaBefore: thetaCursor - 0.028,
          thetaAfter: thetaCursor,
          completedNode: s === 3,
          createdAt: created,
        },
      })
      sessionRows++
    }
  }

  // 3. Nodo en curso: el primero no completado (tras los 4 terminados); sesión 1 de 3 hecha hoy
  const inProgress = m1Topics.find(t => !completedTitles.includes(t.title))
  if (inProgress) {
    await db.userTopicProgress.upsert({
      where: { userId_topicId: { userId: user.id, topicId: inProgress.id } },
      create: {
        userId: user.id, topicId: inProgress.id,
        status: 'in_progress', progress: 0.32, score: 72,
        attemptsCount: 1, sessionsCount: 1,
        lastAttemptedAt: new Date(),
      },
      update: {
        status: 'in_progress', progress: 0.32, sessionsCount: 1,
        lastAttemptedAt: new Date(),
      },
    })
    await db.practiceSession.create({
      data: {
        userId: user.id,
        topicId: inProgress.id,
        sessionNumber: 1,
        secondsSpent: 780, // 13 min hoy: el anillo de meta diaria queda a medio llenar
        warmupScore: 0.9,
        practiceScore: 0.72,
        writingScore: 0.6,
        speakingScore: 0.7,
        thetaBefore: -2.0,
        thetaAfter: -1.93,
        completedNode: false,
        createdAt: new Date(),
      },
    })
    sessionRows++
  }

  // 4. Cola SRS: vocabulario del primer nodo; 3 ítems vencidos ahora mismo
  const bank = bankForLesson('m1-g1')
  let reviewCount = 0
  if (bank) {
    const content = deriveNodeContent(bank)
    const items = [
      ...content.vocab.slice(0, 5).map((v, i) => ({ itemKey: `m1-g1:v${i}`, kind: 'vocab', front: v.es, back: v.en })),
      ...content.chunks.slice(0, 2).map((c, i) => ({ itemKey: `m1-g1:c${i}`, kind: 'chunk', front: c, back: c })),
    ]
    const dueNow = new Date(now - 3600 * 1000)
    const dueTomorrow = new Date(now + 24 * 3600 * 1000)
    for (let i = 0; i < items.length; i++) {
      await db.reviewItem.upsert({
        where: { userId_itemKey: { userId: user.id, itemKey: items[i].itemKey } },
        create: {
          userId: user.id,
          itemKey: items[i].itemKey,
          kind: items[i].kind,
          front: items[i].front,
          back: items[i].back,
          dueAt: i < 3 ? dueNow : dueTomorrow,
          reps: i < 3 ? 1 : 0,
        },
        update: {},
      })
      reviewCount++
    }
  }

  return { placed: true, sessions: sessionRows, reviewItems: reviewCount }
}

export async function seedR15() {
  const books = await seedBooks()
  const topics = await seedCourseModules()
  const demo = await seedDemoActivity() // historial del tablero GitHub + bio (R14)
  const immersive = await seedDemoImmersiveR15() // capa inmersiva (R15)
  console.log('\nR15 seed:')
  console.log(`   Books: ${books.sources} fuentes, ${books.items} bancos de ejercicios`)
  console.log(`   Módulos CEFR: ${topics} nodos creados (10 módulos x 45 h)`)
  console.log(`   Demo clásica: ${demo.topics} temas, ${demo.sessions} sesiones históricas`)
  console.log(`   Demo inmersiva: colocado=${immersive.placed}, ${immersive.sessions} sesiones de práctica, ${immersive.reviewItems} ítems SRS`)
}
