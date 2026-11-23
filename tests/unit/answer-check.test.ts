// R22 — Regresión del corrector de texto libre.
// Bug original: la distancia cruda se comparaba como ratio (dist >= 0.82):
// la respuesta PERFECTA se rechazaba (dist 0) y basura larga pasaba. Peor caso
// del usuario: «The family» rechazada; «Family» aceptada contra «the family».
import { describe, test, expect } from 'vitest'
import {
  normalizeAnswer, levenshteinSimple, levenshteinRatio,
  stripLeadingArticle, translationMatches, orderMatches,
} from '@/lib/answer-check'

describe('normalizeAnswer', () => {
  test('minúsculas, espacios, comillas y puntuación final', () => {
    expect(normalizeAnswer('  The   FAMILY! ')).toBe('the family')
    expect(normalizeAnswer('it’s')).toBe("it's")
    expect(normalizeAnswer('¿Hola?')).toBe('¿hola') // sólo puntuación final (comportamiento original)
  })
})

describe('levenshteinSimple / levenshteinRatio', () => {
  test('distancia clásica', () => {
    expect(levenshteinSimple('the family', 'the family')).toBe(0)
    expect(levenshteinSimple('family', 'the family')).toBe(4)
    expect(levenshteinSimple('', 'abc')).toBe(3)
  })
  test('ratio: 1 idéntico, menor con diferencias', () => {
    expect(levenshteinRatio('the family', 'the family')).toBe(1)
    expect(levenshteinRatio('the family', 'the famil')).toBeCloseTo(0.9, 5)
    expect(levenshteinRatio('perro', 'the family')).toBeLessThan(0.3)
    expect(levenshteinRatio('', '')).toBe(1)
  })
})

describe('stripLeadingArticle', () => {
  test('quita the/a/an iniciales sólo con espacio siguiente', () => {
    expect(stripLeadingArticle('the family')).toBe('family')
    expect(stripLeadingArticle('an engineer')).toBe('engineer')
    expect(stripLeadingArticle('there is')).toBe('there is') // 'the' no debe dispararse dentro de 'there'
    expect(stripLeadingArticle('a')).toBe('a')
  })
})

describe('translationMatches (translate 0.82 / dialogue 0.8)', () => {
  test('CASO DEL USUARIO: «The family» es respuesta correcta de «the family»', () => {
    expect(translationMatches('The family', 'the family')).toBe(true)
    expect(translationMatches('the family', 'the family')).toBe(true)
  })
  test('tolerancia a artículo en ambas direcciones', () => {
    expect(translationMatches('Family', 'the family')).toBe(true)   // sin artículo
    expect(translationMatches('the family', 'Family')).toBe(true)   // inverso
    expect(translationMatches('A family', 'the family')).toBe(true) // artículo distinto
  })
  test('tolera typos moderados y puntuación/espacios', () => {
    expect(translationMatches('the famly', 'the family')).toBe(true)
    expect(translationMatches('The family.', 'the family')).toBe(true)
    expect(translationMatches('the  family', 'the family')).toBe(true)
  })
  test('rechaza respuestas distintas y basura (antes pasaba cualquier cosa larga)', () => {
    expect(translationMatches('my family', 'the family')).toBe(false)
    expect(translationMatches('perro', 'the family')).toBe(false)
    expect(translationMatches('this is a completely different sentence here', 'the family')).toBe(false)
    expect(translationMatches('xyz abc def', 'the family')).toBe(false)
  })
  test('umbral de dialogue (0.8) mantiene la semántica', () => {
    expect(translationMatches('sure, here you are', 'Sure, here you are', 0.8)).toBe(true)
    expect(translationMatches('no thanks, see you', 'Sure, here you are', 0.8)).toBe(false)
  })
})

describe('orderMatches (tolerante a comas — caso m6-g2)', () => {
  test('ficha con coma final vs respuesta con coma interna', () => {
    // fichas: ['be','late,','the','If','miss','bus,',"you'll",'you'] en orden
    expect(orderMatches("If you miss the bus, you'll be late,", "If you miss the bus, you'll be late")).toBe(true)
  })
  test('sin comas también coincide; orden distinto no', () => {
    expect(orderMatches("If you miss the bus you'll be late", "If you miss the bus, you'll be late")).toBe(true)
    expect(orderMatches("you'll If the bus miss", "If you miss the bus, you'll be late")).toBe(false)
  })
})

describe('regresión documentada del bug original', () => {
  test('la lógica vieja (distancia cruda >= umbral) rechazaba la respuesta perfecta', () => {
    // Réplica del check antiguo para documentar el defecto corregido
    const oldCheck = (input: string, expected: string) =>
      levenshteinSimple(normalizeAnswer(input), normalizeAnswer(expected)) >= 0.82
    expect(oldCheck('the family', 'the family')).toBe(false) // ← el bug
    expect(translationMatches('the family', 'the family')).toBe(true) // ← el fix
  })
})
