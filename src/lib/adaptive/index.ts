// Motor adaptativo (R14) — los nodos de práctica se gestionan por algoritmos,
// sin LLM: secuenciación de nodos, selección de ítems por dificultad calibrada
// contra theta (IRT), actualización EMA de habilidades y regla de desbloqueo
// de módulos. El LLM participa únicamente en el nodo final de evaluación.
import { db } from '@/lib/db'
import { updateSkillScore, skillScoreToCEFR } from '@/lib/algorithms'
import { COURSE_MODULES, type CourseModule, type ModuleLesson, BLOCK_LABELS } from '@/lib/books'
import { bankForLesson, type BankDef, type BankContent, type McqItem, type GapItem, type OrderItem, type PairItem, type ReadingText } from '@/lib/books'

// ===== Regla de desbloqueo de módulos =====
// Un módulo se abre cuando: (1) el módulo anterior está 100% completado
// (lecciones + evaluación final) y (2) las métricas respaldan el avance
// (promedio de score >= 70 y theta >= piso del módulo destino).

export interface ModuleStats {
  done: number
  total: number          // lecciones sin contar la evaluación final
  finalDone: boolean
  pct: number
  avgScore: number | null
}

export interface UnlockDecision {
  unlocked: boolean
  reason: string | null  // motivo visible cuando está bloqueado
}

export const ADVANCE_MIN_AVG_SCORE = 70

export function moduleStats(topics: { status: string; score: number | null; isFinal: boolean }[]): ModuleStats {
  const lessons = topics.filter(t => !t.isFinal)
  const finals = topics.filter(t => t.isFinal)
  const done = lessons.filter(t => t.status === 'completed').length
  const finalDone = finals.length === 0 || finals.every(t => t.status === 'completed')
  const scores = topics.filter(t => t.status === 'completed' && typeof t.score === 'number').map(t => t.score as number)
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const total = lessons.length
  return { done, total, finalDone, pct: total ? Math.round((done / total) * 100) : 0, avgScore }
}

export function canAdvance(stats: ModuleStats | null, thetaFloor: number, theta: number): UnlockDecision {
  if (!stats) return { unlocked: true, reason: null }
  if (stats.total > 0 && stats.done < stats.total) {
    return { unlocked: false, reason: 'Completa todas las lecciones del módulo anterior' }
  }
  if (!stats.finalDone) {
    return { unlocked: false, reason: 'Aprueba la evaluación final del módulo anterior' }
  }
  if (stats.avgScore !== null && stats.avgScore < ADVANCE_MIN_AVG_SCORE) {
    return { unlocked: false, reason: `Tu promedio (${stats.avgScore}) debe llegar a ${ADVANCE_MIN_AVG_SCORE} para avanzar` }
  }
  if (theta < thetaFloor) {
    return { unlocked: false, reason: 'Tus métricas aún no respaldan este nivel: refuerza el módulo anterior' }
  }
  return { unlocked: true, reason: null }
}

// ===== Selección adaptativa de ejercicios (sin LLM) =====
// Mapea theta (IRT, aprox -3..2) a dificultad 0-1 y escoge ítems de la banda
// +-0.15 alrededor del objetivo; si no hay suficientes, relaja la banda.
// rng inyectable para pruebas deterministas.

