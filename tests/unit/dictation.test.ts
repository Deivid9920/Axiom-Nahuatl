// Evaluación de dictado — comprensión auditiva
import { describe, test, expect } from 'vitest'
import { evaluateDictation, getDictationAdvice } from '@/lib/algorithms'

describe('evaluateDictation', () => {
  test('una transcripción idéntica puntúa 100%', () => {
    const text = 'In atl temo itech tepetl'
    const r = evaluateDictation(text, text)
    expect(r.wordAccuracy).toBe(1)
    expect(r.score).toBe(100)
    expect(r.errors).toHaveLength(0)
    expect(r.phonemesAtRisk).toHaveLength(0)
  })

  test('ignora mayúsculas y puntuación', () => {
    const r = evaluateDictation('IN ATL, TEMO.', 'in atl temo')
    expect(r.wordAccuracy).toBe(1)
  })

  // Regresión del defecto central del módulo.
  test('una confusión de fonema NO se perdona como errata', () => {
    // xochitl → sochitl: la x /ʃ/ oída como s.
    const r = evaluateDictation('in sochitl', 'in xochitl')

    expect(r.correctWords).toBe(1)
    expect(r.wordAccuracy).toBe(0.5)
    expect(r.errors[0].type).toBe('phoneme_error')
    expect(r.phonemesAtRisk.some(p => p.startsWith('x '))).toBe(true)
  })

  test('detecta la pérdida de tl', () => {
    // tlalli → talli: la africada lateral oída como t simple.
    const r = evaluateDictation('in talli', 'in tlalli')
    expect(r.errors[0].type).toBe('phoneme_error')
    expect(r.phonemesAtRisk.some(p => p.startsWith('tl '))).toBe(true)
  })

  test('detecta la confusión de tz con s', () => {
    const r = evaluateDictation('mestli', 'metztli')
    expect(r.errors[0].type).toBe('phoneme_error')
    expect(r.phonemesAtRisk.some(p => p.startsWith('tz '))).toBe(true)
  })

  test('una errata sin consecuencia fonética sí se perdona', () => {
    // Vocal cambiada que no toca ningún contraste del náhuatl.
    const r = evaluateDictation('in tepetl in tonatiah', 'in tepetl in tonatiuh')
    expect(r.errors[0].type).toBe('typo')
    expect(r.correctWords).toBe(4)
    expect(r.phonemesAtRisk).toHaveLength(0)
  })

  test('registra palabras que faltan y que sobran', () => {
    const faltante = evaluateDictation('in atl', 'in atl temo')
    expect(faltante.errors.some(e => e.type === 'missing_word')).toBe(true)

    const sobrante = evaluateDictation('in atl temo itech', 'in atl temo')
    expect(sobrante.errors.some(e => e.type === 'extra_word')).toBe(true)
  })

  test('el mismo contraste no se reporta dos veces', () => {
    const r = evaluateDictation('in talli in tetl', 'in tlalli in tletl')
    const tlEntries = r.phonemesAtRisk.filter(p => p.startsWith('tl '))
    expect(tlEntries).toHaveLength(1)
  })
})

describe('getDictationAdvice', () => {
  test('no afirma que se entendió bien cuando hubo fallos de fonema', () => {
    const r = evaluateDictation('in sochitl', 'in xochitl')
    const advice = getDictationAdvice(r)

    // Regresión: el consejo se emitía junto a los sonidos fallados (mensajes contradictorios)
    expect(advice.some(a => a.includes('entendiste el audio correctamente'))).toBe(false)
    expect(advice.some(a => a.includes('Practica el contraste'))).toBe(true)
  })

  test('sí lo afirma cuando sólo hubo erratas inocuas', () => {
    const r = evaluateDictation('in tepetl in tonatiah', 'in tepetl in tonatiuh')
    const advice = getDictationAdvice(r)
    expect(advice.some(a => a.includes('entendiste el audio correctamente'))).toBe(true)
  })

  test('sugiere volver a escuchar cuando la precisión es baja', () => {
    const r = evaluateDictation('completamente distinto aqui', 'in atl temo itech tepetl')
    const advice = getDictationAdvice(r)
    expect(advice.some(a => a.includes('Vuelve a escuchar'))).toBe(true)
  })
})
