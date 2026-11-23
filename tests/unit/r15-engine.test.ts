// R15 — pruebas del motor SRS (SM-2-lite) y del scoring algorítmico.
import { describe, it, expect } from 'vitest'
import { scheduleReview, reviewOutcomeLabel, EASE_MIN, EASE_MAX } from '@/lib/srs'
import { scoreWriting, scoreSpeaking } from '@/lib/scoring'
import { thetaToAvance, avanceLabel, thetaToCefrGroup } from '@/lib/adaptive/avance'

const NOW = new Date('2026-01-15T10:00:00Z')
const NEW = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 }

describe('SRS scheduleReview', () => {
  it('primer repaso correcto programa a 1 día', () => {
    const r = scheduleReview(NEW, 1, NOW)
    expect(r.reps).toBe(1)
    expect(r.intervalDays).toBe(1)
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + 24 * 3600 * 1000)
  })

  it('segundo acierto cae a 3 días y el tercero usa ease', () => {
    const r1 = scheduleReview(NEW, 1, NOW)
    const r2 = scheduleReview(r1, 1, NOW)
    expect(r2.reps).toBe(2)
    expect(r2.intervalDays).toBe(3)
    const r3 = scheduleReview(r2, 1, NOW)
    expect(r3.reps).toBe(3)
    expect(r3.intervalDays).toBe(Math.round(3 * r3.ease))
    expect(r3.intervalDays).toBeGreaterThanOrEqual(4)
  })

  it('el olvido (q<0.6) reinicia la escalera y castiga ease', () => {
    const r1 = scheduleReview(NEW, 1, NOW)
    const r2 = scheduleReview(r1, 1, NOW)
    const r3 = scheduleReview({ ...r2, intervalDays: 6 }, 1, NOW)
    const lapsed = scheduleReview(r3, 0.2, NOW)
    expect(lapsed.reps).toBe(0)
    expect(lapsed.lapses).toBe(1)
    expect(lapsed.intervalDays).toBe(1)
    expect(lapsed.ease).toBeLessThan(r3.ease)
  })

  it('ease queda acotado dentro de los límites', () => {
    let state = NEW
    for (let i = 0; i < 20; i++) state = scheduleReview(state, 1, NOW)
    expect(state.ease).toBeLessThanOrEqual(EASE_MAX)
    let bad = { ...NEW, ease: EASE_MIN + 0.05 }
    for (let i = 0; i < 10; i++) bad = scheduleReview(bad, 0, NOW)
    expect(bad.ease).toBeGreaterThanOrEqual(EASE_MIN)
  })

  it('etiquetas de outcome cubren los rangos', () => {
    expect(reviewOutcomeLabel(0)).toBe('olvidado')
    expect(reviewOutcomeLabel(0.7)).toBe('dudoso')
    expect(reviewOutcomeLabel(0.8)).toBe('bien')
    expect(reviewOutcomeLabel(1)).toBe('perfecto')
  })
})

describe('scoreWriting (rúbrica algorítmica)', () => {
  const task = { minWords: 8, targets: [{ en: 'I am', es: 'yo soy' }, { en: 'my name is', es: 'mi nombre es' }] }

  it('texto completo con estructuras puntúa alto', () => {
    const r = scoreWriting('My name is Lupita. I am an engineer from Mexico, and I love this city.', task)
    expect(r.score).toBeGreaterThanOrEqual(0.75)
    expect(r.missingTargets).toHaveLength(0)
  })

  it('texto corto y sin estructuras puntúa bajo', () => {
    const r = scoreWriting('hi', task)
    expect(r.score).toBeLessThanOrEqual(0.25)
    expect(r.missingTargets).toContain('I am')
  })

  it('vacío puntúa cero', () => {
    expect(scoreWriting('', task).score).toBe(0)
  })
})

describe('scoreSpeaking (similitud de tokens con tolerancia)', () => {
  const expected = 'My name is Lupita and I am from Mexico'

  it('repetición perfecta puntúa alto', () => {
    const r = scoreSpeaking('my name is lupita and i am from mexico', expected)
    expect(r.score).toBeGreaterThanOrEqual(0.9)
  })

  it('omisiones bajan el score y se reportan', () => {
    const r = scoreSpeaking('my name is lupita', expected)
    expect(r.score).toBeLessThan(0.8)
    expect(r.missed.length).toBeGreaterThan(0)
  })

  it('errata de una letra se tolera', () => {
    const r = scoreSpeaking('my nane is lupita and i am from mexico', expected)
    expect(r.matched).toContain('name')
  })

  it('sin voz puntúa cero con feedback', () => {
    const r = scoreSpeaking('', expected)
    expect(r.score).toBe(0)
    expect(r.feedback).toContain('No se detectó')
  })
})

describe('Avance (traducción amable de theta)', () => {
  it('mapea el rango theta a 0-100', () => {
    expect(thetaToAvance(-3)).toBe(0)
    expect(thetaToAvance(-0.5)).toBe(50)
    expect(thetaToAvance(2)).toBe(100)
  })

  it('etiquetas crecientes con el avance', () => {
    const labels = [0, 30, 50, 70, 95].map(avanceLabel)
    expect(labels).toEqual(['Iniciándote', 'Cimentando', 'Progresando', 'Consolidando', 'Dominando'])
  })

  it('theta a grupo MCER coherente con los pisos de módulo', () => {
    expect(thetaToCefrGroup(-3)).toBe('A1')
    expect(thetaToCefrGroup(-1)).toBe('A2')
    expect(thetaToCefrGroup(1)).toBe('B1')
  })
})