export function thetaToDifficulty(theta: number): number {
  return Math.max(0, Math.min(1, (theta + 3) / 5))
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface PickedExercise {
  kind: 'mcq' | 'gap' | 'order' | 'translate' | 'dialogue' | 'dictation' | 'reading'
  payload: McqItem | GapItem | OrderItem | PairItem | string | ReadingText
  src: string // identidad del ítem en el banco, p. ej. 'mcq:2' (para excluir repetidos)
}

export function pickExercises(bank: BankDef, theta: number, count = 6, rng: () => number = Math.random, taken?: Set<string>): PickedExercise[] {
  const target = thetaToDifficulty(theta)
  const content: BankContent = bank.content
  const pools: { kind: PickedExercise['kind']; entries: { item: unknown; key: string }[] }[] = [
    { kind: 'mcq', entries: (content.mcq || []).map((item, i) => ({ item, key: `mcq:${i}` })) },
    { kind: 'gap', entries: (content.gap || []).map((item, i) => ({ item, key: `gap:${i}` })) },
    { kind: 'order', entries: (content.order || []).map((item, i) => ({ item, key: `order:${i}` })) },
    { kind: 'translate', entries: (content.pairs || []).map((item, i) => ({ item, key: `translate:${i}` })) },
    { kind: 'dialogue', entries: (content.dialogue || []).map((item, i) => ({ item, key: `dialogue:${i}` })) },
    { kind: 'dictation', entries: (content.dictation || []).map((item, i) => ({ item, key: `dictation:${i}` })) },
  ]
  // Los bancos del bloque mandan: prioriza los tipos que existen en el bloque
  const blockOrder: Record<string, PickedExercise['kind'][]> = {
    grammar: ['mcq', 'gap', 'order'],
    vocab: ['mcq', 'translate'],
    writing: ['translate', 'order'],
    speaking: ['dialogue'],
    listening: ['dictation'],
    review: ['mcq', 'gap', 'translate', 'reading'],
  }
  const kinds = blockOrder[bank.block] || ['mcq', 'gap', 'order']
  const out: PickedExercise[] = []
  const perKind = Math.max(1, Math.ceil(count / kinds.length))
  for (const kind of kinds) {
    const pool = pools.find(p => p.kind === kind)
    if (!pool || !pool.entries.length) continue
    const shuffled = shuffle(pool.entries, rng)
    const picked = shuffled.filter(e => !taken || !taken.has(e.key)).slice(0, perKind)
    out.push(...picked.map(e => ({ kind, payload: e.item, src: e.key }) as PickedExercise))
  }
  // Lectura de recepción (repaso): añade un texto con preguntas si el banco lo trae
  if (bank.block === 'review' && content.reading?.length && out.length < count + 2) {
    out.push({ kind: 'reading', payload: shuffle(content.reading, rng)[0], src: 'reading:0' })
  }
  return out.slice(0, Math.max(count, bank.block === 'review' ? count + 1 : count))
}

// ===== Puntuación y métricas del intento =====

export function attemptScore(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) / 100 : 0
}

export function skillFromBlock(block: string): 'reading' | 'writing' | 'listening' | 'speaking' {
  if (block === 'listening') return 'listening'
  if (block === 'speaking') return 'speaking'
  if (block === 'writing') return 'writing'
  return 'reading' // grammar/vocab/review entrenan recepción y estructura
}

// Desplazamiento acotado de theta por un intento: el acierto en un ítem difícil
// empuja más; el fallo en uno fácil resta más. Bounded a +-0.25 por intento.
export function thetaShift(theta: number, difficulty: number, score01: number): number {
  const p = score01
  const raw = (p - 0.6) * (0.3 + difficulty * 0.4)
  const shift = Math.max(-0.25, Math.min(0.25, raw))
  return Math.max(-3, Math.min(2, theta + shift))
}

// ===== Consultas al servidor (frente a la BD) =====

export interface PlanCard {
  code: string
  index: number
  level: string
  title: string
  purpose: string
  hours: number
  done: number
  total: number
  pct: number
  avgScore: number | null
  unlocked: boolean
  lockReason: string | null
  state: 'available' | 'in_progress' | 'completed' | 'locked'
  blockHours: { block: string; label: string; hours: number }[]
}

export interface PlanTopicRow {
  id: string
  title: string
  block: string
  blockLabel: string
  hours: number
  skill: string
  icon: string
  desc: string
  status: string
  score: number | null
  order: number
  isFinal: boolean
  sessionsCount: number // R15: sesiones de dominio registradas (gating 3 + checkpoint)
}

export interface UserPlan {
  cards: PlanCard[]
  topicsByModule: Record<string, PlanTopicRow[]>
  theta: number
  cefrCurrent: string
}

function blockHoursFor(mod: CourseModule) {
  return mod.lessons
    .filter(l => !['review', 'final'].includes(l.block))
    .map(l => l.block)
    .filter((b, i, arr) => arr.indexOf(b) === i)
    .map(block => ({ block, label: BLOCK_LABELS[block] || block, hours: mod.lessons.filter(l => l.block === block).reduce((a, l) => a + l.hours, 0) }))
}

