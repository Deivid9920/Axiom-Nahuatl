// AXIOM — Evaluación algorítmica (sin LLM)

// Tipos
export interface DictationError {
  type: 'missing_word' | 'extra_word' | 'typo' | 'phoneme_error' | 'wrong_word'
  position: number
  expected: string
  got: string
  suggestion: string
  /** Contraste implicado, cuando el error es fonético. */
  phoneme?: string
}

export interface DictationResult {
  /** Proporción de palabras acertadas, 0-1. */
  wordAccuracy: number
  /** Puntuación 0-100 lista para alimentar el progreso de habilidad. */
  score: number
  totalWords: number
  correctWords: number
  errors: DictationError[]
  /** Fonemas del náhuatl implicados en los errores detectados. */
  phonemesAtRisk: string[]
}

// Fonemas problemáticos del náhuatl para hispanohablantes
// Cada entrada asocia una grafía con el rasgo que suele fallar al oído.
const NAHUATL_CONTRASTS: { grapheme: string; note: string }[] = [
  { grapheme: 'tl', note: 'tl /t͡ɬ/ — se confunde con una t simple' },
  { grapheme: 'tz', note: 'tz /t͡s/ — se confunde con s' },
  { grapheme: 'ch', note: 'ch /t͡ʃ/ — se confunde con x' },
  { grapheme: 'x', note: 'x /ʃ/ — se confunde con s o ch' },
  { grapheme: 'hu', note: 'hu /w/ — se pierde o se oye como u' },
  { grapheme: 'cu', note: 'cu /kʷ/ — se oye como c simple' },
  { grapheme: 'h', note: 'saltillo /ʔ/ — corte glotal, suele omitirse' },
]

// Dictado
export function evaluateDictation(
  userTranscription: string,
  originalText: string
): DictationResult {
  const userWords = tokenize(userTranscription)
  const targetWords = tokenize(originalText)

  const { wordAccuracy, errors, correct } = computeWordAccuracy(userWords, targetWords)

  return {
    wordAccuracy,
    score: Math.round(wordAccuracy * 1000) / 10,
    totalWords: targetWords.length,
    correctWords: correct,
    errors,
    phonemesAtRisk: detectPhonemesAtRisk(errors),
  }
}

function detectPhonemesAtRisk(errors: DictationError[]): string[] {
  const atRisk = new Set<string>()

  for (const err of errors) {
    if (err.type === 'missing_word' || err.type === 'extra_word') continue
    if (err.phoneme) { atRisk.add(err.phoneme); continue }
    const contrast = findAffectedContrast(err.got, err.expected)
    if (contrast) atRisk.add(contrast)
  }

  return Array.from(atRisk)
}

function findAffectedContrast(userWord: string, targetWord: string): string | null {
  for (const { grapheme, note } of NAHUATL_CONTRASTS) {
    if (countOccurrences(targetWord, grapheme) !== countOccurrences(userWord, grapheme)) {
      return note
    }
  }
  return null
}

function countOccurrences(word: string, sub: string): number {
  let n = 0
  let i = word.indexOf(sub)
  while (i !== -1) {
    n++
    i = word.indexOf(sub, i + 1)
  }
  return n
}

/**
 * Consejos accionables a partir del resultado de un dictado.
 */
export function getDictationAdvice(result: DictationResult): string[] {
  const advice: string[] = []

  if (result.wordAccuracy >= 0.9) {
    advice.push('Comprensión auditiva sólida. Sube al siguiente nivel de velocidad.')
  } else if (result.wordAccuracy < 0.5) {
    advice.push('Vuelve a escuchar el audio dos veces antes de transcribir; enfócate primero en el ritmo, luego en las palabras.')
  }

  for (const phoneme of result.phonemesAtRisk.slice(0, 3)) {
    advice.push(`Practica el contraste: ${phoneme}`)
  }

  // Este mensaje sólo es cierto si NINGÚN error tocó un contraste fonético.
  const typos = result.errors.filter(e => e.type === 'typo').length
  if (typos > 0 && typos === result.errors.length && result.phonemesAtRisk.length === 0) {
    advice.push('Sólo hubo diferencias mínimas de escritura: entendiste el audio correctamente.')
  }

  return advice
}

// Progreso de habilidad
export function updateSkillScore(
  currentScore: number,
  sessionScore: number,
  alpha: number = 0.15
): number {
  const newScore = currentScore * (1 - alpha) + sessionScore * alpha
  return Math.max(0, Math.min(100, Math.round(newScore * 10) / 10))
}

/**
 * Traduce una puntuación de habilidad (0-100) a la escala interna tipo MCER.
 */
export function skillScoreToCEFR(score: number): string {
  if (score >= 85) return 'C2'
  if (score >= 75) return 'C1'
  if (score >= 60) return 'B2'
  if (score >= 45) return 'B1'
  if (score >= 30) return 'A2'
  return 'A1'
}

/**
 * Qué módulo entrena cada habilidad. La plataforma cubre sólo las dos orales.
 */
export const SKILL_MODULE_MAP: Record<string, string[]> = {
  listening: ['listening'],
  speaking: ['pronunciation'],
}

// Helpers de comparación de texto
/** Tokenización consciente de Unicode: acentos del español y vocales largas del náhuatl. */
function tokenize(text: string): string[] {
  return text.toLowerCase().trim().match(/[\p{L}\p{M}']+/gu) || []
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,       // borrado
        dp[i][j - 1] + 1,       // inserción
        dp[i - 1][j - 1] + cost // sustitución
      )
    }
  }

  return dp[m][n]
}

function computeWordAccuracy(
  userWords: string[],
  targetWords: string[]
): { wordAccuracy: number; correct: number; errors: DictationError[] } {
  const errors: DictationError[] = []
  const maxLen = Math.max(userWords.length, targetWords.length)
  let correct = 0

  for (let i = 0; i < maxLen; i++) {
    const userWord = userWords[i] || ''
    const targetWord = targetWords[i] || ''

    if (!userWord && targetWord) {
      errors.push({
        type: 'missing_word',
        position: i,
        expected: targetWord,
        got: '',
        suggestion: `Falta la palabra "${targetWord}"`,
      })
    } else if (userWord && !targetWord) {
      errors.push({
        type: 'extra_word',
        position: i,
        expected: '',
        got: userWord,
        suggestion: `Palabra extra: "${userWord}"`,
      })
    } else if (userWord === targetWord) {
      correct++
    } else {
      // Tolerancia de erratas: sólo la diferencia mínima que no toca ningún contraste
      const contrast = findAffectedContrast(userWord, targetWord)
      const dist = levenshteinDistance(userWord, targetWord)

      if (contrast) {
        errors.push({
          type: 'phoneme_error',
          position: i,
          expected: targetWord,
          got: userWord,
          suggestion: `Escuchaste "${userWord}", pero era "${targetWord}" — ${contrast}`,
          phoneme: contrast,
        })
      } else if (dist <= 1 && targetWord.length > 3) {
        // Errata sin consecuencia fonética: cuenta como acierto de percepción.
        correct++
        errors.push({
          type: 'typo',
          position: i,
          expected: targetWord,
          got: userWord,
          suggestion: `Casi: "${userWord}" debería ser "${targetWord}"`,
        })
      } else {
        errors.push({
          type: 'wrong_word',
          position: i,
          expected: targetWord,
          got: userWord,
          suggestion: `Escuchaste "${userWord}", pero era "${targetWord}"`,
        })
      }
    }
  }

  const wordAccuracy = maxLen > 0 ? correct / maxLen : 0
  return { wordAccuracy, correct, errors: errors.slice(0, 50) }
}
