// Seed R14 — «Libros» (corpus editorial), nodos de los 10 módulos CEFR y
// actividad demo del usuario admin@axiom.mx para las interfaces dinámicas.
// Ejecutado desde scripts/seed.ts (paso 12).

import { PrismaClient } from '@prisma/client'
import { BOOK_SOURCES } from '../src/lib/books/sources'
import { BANKS } from '../src/lib/books'
import { COURSE_MODULES } from '../src/lib/books/modules'

const db = new PrismaClient()

// Dificultad por bloque: replica la calibración del motor (grammar < vocab < review)
const BLOCK_DIFFICULTY: Record<string, number> = {
  grammar: 0.35, vocab: 0.45, writing: 0.55, speaking: 0.6, listening: 0.55, review: 0.75,
}

export async function seedBooks() {
  // Fuentes editoriales de referencia
  for (const src of BOOK_SOURCES) {
    await db.bookSource.upsert({
      where: { key: src.key },
      create: src,
      update: { title: src.title, author: src.author, publisher: src.publisher, year: src.year, cefrScope: src.cefrScope, block: src.block },
    })
  }

  // Bancos de ejercicios por lección
  let itemCount = 0
  let orderCounter = 0
  for (const bank of BANKS) {
    orderCounter++
    const book = await db.bookSource.findUnique({ where: { key: bank.bookKey } })
    if (!book) continue
    const existing = await db.bookItem.findFirst({ where: { bookId: book.id, moduleId: bank.moduleId, block: bank.block, title: bank.title } })
    if (existing) continue
    await db.bookItem.create({
      data: {
        bookId: book.id,
        moduleId: bank.moduleId,
        block: bank.block,
        title: bank.title,
        content: JSON.stringify(bank.content),
        difficulty: bank.difficulty,
        order: orderCounter,
      },
    })
    itemCount++
  }
  return { sources: BOOK_SOURCES.length, items: itemCount }
}

export async function seedCourseModules() {
  let created = 0
  for (const mod of COURSE_MODULES) {
    for (const lesson of mod.lessons) {
      const isFinal = lesson.block === 'final'
      const existing = await db.curriculumTopic.findFirst({ where: { title: lesson.title, module: mod.code } })
      if (existing) continue
      await db.curriculumTopic.create({
        data: {
          title: lesson.title,
          description: lesson.desc,
          skill: lesson.skill,
          cefrLevel: mod.levelGroup,
          module: mod.code,
          icon: lesson.icon,
          color: isFinal ? '#B5A6F5' : '#14A085',
          order: isFinal ? 99 : mod.lessons.findIndex(l => l.key === lesson.key) + 1,
          difficultyScore: isFinal ? 0.95 : (BLOCK_DIFFICULTY[lesson.block] ?? 0.5),
          isActive: true,
        },
      })
      created++
    }
  }
  return created
}

// Actividad demo: progreso parcial del módulo 1 + historial de 30 días para el
// tablero tipo GitHub del perfil. Idempotente: sólo si el demo no tiene actividad.
export async function seedDemoActivity() {
  const user = await db.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (!user) return { topics: 0, sessions: 0 }

  const existingProgress = await db.userTopicProgress.count({ where: { userId: user.id } })
  const existingSessions = await db.learningSession.count({ where: { userId: user.id } })
  if (existingProgress > 0 || existingSessions > 0) return { topics: 0, sessions: 0 }

  const m1Topics = await db.curriculumTopic.findMany({ where: { module: 'm1' }, orderBy: { order: 'asc' } })
  const plan = [85, 70, 90, 75] // scores de las primeras 4 lecciones completadas
  let completed = 0
  const now = Date.now()
  for (let i = 0; i < Math.min(plan.length, m1Topics.length); i++) {
    const t = m1Topics[i]
    if (t.order === 99) continue
    const daysAgo = 12 - i * 2
    await db.userTopicProgress.create({
      data: {
        userId: user.id,
        topicId: t.id,
        status: 'completed',
        progress: 1,
        score: plan[i],
        attemptsCount: 1,
        lastAttemptedAt: new Date(now - daysAgo * 86400000),
        completedAt: new Date(now - daysAgo * 86400000),
      },
    })
    completed++
  }

  // Historial de sesiones del mes en curso: patrón determinista de consistencia
  // (días alternos con 0-3 sesiones, hoy incluido) para el recuadro tipo GitHub.
  let sessions = 0
  const now2 = new Date()
  const daysSoFar = now2.getDate()
  for (let d = 1; d <= daysSoFar; d++) {
    const dow = new Date(now2.getFullYear(), now2.getMonth(), d).getDay()
    // Sin sesión ~1 de cada 5 días; el resto 1-3 sesiones
    const count = (d + dow) % 5 === 0 ? 0 : 1 + ((d * 3 + dow) % 3)
    for (let s = 0; s < count; s++) {
      const started = new Date(now2.getFullYear(), now2.getMonth(), d, 9 + s, 30, 0)
      await db.learningSession.create({
        data: {
          userId: user.id,
          module: s % 2 === 0 ? 'typing' : 'reading',
          mode: 'general',
          startedAt: started,
          endedAt: new Date(started.getTime() + 25 * 60000),
          durationSec: 25 * 60,
          status: 'completed',
          messagesCount: 6 + s,
        },
      })
      sessions++
    }
  }

  // Bio de demo para el perfil
  await db.userProfile.updateMany({
    where: { userId: user.id, bio: null },
    data: { bio: 'Aprendiz de inglés enfocado en el entorno profesional. Practico todos los días con los módulos CEFR de Axiom.' },
  })

  return { topics: completed, sessions }
}

export async function seedR14() {
  const books = await seedBooks()
  const topics = await seedCourseModules()
  const demo = await seedDemoActivity()
  console.log('\nR14 seed:')
  console.log(`   Books: ${books.sources} fuentes, ${books.items} bancos de ejercicios`)
  console.log(`   Módulos CEFR: ${topics} nodos creados (10 módulos x 45 h)`)
  console.log(`   Demo: ${demo.topics} temas completados, ${demo.sessions} sesiones históricas`)
}