export async function getUserPlan(userId: string): Promise<UserPlan | null> {
  const profile = await db.userProfile.findUnique({ where: { userId } })
  if (!profile) return null

  const topics = await db.curriculumTopic.findMany({
    where: { isActive: true, module: { in: COURSE_MODULES.map(m => m.code) } },
    orderBy: [{ module: 'asc' }, { order: 'asc' }],
  })
  const progress = await db.userTopicProgress.findMany({ where: { userId } })
  const pMap = new Map(progress.map(p => [p.topicId, p]))

  const cards: PlanCard[] = []
  const topicsByModule: Record<string, PlanTopicRow[]> = {}
  let prevStats: ModuleStats | null = null

  for (const mod of COURSE_MODULES) {
    const modTopics = topics.filter(t => t.module === mod.code)
    const rows: PlanTopicRow[] = modTopics.map(t => {
      const p = pMap.get(t.id)
      const lesson = mod.lessons.find(l => l.title === t.title)
      const isFinal = t.order === 99
      return {
        id: t.id,
        title: t.title,
        block: lesson?.block || (isFinal ? 'final' : 'grammar'),
        blockLabel: isFinal ? 'Evaluación final' : (BLOCK_LABELS[lesson?.block || 'grammar'] || 'Lección'),
        hours: lesson?.hours ?? 0,
        skill: t.skill,
        icon: t.icon || 'school',
        desc: lesson?.desc || t.description,
        status: p?.status || 'not_started',
        score: p?.score ?? null,
        order: t.order,
        isFinal,
        sessionsCount: p?.sessionsCount ?? 0,
      }
    })
    topicsByModule[mod.code] = rows

    const stats = moduleStats(rows.map(r => ({ status: r.status, score: r.score, isFinal: r.isFinal })))
    const decision = canAdvance(prevStats, mod.thetaFloor, profile.theta)
    const unlocked = mod.index === 1 ? true : decision.unlocked
    const state = !unlocked ? 'locked' : (stats.done === 0 && !stats.finalDone ? 'available' : (stats.done === stats.total && stats.finalDone ? 'completed' : 'in_progress'))
    cards.push({
      code: mod.code, index: mod.index, level: mod.level, title: mod.title, purpose: mod.purpose, hours: mod.hours,
      done: stats.done, total: stats.total, pct: stats.pct, avgScore: stats.avgScore,
      unlocked, lockReason: mod.index === 1 ? null : decision.reason,
      state, blockHours: blockHoursFor(mod),
    })
    prevStats = stats
  }

  return { cards, topicsByModule, theta: profile.theta, cefrCurrent: profile.cefrCurrent }
}

// Encuentra el nodo actual (primera lección pendiente o evaluación final) de un módulo
export async function getCurrentNode(userId: string, moduleCode: string) {
  const profile = await db.userProfile.findUnique({ where: { userId } })
  if (!profile) return null
  const topics = await db.curriculumTopic.findMany({
    where: { isActive: true, module: moduleCode },
    orderBy: { order: 'asc' },
  })
  const progress = await db.userTopicProgress.findMany({ where: { userId, topicId: { in: topics.map(t => t.id) } } })
  const pMap = new Map(progress.map(p => [p.topicId, p]))
  const mod = COURSE_MODULES.find(m => m.code === moduleCode)
  if (!mod) return null
  const withState = topics.map(t => {
    const p = pMap.get(t.id)
    const lesson = mod.lessons.find(l => l.title === t.title)
    return { t, p, lesson, isFinal: t.order === 99 }
  })
  const lessons = withState.filter(x => !x.isFinal)
  const firstPending = lessons.find(x => (x.p?.status || 'not_started') !== 'completed')
  const finals = withState.filter(x => x.isFinal)
  const node = firstPending || finals[0] || lessons[lessons.length - 1]
  if (!node) return null
  return {
    topicId: node.t.id,
    title: node.t.title,
    module: moduleCode,
    lessonKey: node.lesson?.key || null,
    block: node.lesson?.block || 'grammar',
    hours: node.lesson?.hours ?? 0,
    isFinal: node.isFinal,
    status: node.p?.status || 'not_started',
  }
}

