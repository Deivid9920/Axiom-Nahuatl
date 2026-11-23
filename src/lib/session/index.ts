// R15 — Session Composer: compone y registra sesiones de práctica inmersivas.
// Flujo pedagógico por sesión (sin LLM en ningún punto):
//   1. warmup    — 3 ítems SRS vencidos (recuperación activa, Ebbinghaus)
//   2. input     — historia del nodo con audio + vocabulario en contexto
//   3. notice    — 2 preguntas de descubrimiento de significado
//   4. practice  — ejercicios del banco calibrados contra theta
//   5. produce   — producción escrita (rúbrica) + oral (shadowing/diálogo)
//   6. checkpoint— mini-examen de dominio (solo en la sesión requerida final)
// Gating de dominio: el nodo se completa con REQUIRED_SESSIONS sesiones y un
// checkpoint >= CHECKPOINT_MIN. Ya no basta un intento rápido.
import { db } from '@/lib/db'
import { bankForLesson } from '@/lib/books'
import { COURSE_MODULES } from '@/lib/books'
import { deriveNodeContent } from '@/lib/books/content'
import { pickExercises, thetaShift, skillFromBlock } from '@/lib/adaptive'
import { thetaToAvance } from '@/lib/adaptive/avance'
import { updateSkillScore, skillScoreToCEFR } from '@/lib/algorithms'
import { getDueItems, commitNewItems, gradeReview } from '@/lib/srs/server'
import { scoreWriting, scoreSpeaking } from '@/lib/scoring'

export const REQUIRED_SESSIONS = 3
export const CHECKPOINT_MIN = 80
export const PRACTICE_ITEMS = 6
export const CHECKPOINT_ITEMS = 5
export const WARMUP_ITEMS = 3

export interface SessionExercise {
  kind: string
  payload: unknown
  src: string
}

export interface ComposedSession {
  topicId: string
  title: string
  module: string
  moduleTitle: string
  block: string
  blockLabel: string
  hours: number
  sessionNumber: number
  requiredSessions: number
  isProject: boolean
  completed: boolean
  warmup: { id: string; itemKey: string; front: string; back: string; reps: number }[]
  input: {
    storyTitle: string
    storyText: string
    audioLines: string[]
    vocab: { en: string; es: string }[]
    chunks: string[]
  }
  notice: { sentence: string; prompt: string; options: string[]; answer: number }[]
  practice: SessionExercise[]
  produce: {
    writing: { promptEs: string; targets: { en: string; es: string }[]; minWords: number }
    speaking: { instructionEs: string; expected: string; supportEs: string }
  }
  checkpoint: SessionExercise[] | null
}

function lessonOf(topicModule: string, topicTitle: string) {
  const mod = COURSE_MODULES.find(m => m.code === topicModule)
  const lesson = mod?.lessons.find(l => l.title === topicTitle)
  return { mod, lesson }
}

/** Compone la sesión siguiente para un nodo de práctica. */
export async function composeSession(userId: string, topicId: string): Promise<ComposedSession | { error: string } | { final: true }> {
  const [profile, topic] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.curriculumTopic.findUnique({ where: { id: topicId } }),
  ])
  if (!profile || !topic) return { error: 'No encontrado' }

  const isFinal = topic.order === 99
  if (isFinal) return { final: true }

  const { mod, lesson } = lessonOf(topic.module, topic.title)
  if (!mod || !lesson) return { error: 'El nodo no pertenece al curso' }

  const bank = bankForLesson(`${topic.module}-${lesson.key}`)
  if (!bank) return { error: 'El nodo no tiene banco de ejercicios' }

  const progress = await db.userTopicProgress.findUnique({
    where: { userId_topicId: { userId, topicId } },
  })
  const sessionNumber = (progress?.sessionsCount ?? 0) + 1
  const completed = progress?.status === 'completed'

  const content = deriveNodeContent(bank)
  const practice = pickExercises(bank, profile.theta, PRACTICE_ITEMS)
  const taken = new Set(practice.map(p => p.src))
  // Checkpoint: sólo cuando la sesión alcanza el número requerido y el nodo
  // sigue sin completar. Prefiere ítems no vistos en la práctica; si el banco
  // es pequeño, rellena reutilizando (segunda recuperación = aprendizaje).
  let checkpointPicks: ReturnType<typeof pickExercises> = []
  if (!completed && sessionNumber >= REQUIRED_SESSIONS) {
    checkpointPicks = pickExercises(bank, profile.theta, CHECKPOINT_ITEMS, Math.random, taken)
    if (checkpointPicks.length < 3) {
      const seen = new Set(checkpointPicks.map(p => p.src))
      const refill = pickExercises(bank, profile.theta, CHECKPOINT_ITEMS + PRACTICE_ITEMS)
        .filter(p => !seen.has(p.src))
      for (const p of refill) {
        if (checkpointPicks.length >= CHECKPOINT_ITEMS) break
        checkpointPicks.push(p)
        seen.add(p.src)
      }
    }
  }
  const checkpoint = checkpointPicks.length ? checkpointPicks : null

  const warmup = await getDueItems(userId, WARMUP_ITEMS)

  return {
    topicId,
    title: topic.title,
    module: topic.module,
    moduleTitle: mod.title,
    block: bank.block,
    blockLabel: content.isProject ? 'Proyecto de la semana' : lesson.block,
    hours: lesson.hours,
    sessionNumber,
    requiredSessions: REQUIRED_SESSIONS,
    isProject: content.isProject,
    completed,
    warmup,
    input: {
      storyTitle: content.story.title,
      storyText: content.story.text,
      audioLines: content.audioLines,
      vocab: content.vocab,
      chunks: content.chunks,
    },
    notice: content.notice.map(n => ({ sentence: n.sentence, prompt: n.prompt, options: n.options, answer: n.answer })),
    practice: practice.map(p => ({ kind: p.kind, payload: p.payload, src: p.src })),
    produce: content.task,
    checkpoint: checkpoint ? checkpoint.map(p => ({ kind: p.kind, payload: p.payload, src: p.src })) : null,
  }
}

