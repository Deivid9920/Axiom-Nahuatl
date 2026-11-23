// AXIOM — Mathematical Algorithms for Skill Evaluation

// 1. TYPING EVALUATION (Mecanografía)

export interface TypingKeystroke {
  char: string        // the character typed
  typed?: string      // the actual character produced (differs on error)
  expected: string    // the expected character
  position: number    // position in text
  timestamp: number   // ms from start
  correct: boolean
  corrected: boolean
}

export interface TypingResult {
  wpm: number              // words per minute (adjusted for accuracy)
  rawWpm: number           // raw WPM before penalty
  accuracy: number         // 0-1 (correct chars / total chars)
  consistency: number
  errorCount: number       // total errors
  correctedErrors: number
  uncorrectedErrors: number // errors left at end
  totalKeystrokes: number
  correctKeystrokes: number
  durationSec: number
  skillScore: number       // 0-100 composite
  cefrLevel: string        // inferred CEFR
  errors: { char: string; expected: string; typed: string; position: number; timestamp: number }[]
}

export function evaluateTyping(
  targetText: string,
  keystrokes: TypingKeystroke[],
  durationSec: number
): TypingResult {
  const totalChars = targetText.length
  const totalKeystrokes = keystrokes.length

  // Count correct/incorrect keystrokes
  let correctKeystrokes = 0
  let errorCount = 0
  let correctedErrors = 0
  const errors: TypingResult['errors'] = []

  for (const ks of keystrokes) {
    if (ks.correct) {
      correctKeystrokes++
    } else {
      errorCount++
      if (ks.corrected) {
        correctedErrors++
      }
      errors.push({
        char: ks.char,
        expected: ks.expected,
        typed: ks.typed || ks.char,
        position: ks.position,
        timestamp: ks.timestamp,
      })
    }
  }

  const uncorrectedErrors = errorCount - correctedErrors

  // Raw WPM: standard formula (5 chars = 1 word)
  const minutes = durationSec / 60
  const rawWpm = minutes > 0 ? (totalKeystrokes / 5) / minutes : 0

  // Accuracy: correct keystrokes / total keystrokes
  const accuracy = totalKeystrokes > 0 ? correctKeystrokes / totalKeystrokes : 0

  // Adjusted WPM: penalize for uncorrected errors
  // Formula: adjustedWPM = rawWPM * (1 - uncorrectedErrors / totalChars)
  const errorPenalty = totalChars > 0 ? uncorrectedErrors / totalChars : 0
  const wpm = rawWpm * Math.max(0, 1 - errorPenalty)

  // Consistency: based on inter-key interval standard deviation
  // Lower std dev = more consistent = better
  const intervals: number[] = []
  for (let i = 1; i < keystrokes.length; i++) {
    const interval = keystrokes[i].timestamp - keystrokes[i - 1].timestamp
    if (interval > 0 && interval < 5000) {  // filter outliers (>5s = pause)
      intervals.push(interval)
    }
  }

  let consistency = 1.0
  if (intervals.length > 5) {
    const mean = intervals.reduce((s, v) => s + v, 0) / intervals.length
    const variance = intervals.reduce((s, v) => s + (v - mean) ** 2, 0) / intervals.length
    const stdDev = Math.sqrt(variance)
    // Normalized: consistency = 1 - (stdDev / mean), clamped 0-1
    consistency = Math.max(0, Math.min(1, 1 - (stdDev / (mean || 1))))
  }

  // Skill Score (0-100): weighted composite
  // WPM component (40%): normalize WPM to 0-100 (60 WPM = 100)
  const wpmScore = Math.min(100, (wpm / 60) * 100)
  // Accuracy component (35%): accuracy * 100
  const accuracyScore = accuracy * 100
  // Consistency component (25%): consistency * 100
  const consistencyScore = consistency * 100

  const skillScore = Math.round(
    wpmScore * 0.40 + accuracyScore * 0.35 + consistencyScore * 0.25
  )

  // CEFR inference from typing performance
  const cefrLevel = inferTypingCEFR(wpm, accuracy, consistency)

  return {
    wpm: Math.round(wpm * 10) / 10,
    rawWpm: Math.round(rawWpm * 10) / 10,
    accuracy: Math.round(accuracy * 1000) / 1000,
    consistency: Math.round(consistency * 1000) / 1000,
    errorCount,
    correctedErrors,
    uncorrectedErrors,
    totalKeystrokes,
    correctKeystrokes,
    durationSec: Math.round(durationSec * 10) / 10,
    skillScore,
    cefrLevel,
    errors: errors.slice(0, 100),  // cap stored errors
  }
}