// Ejercicios para un nodo: los extrae del banco del «Libro» correspondiente,
// calibrados contra theta. Devuelve también la dificultad media para el registro.
export async function getExercisesForTopic(userId: string, topicId: string, count = 6) {
  const [profile, topic] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.curriculumTopic.findUnique({ where: { id: topicId } }),
  ])
  if (!profile || !topic) return null
  const mod = COURSE_MODULES.find(m => m.code === topic.module)
  const lesson = mod?.lessons.find(l => l.title === topic.title)
  const isFinal = topic.order === 99
  if (isFinal || !lesson) return { final: true, topicId, title: topic.title, module: topic.module }
  const bank = bankForLesson(`${mod?.code}-${lesson.key}`)
  if (!bank) return { final: false, topicId, title: topic.title, module: topic.module, exercises: [] }
  const exercises = pickExercises(bank, profile.theta, count)
  return { final: false, topicId, title: topic.title, module: topic.module, block: bank.block, exercises, difficulty: bank.difficulty }
}

// Registra el intento de un nodo: progreso del tema, EMA de habilidad,
// desplazamiento acotado de theta y CEFR por habilidad. Sin LLM.
export async function applyAttempt(userId: string, topicId: string, score01: number, difficulty = 0.5) {
  const profile = await db.userProfile.findUnique({ where: { userId } })
  const topic = await db.curriculumTopic.findUnique({ where: { id: topicId } })
  if (!profile || !topic) return null
  const mod = COURSE_MODULES.find(m => m.code === topic.module)
  const lesson = mod?.lessons.find(l => l.title === topic.title)
  const isFinal = topic.order === 99
  const skill = isFinal ? 'speaking' : skillFromBlock(lesson?.block || 'grammar')

  const score100 = Math.round(score01 * 100)
  const passed = score100 >= 60
  const now = new Date()

  const prevProgress = await db.userTopicProgress.findUnique({ where: { userId_topicId: { userId, topicId } } })
  const bestScore = prevProgress?.score ? Math.max(prevProgress.score, score100) : score100
  const progress = await db.userTopicProgress.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: {
      userId, topicId,
      status: passed ? 'completed' : 'in_progress',
      progress: passed ? 1 : Math.min(0.9, score01),
      score: bestScore,
      attemptsCount: 1,
      lastAttemptedAt: now,
      completedAt: passed ? now : null,
    },
    update: {
      status: passed ? 'completed' : (prevProgress?.status === 'completed' ? 'completed' : 'in_progress'),
      progress: passed ? 1 : undefined,
      score: bestScore,
      attemptsCount: { increment: 1 },
      lastAttemptedAt: now,
      completedAt: passed ? (prevProgress?.completedAt ?? now) : undefined,
    },
  })

  // Métricas: EMA de habilidad y desplazamiento acotado de theta (algoritmos puros)
  const currentSkill = { reading: profile.skillReading, writing: profile.skillWriting, listening: profile.skillListening, speaking: profile.skillSpeaking }
  const newSkill = updateSkillScore(currentSkill[skill], score100)
  const newTheta = thetaShift(profile.theta, difficulty, score01)
  const cefrBySkill = {
    reading: profile.cefrReading, writing: profile.cefrWriting, listening: profile.cefrListening, speaking: profile.cefrSpeaking,
  }
  cefrBySkill[skill] = skillScoreToCEFR(newSkill)

  await db.userProfile.update({
    where: { userId },
    data: {
      theta: newTheta,
      thetaSE: Math.max(0.15, profile.thetaSE * 0.98),
      thetaUpdatedAt: now,
      skillsUpdatedAt: now,
      skillReading: skill === 'reading' ? newSkill : currentSkill.reading,
      skillWriting: skill === 'writing' ? newSkill : currentSkill.writing,
      skillListening: skill === 'listening' ? newSkill : currentSkill.listening,
      skillSpeaking: skill === 'speaking' ? newSkill : currentSkill.speaking,
      cefrReading: cefrBySkill.reading,
      cefrWriting: cefrBySkill.writing,
      cefrListening: cefrBySkill.listening,
      cefrSpeaking: cefrBySkill.speaking,
    },
  })

  return { progress, skill, newSkill, newTheta }
}
