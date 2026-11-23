// R22 — Corrector de respuestas de texto libre (puro, testeable, sin DOM).
// Corrección de auditoría R22: antes los checks de translate/dialogue/dictation
// comparaban la DISTANCIA de Levenshtein cruda contra un umbral tipo ratio
// (p. ej. `dist >= 0.82`), lo que (a) rechazaba la respuesta perfecta
// (distancia 0 < 0.82) y (b) aceptaba cualquier basura larga (distancia alta).
// En particular, traducciones literales con artículo («the family») se
// rechazaban y su versión recortada («family») pasaba: invertido.
// El ratio de similitud 0..1 restaura la semántica de los umbrales.

/** Normaliza texto de respuesta: minúsculas, recortes, comillas, puntuación final y espacios. */
export function normalizeAnswer(s: string): string {
  return s.toLowerCase().trim()
    .replace(/[’‘`]/g, "'")
    .replace(/[.!?¡¿]+$/g, '')
    .replace(/\s+/g, ' ')
}

/** Distancia de Levenshtein clásica (0 = idéntico). */
export function levenshteinSimple(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  const dp: number[] = Array(b.length + 1).fill(0).map((_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

/** Ratio de similitud 0..1 (1 = idéntico) derivado de la distancia. */
export function levenshteinRatio(a: string, b: string): number {
  const m = Math.max(a.length, b.length)
  return m === 0 ? 1 : 1 - levenshteinSimple(a, b) / m
}

/** Quita el artículo inicial (the/a/an): «the family» y «family» equivalen. */
export function stripLeadingArticle(s: string): string {
  return s.replace(/^(the|a|an)\s+/, '')
}

/**
 * ¿Acepta el input como traducción del esperado? Umbral = ratio mínimo de
 * similitud (tolera typos). El artículo inicial no cuenta en su contra:
 * «la familia» admite «the family» y «family» por igual.
 */
export function translationMatches(input: string, expected: string, threshold = 0.82): boolean {
  const a = stripLeadingArticle(normalizeAnswer(input))
  const b = stripLeadingArticle(normalizeAnswer(expected))
  return levenshteinRatio(a, b) >= threshold
}

/**
 * Comparación del ejercicio «order» tolerante a comas: viajan con la ficha y
 * pueden caer al final, mientras la respuesta las lleva internas (m6-g2).
 */
export function orderMatches(joined: string, answer: string): boolean {
  return normalizeAnswer(joined).replace(/,/g, '') === normalizeAnswer(answer).replace(/,/g, '')
}