function inferTypingCEFR(wpm: number, accuracy: number, consistency: number): string {
  // Composite score
  const composite = wpm * 0.4 + accuracy * 60 * 0.35 + consistency * 60 * 0.25

  if (composite >= 55) return 'C1'
  if (composite >= 45) return 'B2'
  if (composite >= 35) return 'B1'
  if (composite >= 25) return 'A2'
  return 'A1'
}

/**
 * Generate typing advice based on performance
 */
export function getTypingAdvice(result: TypingResult): string[] {
  const advice: string[] = []

  if (result.wpm < 20) {
    advice.push('Enfócate en la precisión antes que la velocidad. Practica con textos cortos.')
  } else if (result.wpm < 40) {
    advice.push('Buen ritmo. Intenta mirar menos el teclado para ganar velocidad.')
  } else if (result.wpm < 60) {
    advice.push('Excelente velocidad. Trabaja en mantener la consistencia.')
  } else {
    advice.push('Velocidad excepcional. Desafíate con textos técnicos más complejos.')
  }

  if (result.accuracy < 0.85) {
    advice.push(`Tu precisión es ${(result.accuracy * 100).toFixed(0)}%. Practica teclear con más cuidado antes de acelerar.`)
  } else if (result.accuracy < 0.95) {
    advice.push(`Precisión de ${(result.accuracy * 100).toFixed(0)}%. Casi ahí — intenta reducir los errores sin corregir.`)
  } else {
    advice.push(`Precisión excelente (${(result.accuracy * 100).toFixed(0)}%). Mantén este nivel.`)
  }

  if (result.consistency < 0.5) {
    advice.push('Tu ritmo es irregular. Practica ejercicios de tecleo continuo para mejorar la fluidez.')
  } else if (result.consistency < 0.75) {
    advice.push('Ritmo moderadamente consistente. Sigue practicando para estabilizarlo.')
  } else {
    advice.push('Ritmo muy consistente. Tu tecleo es fluido y uniforme.')
  }

  if (result.uncorrectedErrors > 5) {
    advice.push(`Tienes ${result.uncorrectedErrors} errores sin corregir. Revisa tu texto antes de enviar.`)
  }

  return advice
}

// 2. TRANSLATION EVALUATION (Traducción)

export interface TranslationEvaluation {
  bleuScore: number           // 0-1 BLEU-like n-gram matching
  levenshteinDist: number     // character-level edit distance
  wordAccuracy: number        // 0-1 correct words / total words
  semanticSimilarity: number  // 0-1 cosine similarity
  grammarScore: number        // 0-1 heuristic grammar check
  vocabularyScore: number     // 0-1 vocabulary match
  overallScore: number        // 0-100 composite
  cefrLevel: string           // inferred CEFR
  errors: { type: string; position: number; expected: string; got: string; suggestion: string }[]
  matchedVocab: string[]
  missedVocab: string[]
}

export function evaluateTranslation(
  userTranslation: string,
  targetText: string,
  targetVocab: string[] = []
): TranslationEvaluation {
  const userWords = tokenize(userTranslation)
  const targetWords = tokenize(targetText)

  // 1. BLEU-like score (simplified BLEU-4)
  const bleuScore = computeBLEU(userWords, targetWords)

  // 2. Levenshtein distance (character-level)
  const levenshteinDist = levenshteinDistance(
    userTranslation.toLowerCase().trim(),
    targetText.toLowerCase().trim()
  )

  // 3. Word accuracy: fuzzy word matching
  const { wordAccuracy, errors } = computeWordAccuracy(userWords, targetWords)

  // 4. Semantic similarity: cosine similarity of word frequency vectors
  const semanticSimilarity = computeSemanticSimilarity(userWords, targetWords)

  // 5. Grammar score: heuristic checks
  const grammarScore = computeGrammarScore(userTranslation, targetText)

  // 6. Vocabulary score: percentage of target vocabulary used
  const { vocabularyScore, matchedVocab, missedVocab } = computeVocabularyScore(
    userTranslation,
    targetVocab
  )

  // Overall score (0-100)
  const overallScore = Math.round(
    bleuScore * 100 * 0.25 +
    wordAccuracy * 100 * 0.25 +
    semanticSimilarity * 100 * 0.20 +
    grammarScore * 100 * 0.15 +
    vocabularyScore * 100 * 0.15
  )

  // CEFR inference
  const cefrLevel = inferTranslationCEFR(overallScore, grammarScore, vocabularyScore)

  return {
    bleuScore: Math.round(bleuScore * 1000) / 1000,
    levenshteinDist,
    wordAccuracy: Math.round(wordAccuracy * 1000) / 1000,
    semanticSimilarity: Math.round(semanticSimilarity * 1000) / 1000,
    grammarScore: Math.round(grammarScore * 1000) / 1000,
    vocabularyScore: Math.round(vocabularyScore * 1000) / 1000,
    overallScore,
    cefrLevel,
    errors,
    matchedVocab,
    missedVocab,
  }
}

