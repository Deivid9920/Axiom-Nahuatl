// FSRS scheduler tests
import { describe, test, expect } from 'vitest'
import { fsrsUpdate, type FsrsItem } from '@/lib/pedagogy'

describe('FSRS Scheduler', () => {
  const baseItem: FsrsItem = {
    term: 'deploy',
    stability: 1.0,  // days
    difficulty: 5.0,
    retrievability: 0.5,
    lastReviewedAt: null,
    reviewCount: 0,
    lapseCount: 0,
  }

  test('perfect rating increases stability', () => {
    const result = fsrsUpdate(baseItem, { rating: 5, reviewedAt: new Date() })
    expect(result.newStability).toBeGreaterThan(baseItem.stability)
    expect(result.newRetrievability).toBe(1.0)
    expect(result.newReviewCount).toBe(1)
  })

  test('again rating (1) decreases stability and counts lapse', () => {
    const result = fsrsUpdate(baseItem, { rating: 1, reviewedAt: new Date() })
    expect(result.newStability).toBeLessThan(baseItem.stability)
    expect(result.newLapseCount).toBe(1)
    expect(result.newReviewCount).toBe(1)
  })

  test('next review is in the future', () => {
    const now = new Date()
    const result = fsrsUpdate(baseItem, { rating: 3, reviewedAt: now })
    expect(result.nextReviewAt.getTime()).toBeGreaterThan(now.getTime())
  })

  test('higher rating → later next review', () => {
    const now = new Date()
    const result3 = fsrsUpdate(baseItem, { rating: 3, reviewedAt: now })
    const result5 = fsrsUpdate(baseItem, { rating: 5, reviewedAt: now })
    expect(result5.nextReviewAt.getTime()).toBeGreaterThan(result3.nextReviewAt.getTime())
  })

  test('difficulty increases on low rating', () => {
    const result = fsrsUpdate(baseItem, { rating: 1, reviewedAt: new Date() })
    expect(result.newDifficulty).toBeGreaterThan(baseItem.difficulty)
  })

  test('difficulty decreases on high rating', () => {
    const result = fsrsUpdate(baseItem, { rating: 5, reviewedAt: new Date() })
    expect(result.newDifficulty).toBeLessThan(baseItem.difficulty)
  })

  test('difficulty is clamped to [1, 10]', () => {
    let item = { ...baseItem, difficulty: 9.5 }
    const result = fsrsUpdate(item, { rating: 1, reviewedAt: new Date() })
    expect(result.newDifficulty).toBeLessThanOrEqual(10)

    item = { ...baseItem, difficulty: 1.5 }
    const result2 = fsrsUpdate(item, { rating: 5, reviewedAt: new Date() })
    expect(result2.newDifficulty).toBeGreaterThanOrEqual(1)
  })

  test('stability caps at 365 days', () => {
    let item = { ...baseItem, stability: 200 }
    // Multiple perfect ratings
    for (let i = 0; i < 10; i++) {
      item = {
        ...item,
        stability: fsrsUpdate(item, { rating: 5, reviewedAt: new Date() }).newStability,
        lastReviewedAt: new Date(),
      }
    }
    expect(item.stability).toBeLessThanOrEqual(365)
  })
})

describe('Weibull retention', () => {
  test('S(0) = 1', async () => {
    const { weibullSurvival } = await import('@/lib/pedagogy')
    expect(weibullSurvival(0)).toBeCloseTo(1, 5)
  })

  test('S(t) decreases monotonically', async () => {
    const { weibullSurvival } = await import('@/lib/pedagogy')
    const s1 = weibullSurvival(1)
    const s5 = weibullSurvival(5)
    const s10 = weibullSurvival(10)
    expect(s1).toBeGreaterThan(s5)
    expect(s5).toBeGreaterThan(s10)
  })

  test('expected lifetime is ~22.8 months', async () => {
    const { WEIBULL_EXPECTED_LIFETIME_MONTHS } = await import('@/lib/pedagogy')
    // β=0.7, η=18 → E[T] = 18 × Γ(2.43) ≈ 22.8
    expect(WEIBULL_EXPECTED_LIFETIME_MONTHS).toBeGreaterThan(20)
    expect(WEIBULL_EXPECTED_LIFETIME_MONTHS).toBeLessThan(25)
  })
})
