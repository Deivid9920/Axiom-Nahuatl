// R15 — Repetición espaciada (SRS) — motor SM-2-lite, 100 % algorítmico.
// Los ítems que el usuario aprende en cada nodo entran a una cola que los
// trae de vuelta a 1, 3, 7, 16, 35… días (curva del olvido de Ebbinghaus).
// No usa LLM: la programación es matemática determinista y testeable.

export const EASE_START = 2.5
export const EASE_MIN = 1.3
export const EASE_MAX = 2.8
/** Umbral de calidad que separa «recordado» de «olvidado» (0-1). */
export const RECALL_THRESHOLD = 0.6

export interface SrsState {
  ease: number
  intervalDays: number
  reps: number
  lapses: number
}

export interface SrsUpdate extends SrsState {
  dueAt: Date
  lastReviewedAt: Date
}

function clampEase(ease: number): number {
  return Math.max(EASE_MIN, Math.min(EASE_MAX, ease))
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from)
  d.setDate(d.getDate() + Math.max(1, Math.round(days)))
  return d
}

/**
 * Programa el siguiente repaso de un ítem.
 * @param state estado actual del ítem (un ítem nuevo usa los valores por defecto)
 * @param q calidad del recuerdo 0-1 (0 = olvidado, 1 = perfecto; aciertos parciales permitidos)
 */
export function scheduleReview(state: SrsState, q: number, now: Date = new Date()): SrsUpdate {
  const quality = Math.max(0, Math.min(1, q))
  let { ease, intervalDays, reps, lapses } = state

  if (quality < RECALL_THRESHOLD) {
    // Olvido: vuelve al principio de la escalera con menos facilidad.
    reps = 0
    lapses += 1
    intervalDays = 1
    ease = clampEase(ease - 0.2)
  } else {
    reps += 1
    if (reps === 1) intervalDays = 1
    else if (reps === 2) intervalDays = 3
    else intervalDays = Math.round(intervalDays * ease)
    // La facilidad sube con respuestas seguras y baja con dudas.
    if (quality >= 0.9) ease = clampEase(ease + 0.1)
    else if (quality < 0.75) ease = clampEase(ease - 0.15)
  }

  return { ease, intervalDays, reps, lapses, dueAt: addDays(now, intervalDays), lastReviewedAt: now }
}

/** Etiqueta amable del estado del ítem (para la UI de repaso). */
export function reviewOutcomeLabel(q: number): 'olvidado' | 'dudoso' | 'bien' | 'perfecto' {
  if (q < RECALL_THRESHOLD) return 'olvidado'
  if (q < 0.75) return 'dudoso'
  if (q < 0.9) return 'bien'
  return 'perfecto'
}
