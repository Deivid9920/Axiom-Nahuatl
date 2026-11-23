// R15 — Evaluación algorítmica de producción (sin LLM).
// Escritura: rúbrica estructural (longitud, uso de las estructuras objetivo,
// variedad léxica, ortografía básica de puntuación/mayúsculas).
// Oral: similitud de tokens con tolerancia a erratas (distancia <= 1)
// contra la línea esperada del diálogo.

export interface WritingTarget {
  en: string // chunk o estructura que el alumno debe usar
  es: string // pista en español
}

export interface WritingCheck {
  key: 'length' | 'targets' | 'variety' | 'mechanics'
  label: string
  ok: boolean
  detail: string
}

export interface WritingResult {
  score: number // 0-1
  checks: WritingCheck[]
  missingTargets: string[]
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function words(s: string): string[] {
  return norm(s).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean)
}

/** Levenshtein con tope 2 (solo para tolerancia de erratas en tokens cortos). */
function withinEditDistance(a: string, b: string, max = 1): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > max) return false
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
    if (Math.min(...prev) > max) return false
  }
  return prev[b.length] <= max
}

export interface WritingTask {
  targets: WritingTarget[]
  minWords: number
}

export function scoreWriting(text: string, task: WritingTask): WritingResult {
  const t = (text || '').trim()
  const ws = words(t)
  const checks: WritingCheck[] = []
  const missingTargets: string[] = []

  // 1. Longitud mínima
  const lengthOk = ws.length >= task.minWords
  checks.push({
    key: 'length',
    label: `Escribiste al menos ${task.minWords} palabras`,
    ok: lengthOk,
    detail: `${ws.length} / ${task.minWords} palabras`,
  })

  // 2. Uso de las estructuras objetivo (chunks del nodo)
  const low = norm(t)
  let used = 0
  for (const target of task.targets) {
    const hit = low.includes(norm(target.en))
    if (hit) used++
    else missingTargets.push(target.en)
  }
  const targetsOk = task.targets.length === 0 || used / task.targets.length >= 0.5
  checks.push({
    key: 'targets',
    label: 'Usaste las estructuras del nodo',
    ok: targetsOk,
    detail: task.targets.length ? `${used} / ${task.targets.length} estructuras` : 'libre',
  })

  // 3. Variedad léxica (type-token ratio con mínimo absoluto de términos únicos)
  const unique = new Set(ws)
  const ttr = ws.length ? unique.size / ws.length : 0
  const varietyOk = ws.length === 0 || unique.size >= Math.max(6, Math.floor(task.minWords * 0.6)) || ttr >= 0.55
  checks.push({
    key: 'variety',
    label: 'Variedad de vocabulario',
    ok: varietyOk,
    detail: `${unique.size} palabras distintas`,
  })

  // 4. Mecánica: mayúscula inicial y puntuación final en la mayoría de frases
  const sentences = t.split(/[.!?]+\s|[.!?]+$/).map(s => s.trim()).filter(Boolean)
  const starts = sentences.filter(s => /^[A-Z]/.test(s)).length
  const endsOk = /[.!?]"?$/.test(t)
  const mechanicsOk = t.length > 0 && (sentences.length === 0 || starts / sentences.length >= 0.5) && endsOk
  checks.push({
    key: 'mechanics',
    label: 'Mayúsculas y puntuación',
    ok: mechanicsOk,
    detail: endsOk ? 'frases bien cerradas' : 'revisa el punto final',
  })

  const okCount = checks.filter(c => c.ok).length
  const score = t.length === 0 ? 0 : Math.round((okCount / checks.length) * 100) / 100
  return { score, checks, missingTargets }
}

export interface SpeakingResult {
  score: number // 0-1
  matched: string[]
  missed: string[]
  feedback: string
}

/**
 * Compara lo que dijo el alumno (transcripción del navegador) con la línea
 * esperada del diálogo. F1 de tokens con tolerancia de erratas.
 */
export function scoreSpeaking(transcript: string, expected: string): SpeakingResult {
  const said = words(transcript)
  const want = words(expected)
  if (!want.length) return { score: 0, matched: [], missed: [], feedback: 'No hay línea esperada.' }
  if (!said.length) return { score: 0, matched: [], missed: want, feedback: 'No se detectó tu voz; inténtalo de nuevo cerca del micrófono.' }

  const wantLeft = [...want]
  const matched: string[] = []
  const missed: string[] = []
  for (const w of said) {
    const idx = wantLeft.findIndex(x => x === w || (x.length > 3 && withinEditDistance(w, x, 1)))
    if (idx >= 0) {
      matched.push(wantLeft[idx])
      wantLeft.splice(idx, 1)
    }
  }
  missed.push(...wantLeft)

  const precision = said.length ? matched.length / said.length : 0
  const recall = matched.length / want.length
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0
  // Perdonar una errata y premiar la completitud.
  const score = Math.max(0, Math.min(1, Math.round((f1 * 0.9 + (missed.length === 0 ? 0.1 : 0)) * 100) / 100))
  let feedback: string
  if (score >= 0.9) feedback = '¡Perfecto! Suena natural.'
  else if (score >= 0.7) feedback = 'Muy bien; casi perfecto.'
  else if (score >= 0.4) feedback = missed.length ? `Te faltaron: ${missed.slice(0, 3).join(', ')}` : 'Cerca; vuelve a intentarlo.'
  else feedback = 'Escucha la línea y repítela despacio.'
  return { score, matched, missed, feedback }
}