/**
 * Tokenize text into lowercase words
 */
function tokenize(text: string): string[] {
  return text.toLowerCase().trim().match(/\b[\w']+\b/g) || []
}

/**
 * Compute BLEU-like score (simplified BLEU-4 with brevity penalty)
 */
function computeBLEU(candidate: string[], reference: string[]): number {
  if (candidate.length === 0 || reference.length === 0) return 0

  const maxN = Math.min(4, candidate.length, reference.length)
  let logSum = 0

  for (let n = 1; n <= maxN; n++) {
    const candidateNgrams = getNgrams(candidate, n)
    const referenceNgrams = getNgrams(reference, n)

    if (candidateNgrams.length === 0) continue

    // Count matches (clipped)
    const refCounts = new Map<string, number>()
    for (const ng of referenceNgrams) {
      refCounts.set(ng, (refCounts.get(ng) || 0) + 1)
    }

    let matches = 0
    const candCounts = new Map<string, number>()
    for (const ng of candidateNgrams) {
      candCounts.set(ng, (candCounts.get(ng) || 0) + 1)
    }

    for (const [ng, count] of candCounts) {
      const refCount = refCounts.get(ng) || 0
      matches += Math.min(count, refCount)
    }

    const precision = matches / candidateNgrams.length
    if (precision === 0) return 0  // geometric mean with 0 = 0

    logSum += Math.log(precision)
  }

  // Brevity penalty
  const bp = candidate.length < reference.length
    ? Math.exp(1 - reference.length / candidate.length)
    : 1

  return bp * Math.exp(logSum / maxN)
}

function getNgrams(words: string[], n: number): string[] {
  const ngrams: string[] = []
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '))
  }
  return ngrams
}

/**
 * Levenshtein distance (character-level edit distance)
 */
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
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return dp[m][n]
}

/**
 * Word-level accuracy with fuzzy matching (Levenshtein <= 1 = match)
 */
function computeWordAccuracy(
  userWords: string[],
  targetWords: string[]
): { wordAccuracy: number; errors: { type: string; position: number; expected: string; got: string; suggestion: string }[] } {
  const errors: { type: string; position: number; expected: string; got: string; suggestion: string }[] = []
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
      // Fuzzy match: Levenshtein distance <= 1 (typo tolerance)
      const dist = levenshteinDistance(userWord, targetWord)
      if (dist <= 1 && targetWord.length > 3) {
        correct++  // accept as correct (minor typo)
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
          suggestion: `Usa "${targetWord}" en lugar de "${userWord}"`,
        })
      }
    }
  }

  const wordAccuracy = maxLen > 0 ? correct / maxLen : 0
  return { wordAccuracy, errors: errors.slice(0, 50) }
}

/**
 * Semantic similarity using cosine similarity of word frequency vectors
 */
function computeSemanticSimilarity(userWords: string[], targetWords: string[]): number {
  // Build word frequency vectors
  const userFreq = new Map<string, number>()
  const targetFreq = new Map<string, number>()

  for (const w of userWords) userFreq.set(w, (userFreq.get(w) || 0) + 1)
  for (const w of targetWords) targetFreq.set(w, (targetFreq.get(w) || 0) + 1)

  // Get all unique words
  const allWords = new Set([...userFreq.keys(), ...targetFreq.keys()])

  // Compute dot product and magnitudes
  let dotProduct = 0
  let userMag = 0
  let targetMag = 0

  for (const word of allWords) {
    const u = userFreq.get(word) || 0
    const t = targetFreq.get(word) || 0
    dotProduct += u * t
    userMag += u * u
    targetMag += t * t
  }

  if (userMag === 0 || targetMag === 0) return 0
  return dotProduct / (Math.sqrt(userMag) * Math.sqrt(targetMag))
}

