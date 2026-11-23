// Pruebas del motor adaptativo (R14): desbloqueo de módulos, selección de
// ejercicios por banda de dificultad, puntuación y desplazamiento acotado de theta.
import { describe, it, expect } from 'vitest'
import {
  moduleStats,
  canAdvance,
  thetaToDifficulty,
  pickExercises,
  attemptScore,
  thetaShift,
  skillFromBlock,
  ADVANCE_MIN_AVG_SCORE,
} from '@/lib/adaptive'
import { COURSE_MODULES } from '@/lib/books'
import { bankForLesson } from '@/lib/books'

const completedStats = (score = 85): ReturnType<typeof moduleStats> => ({
  done: 13, total: 13, finalDone: true, pct: 100, avgScore: score,
})

describe('Regla de desbloqueo de módulos', () => {
  it('el módulo 1 siempre está abierto (sin módulo previo)', () => {
    expect(canAdvance(null, -3, -3).unlocked).toBe(true)
  })

  it('bloquea cuando faltan lecciones del módulo anterior', () => {
    const stats = moduleStats([
      ...Array.from({ length: 10 }, (_, i) => ({ status: 'completed', score: 90, isFinal: false })),
      ...Array.from({ length: 3 }, () => ({ status: 'not_started', score: null, isFinal: false })),
      { status: 'completed', score: 90, isFinal: true },
    ])
    const d = canAdvance(stats, -2.5, 0)
    expect(d.unlocked).toBe(false)
    expect(d.reason).toContain('lecciones')
  })

  it('bloquea si la evaluación final no está completada', () => {
    const stats = moduleStats([
      ...Array.from({ length: 13 }, () => ({ status: 'completed', score: 90, isFinal: false })),
      { status: 'not_started', score: null, isFinal: true },
    ])
    const d = canAdvance(stats, -2.5, 0)
    expect(d.unlocked).toBe(false)
    expect(d.reason).toContain('evaluación final')
  })

  it(`bloquea con promedio menor a ${ADVANCE_MIN_AVG_SCORE} aunque el módulo esté completo`, () => {
    const d = canAdvance(completedStats(60), -2.5, 0)
    expect(d.unlocked).toBe(false)
    expect(d.reason).toContain('promedio')
  })

  it('bloquea si theta no respalda el piso del módulo destino', () => {
    const d = canAdvance(completedStats(90), 1.0, 0.2)
    expect(d.unlocked).toBe(false)
    expect(d.reason).toContain('métricas')
  })

  it('desbloquea con módulo completo, buen promedio y theta suficiente', () => {
    const d = canAdvance(completedStats(85), -1.0, -0.5)
    expect(d.unlocked).toBe(true)
    expect(d.reason).toBeNull()
  })
})

describe('Selección adaptativa de ejercicios', () => {
  it('thetaToDifficulty mapea theta -3..2 a 0..1 acotado', () => {
    expect(thetaToDifficulty(-3)).toBe(0)
    expect(thetaToDifficulty(2)).toBe(1)
    expect(thetaToDifficulty(10)).toBe(1)
    expect(thetaToDifficulty(-10)).toBe(0)
  })

  it('grammar devuelve tipos del bloque grammar en cantidad pedida', () => {
    const bank = bankForLesson('m1-g1')
    expect(bank).toBeDefined()
    const rng = () => 0.5 // determinista
    const picked = pickExercises(bank!, -2, 6, rng)
    expect(picked.length).toBe(6)
    for (const p of picked) expect(['mcq', 'gap', 'order']).toContain(p.kind)
  })

  it('speaking devuelve solo diálogos guiados', () => {
    const bank = bankForLesson('m1-s1')
    const picked = pickExercises(bank!, -2, 4)
    expect(picked.length).toBeGreaterThan(0)
    for (const p of picked) expect(p.kind).toBe('dialogue')
  })

  it('review añade lectura de recepción cuando el banco la trae', () => {
    const bank = bankForLesson('m1-r1')
    expect(bank?.content.reading?.length).toBeGreaterThan(0)
    const picked = pickExercises(bank!, -1, 6)
    expect(picked.some(p => p.kind === 'reading')).toBe(true)
  })

  it('no excede los ítems disponibles del banco', () => {
    const bank = bankForLesson('m1-l1')
    const picked = pickExercises(bank!, -2, 20)
    expect(picked.length).toBe((bank!.content.dictation || []).length)
  })
})

describe('Métricas del intento', () => {
  it('attemptScore calcula proporción 0-1', () => {
    expect(attemptScore(3, 6)).toBe(0.5)
    expect(attemptScore(6, 6)).toBe(1)
    expect(attemptScore(0, 0)).toBe(0)
  })

  it('skillFromBlock mapea bloques a habilidades CEFR', () => {
    expect(skillFromBlock('listening')).toBe('listening')
    expect(skillFromBlock('speaking')).toBe('speaking')
    expect(skillFromBlock('writing')).toBe('writing')
    expect(skillFromBlock('grammar')).toBe('reading')
    expect(skillFromBlock('review')).toBe('reading')
  })

  it('thetaShift está acotado a +-0.25 y premia aciertos difíciles', () => {
    const up = thetaShift(-2, 0.9, 1)
    const down = thetaShift(-2, 0.1, 0)
    expect(up).toBeGreaterThan(-2)
    expect(down).toBeLessThan(-2)
    expect(Math.abs(thetaShift(-2, 1, 1) - (-2))).toBeLessThanOrEqual(0.25 + 1e-9)
    // clamps extremos
    expect(thetaShift(2, 1, 1)).toBe(2)
    expect(thetaShift(-3, 0, 0)).toBe(-3)
  })
})

describe('Corpus de los 10 módulos', () => {
  it('10 módulos con 45 h y 14 nodos cada uno', () => {
    expect(COURSE_MODULES.length).toBe(10)
    for (const m of COURSE_MODULES) {
      expect(m.hours).toBe(45)
      expect(m.lessons.length).toBe(14)
      const hourSum = m.lessons.reduce((a, l) => a + l.hours, 0)
      expect(hourSum).toBe(45)
      // títulos únicos dentro del módulo (el camino los empareja por título)
      const titles = m.lessons.map(l => l.title)
      expect(new Set(titles).size).toBe(titles.length)
    }
  })

  it('cada lección no-final tiene banco de ejercicios', () => {
    for (const m of COURSE_MODULES) {
      for (const l of m.lessons) {
        if (l.block === 'final') continue
        const bank = bankForLesson(`${m.code}-${l.key}`)
        expect(bank, `banco de ${m.code}-${l.key}`).toBeDefined()
      }
    }
  })

  it('los bancos citan obras de la bibliografía editorial', () => {
    for (const m of COURSE_MODULES) {
      for (const l of m.lessons) {
        if (l.block === 'final') continue
        const bank = bankForLesson(`${m.code}-${l.key}`)
        expect(bank?.bookKey.length).toBeGreaterThan(3)
      }
    }
  })
})
