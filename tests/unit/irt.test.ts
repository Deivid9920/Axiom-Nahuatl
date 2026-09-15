// IRT 3PL Bayesian θ estimation tests
import { describe, test, expect } from 'vitest'
import { irtProbability, estimateTheta, type IrtItem } from '@/lib/pedagogy'

describe('IRT 3PL', () => {
  describe('irtProbability', () => {
    test('returns c (guessing) when theta is very low', () => {
      const item: IrtItem = { id: 'i1', a: 1, b: 0, c: 0.25 }
      const p = irtProbability(-10, item)
      expect(p).toBeCloseTo(0.25, 2)
    })

    test('returns ~1 when theta is very high', () => {
      const item: IrtItem = { id: 'i1', a: 1, b: 0, c: 0.25 }
      const p = irtProbability(10, item)
      expect(p).toBeGreaterThan(0.99)
    })

    test('returns (1+c)/2 when theta equals b', () => {
      const item: IrtItem = { id: 'i1', a: 1, b: 0, c: 0.2 }
      const p = irtProbability(0, item)
      // P(θ=b) = c + (1-c)/(1+1) = c + (1-c)/2 = (1+c)/2
      expect(p).toBeCloseTo((1 + 0.2) / 2, 3)
    })

    test('higher discrimination → steeper curve', () => {
      const easy: IrtItem = { id: 'i1', a: 0.5, b: 0, c: 0 }
      const hard: IrtItem = { id: 'i2', a: 2.0, b: 0, c: 0 }
      // At θ = -1 (below difficulty), higher discrimination = lower P
      const pEasy = irtProbability(-1, easy)
      const pHard = irtProbability(-1, hard)
      expect(pHard).toBeLessThan(pEasy)
    })
  })

  describe('estimateTheta', () => {
    test('all correct → theta increases', () => {
      const items: IrtItem[] = [
        { id: 'i1', a: 1, b: 0, c: 0.25 },
        { id: 'i2', a: 1, b: 0.5, c: 0.25 },
        { id: 'i3', a: 1, b: 1, c: 0.25 },
      ]
      const responses = items.map(i => ({ itemId: i.id, correct: true }))
      const result = estimateTheta(items, responses, { priorMean: 0, priorSd: 1 })
      expect(result.theta).toBeGreaterThan(0)
      expect(result.se).toBeGreaterThan(0)
      expect(result.se).toBeLessThan(2)
    })

    test('all incorrect → theta decreases', () => {
      const items: IrtItem[] = [
        { id: 'i1', a: 1, b: 0, c: 0.25 },
        { id: 'i2', a: 1, b: 0.5, c: 0.25 },
        { id: 'i3', a: 1, b: 1, c: 0.25 },
      ]
      const responses = items.map(i => ({ itemId: i.id, correct: false }))
      const result = estimateTheta(items, responses, { priorMean: 0, priorSd: 1 })
      expect(result.theta).toBeLessThan(0)
    })

    test('prior pulls estimate toward priorMean with weak data', () => {
      const items: IrtItem[] = [{ id: 'i1', a: 1, b: 0, c: 0.25 }]
      const responses = [{ itemId: 'i1', correct: true }]

      const withPrior0 = estimateTheta(items, responses, { priorMean: 0, priorSd: 0.5 })
      const withPrior2 = estimateTheta(items, responses, { priorMean: 2, priorSd: 0.5 })

      expect(withPrior2.theta).toBeGreaterThan(withPrior0.theta)
    })

    test('theta is clamped to valid range', () => {
      const items: IrtItem[] = [
        { id: 'i1', a: 1, b: 5, c: 0.25 },  // very hard item
      ]
      const responses = [{ itemId: 'i1', correct: true }]
      const result = estimateTheta(items, responses)
      expect(result.theta).toBeLessThanOrEqual(3.0)
      expect(result.theta).toBeGreaterThanOrEqual(-3.5)
    })

    test('returns valid CEFR level', () => {
      const items: IrtItem[] = [{ id: 'i1', a: 1, b: 0, c: 0.25 }]
      const responses = [{ itemId: 'i1', correct: true }]
      const result = estimateTheta(items, responses)
      expect(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).toContain(result.cefrLevel)
    })
  })
})