function computeGrammarScore(userText: string, targetText: string): number {
  let score = 1.0
  const userWords = tokenize(userText)
  const targetWords = tokenize(targetText)

  // Check 1: Starts with capital letter
  if (userText.trim().length > 0 && !/^[A-Z]/.test(userText.trim())) {
    score -= 0.15
  }

  // Check 2: Ends with proper punctuation
  if (userText.trim().length > 0 && !/[.!?]$/.test(userText.trim())) {
    score -= 0.15
  }

  // Check 3: Word count ratio (too short or too long = penalty)
  const ratio = targetWords.length > 0 ? userWords.length / targetWords.length : 0
  if (ratio < 0.5) {
    score -= 0.20  // too short
  } else if (ratio > 2.0) {
    score -= 0.15  // too long
  } else if (ratio < 0.7 || ratio > 1.5) {
    score -= 0.10  // somewhat off
  }

  // Check 4: Check for common grammatical errors
  const lowerText = userText.toLowerCase()
  // Double spaces
  if (/\s{2,}/.test(userText)) score -= 0.05
  // Missing space after comma/period
  if (/[,\.][a-zA-Z]/.test(userText)) score -= 0.05
  // Check for "a" vs "an" (basic)
  if (/\ba [aeiouAEIOU]/.test(lowerText)) score -= 0.05
  // Check for subject-verb agreement (very basic: "I are", "he don't")
  if (/\bI are\b/i.test(userText)) score -= 0.10
  if (/\b(he|she|it) don't\b/i.test(userText)) score -= 0.10

  return Math.max(0, Math.min(1, score))
}

/**
 * Vocabulary score: percentage of target vocabulary words used
 */
function computeVocabularyScore(
  userText: string,
  targetVocab: string[]
): { vocabularyScore: number; matchedVocab: string[]; missedVocab: string[] } {
  if (targetVocab.length === 0) {
    return { vocabularyScore: 1.0, matchedVocab: [], missedVocab: [] }
  }

  const userLower = userText.toLowerCase()
  const matched: string[] = []
  const missed: string[] = []

  for (const word of targetVocab) {
    // Check if word appears as a whole word (not substring)
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i')
    if (regex.test(userLower)) {
      matched.push(word)
    } else {
      missed.push(word)
    }
  }

  const vocabularyScore = matched.length / targetVocab.length
  return { vocabularyScore, matchedVocab: matched, missedVocab: missed }
}

/**
 * Infer CEFR level from translation performance
 */
function inferTranslationCEFR(overallScore: number, grammarScore: number, vocabularyScore: number): string {
  const composite = overallScore * 0.5 + grammarScore * 100 * 0.25 + vocabularyScore * 100 * 0.25

  if (composite >= 85) return 'C1'
  if (composite >= 70) return 'B2'
  if (composite >= 55) return 'B1'
  if (composite >= 40) return 'A2'
  return 'A1'
}

/**
 * Generate translation advice based on performance
 */
export function getTranslationAdvice(eval_: TranslationEvaluation): string[] {
  const advice: string[] = []

  if (eval_.overallScore >= 85) {
    advice.push('¡Excelente traducción! Tu nivel es muy bueno.')
  } else if (eval_.overallScore >= 70) {
    advice.push('Buena traducción. Pequeños detalles a pulir.')
  } else if (eval_.overallScore >= 55) {
    advice.push('Traducción aceptable. Revisa los errores marcados para mejorar.')
  } else {
    advice.push('Necesitas practicar más. Repasa el vocabulario y la estructura de oraciones.')
  }

  if (eval_.grammarScore < 0.7) {
    advice.push('Revisa la gramática: mayúsculas iniciales, puntuación y estructura de oraciones.')
  }

  if (eval_.vocabularyScore < 0.5 && eval_.missedVocab.length > 0) {
    advice.push(`Vocabulario faltante: ${eval_.missedVocab.slice(0, 5).join(', ')}. Apréndelo para la próxima.`)
  }

  if (eval_.wordAccuracy < 0.7) {
    advice.push('Tu traducción tiene varias palabras incorrectas. Compara con la respuesta correcta.')
  }

  if (eval_.semanticSimilarity < 0.6) {
    advice.push('El significado de tu traducción difiere del original. Asegúrate de captar la idea principal.')
  }

  if (eval_.errors.some(e => e.type === 'missing_word')) {
    advice.push('Faltan palabras en tu traducción. Asegúrate de traducir toda la oración.')
  }

  return advice
}

// 3. SKILL UPDATE ALGORITHM

/**
 * Update user's skill score based on module performance.
 * Uses exponential moving average for smooth progression.
 *
 * @param currentScore Current skill score (0-100)
 * @param sessionScore Session performance score (0-100)
 * @param alpha Learning rate (0-1, default 0.15 = 15% weight to new session)
 * @returns New skill score
 */
export function updateSkillScore(
  currentScore: number,
  sessionScore: number,
  alpha: number = 0.15
): number {
  const newScore = currentScore * (1 - alpha) + sessionScore * alpha
  // Clamp to 0-100
  return Math.max(0, Math.min(100, Math.round(newScore * 10) / 10))
}

/**
 * Map skill score (0-100) to CEFR level
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
 * Get skill module mapping: which module exercises which skill
 */
export const SKILL_MODULE_MAP: Record<string, string[]> = {
  reading: ['reading', 'translation'],
  writing: ['text', 'typing', 'translation'],
  listening: ['voice', 'conversation'],
  speaking: ['conversation', 'voice'],
}