export interface ApplySessionPayload {
  topicId: string
  secondsSpent?: number
  warmup?: { id: string; q: number }[]
  practice?: { correct: number; total: number }
  writing?: { text?: string }
  speaking?: { transcript?: string; selfReported?: boolean }
  checkpoint?: { correct: number; total: number }
}

/** Registra una sesión completa: SRS, métricas, progreso y gating. */
export async function applySession(userId: string, payload: ApplySessionPayload) {
  const topicId = payload.topicId
  const [profile, topic] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }),
    db.curriculumTopic.findUnique({ where: { id: payload.topicId } }),
  ])
  if (!profile || !topic) return { error: 'No encontrado' }
  if (topic.order === 99) return { error: 'La evaluación final usa su propia ruta' }

  const { mod, lesson } = lessonOf(topic.module, topic.title)
  if (!mod || !lesson) return { error: 'El nodo no pertenece al curso' }
  const bank = bankForLesson(`${topic.module}-${lesson.key}`)
  if (!bank) return { error: 'El nodo no tiene banco de ejercicios' }

  const content = deriveNodeContent(bank)
  const prevProgress = await db.userTopicProgress.findUnique({
    where: { userId_topicId: { userId, topicId } },
  })
  if (prevProgress?.status === 'completed') {
    return { error: 'Este nodo ya está completado' }
  }
  const sessionNumber = (prevProgress?.sessionsCount ?? 0) + 1

  // --- 1. SRS: calentar ítems vencidos ---
  let warmupScore: number | null = null
  if (payload.warmup?.length) {
    const qs = payload.warmup.map(w => Math.max(0, Math.min(1, w.q)))
    for (const w of payload.warmup) {
      await gradeReview(userId, w.id, Math.max(0, Math.min(1, w.q)))
    }
    warmupScore = qs.reduce((a, b) => a + b, 0) / qs.length
  }

  // --- 2. Práctica: score 0-1 y ajuste de theta ---
  const practiceScore =
    payload.practice && payload.practice.total > 0
      ? Math.max(0, Math.min(1, payload.practice.correct / payload.practice.total))
      : null
  const thetaBefore = profile.theta
  let theta = thetaBefore
  if (practiceScore !== null) {
    theta = thetaShift(theta, bank.difficulty, practiceScore)
  }

  // --- 3. Producción: scoring algorítmico autoritativo en el servidor ---
  let writingScore: number | null = null
  if (payload.writing?.text && payload.writing.text.trim().length > 0) {
    writingScore = scoreWriting(payload.writing.text, {
      targets: content.task.writing.targets,
      minWords: content.task.writing.minWords,
    }).score
  }
  let speakingScore: number | null = null
  if (payload.speaking?.transcript && payload.speaking.transcript.trim().length > 0) {
    speakingScore = scoreSpeaking(payload.speaking.transcript, content.task.speaking.expected).score
  } else if (payload.speaking?.selfReported) {
    speakingScore = 0.75 // auto-reportado sin micrófono: crédito parcial
  }

  // --- 4. Métricas: EMA por habilidad ---
  const now = new Date()
  const skills = {
    reading: profile.skillReading,
    writing: profile.skillWriting,
    listening: profile.skillListening,
    speaking: profile.skillSpeaking,
  }
  const cefr = {
    reading: profile.cefrReading,
    writing: profile.cefrWriting,
    listening: profile.cefrListening,
    speaking: profile.cefrSpeaking,
  }
  const touched: string[] = []
  if (practiceScore !== null) {
    const skill = skillFromBlock(bank.block)
    skills[skill] = updateSkillScore(skills[skill], practiceScore * 100)
    cefr[skill] = skillScoreToCEFR(skills[skill])
    touched.push(skill)
  }
  if (writingScore !== null) {
    skills.writing = updateSkillScore(skills.writing, writingScore * 100)
    cefr.writing = skillScoreToCEFR(skills.writing)
    touched.push('writing')
  }
  if (speakingScore !== null) {
    skills.speaking = updateSkillScore(skills.speaking, speakingScore * 100)
    cefr.speaking = skillScoreToCEFR(skills.speaking)
    touched.push('speaking')
  }

  // --- 5. Checkpoint de dominio ---
  let checkpointScore: number | null = null
  let completedNode = false
  if (payload.checkpoint && payload.checkpoint.total > 0 && sessionNumber >= REQUIRED_SESSIONS) {
    checkpointScore = Math.round((payload.checkpoint.correct / payload.checkpoint.total) * 100)
    completedNode = checkpointScore >= CHECKPOINT_MIN
  }

  // --- 6. Progreso del nodo (gating de dominio) ---
  const effective = completedNode ? REQUIRED_SESSIONS : Math.min(sessionNumber, REQUIRED_SESSIONS)
  const progressValue = completedNode
    ? 1
    : Math.round((effective / REQUIRED_SESSIONS) * 0.95 * 100) / 100
  const bestPractice = practiceScore !== null ? Math.round(practiceScore * 100) : 0
  const bestScore = Math.max(prevProgress?.score ?? 0, bestPractice, checkpointScore ?? 0)

  const progress = await db.userTopicProgress.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: {
      userId,
      topicId,
      status: completedNode ? 'completed' : 'in_progress',
      progress: progressValue,
      score: bestScore || null,
      attemptsCount: 1,
      sessionsCount: sessionNumber,
      lastAttemptedAt: now,
      completedAt: completedNode ? now : null,
    },
    update: {
      status: completedNode ? 'completed' : 'in_progress',
      progress: progressValue,
      score: bestScore || undefined,
      attemptsCount: { increment: 1 },
      sessionsCount: sessionNumber,
      lastAttemptedAt: now,
      completedAt: completedNode ? (prevProgress?.completedAt ?? now) : undefined,
    },
  })

  // --- 7. SRS: nuevos ítems del nodo entran a la cola (vencen mañana) ---
  const newItems = [
    ...content.vocab.slice(0, 5).map((v, i) => ({
      itemKey: `${bank.lessonKey}:v${i}`,
      kind: 'vocab',
      front: v.es,
      back: v.en,
    })),
    ...content.chunks.slice(0, 2).map((c, i) => ({
      itemKey: `${bank.lessonKey}:c${i}`,
      kind: 'chunk',
      front: c,
      back: c,
    })),
  ]
  const committed = await commitNewItems(userId, newItems)

  // --- 8. Registro de la sesión (tendencia de Avance y horas reales) ---
  await db.practiceSession.create({
    data: {
      userId,
      topicId,
      sessionNumber,
      secondsSpent: Math.max(0, Math.min(7200, Math.round(payload.secondsSpent ?? 0))),
      warmupScore,
      practiceScore,
      writingScore,
      speakingScore,
      checkpointScore,
      thetaBefore,
      thetaAfter: theta,
      completedNode,
    },
  })

  await db.userProfile.update({
    where: { userId },
    data: {
      theta,
      thetaSE: Math.max(0.15, profile.thetaSE * 0.98),
      thetaUpdatedAt: now,
      skillsUpdatedAt: now,
      skillReading: skills.reading,
      skillWriting: skills.writing,
      skillListening: skills.listening,
      skillSpeaking: skills.speaking,
      cefrReading: cefr.reading,
      cefrWriting: cefr.writing,
      cefrListening: cefr.listening,
      cefrSpeaking: cefr.speaking,
    },
  })

  return {
    ok: true as const,
    sessionNumber,
    requiredSessions: REQUIRED_SESSIONS,
    completed: completedNode,
    checkpointScore,
    progress,
    metrics: {
      theta,
      avance: thetaToAvance(theta),
      touched,
      newSkillScores: skills,
      cefr,
    },
    committedItems: committed,
  }
}
