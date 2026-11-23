// AXIOM — Pedagogical Model
// IRT 3PL (Three-Parameter Logistic) with Bayesian θ estimation
// FSRS (Free Spaced Repetition Scheduler)
// Weibull retention model

import { logger, tracer, type Span } from '@/lib/observability'
import { thetaToCefr, type CefrLevel } from '@/lib/types'

// 1. IRT 3PL (Three-Parameter Logistic)
// P_j(θ) = c_j + (1 - c_j) / (1 + exp(-a_j(θ - b_j)))
// where:
//   a_j = discrimination
//   b_j = difficulty
//   c_j = guessing (lower asymptote)

export interface IrtItem {
  id: string
  a: number  // discrimination (typical: 0.5-2.0)
  b: number  // difficulty (typical: -3 to +2, same scale as θ)
  c: number  // guessing (typical: 0.0-0.25)
}

export interface IrtResponse {
  itemId: string
  correct: boolean
}

// Probability of correct response given θ
export function irtProbability(theta: number, item: IrtItem): number {
  const { a, b, c } = item
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)))
}

// Log-likelihood of a response given θ
function logLikelihood(theta: number, items: IrtItem[], responses: IrtResponse[]): number {
  let ll = 0
  for (let i = 0; i < items.length; i++) {
    const p = irtProbability(theta, items[i])
    const r = responses[i].correct ? 1 : 0
    const eps = 1e-10
    ll += r * Math.log(p + eps) + (1 - r) * Math.log(1 - p + eps)
  }
  return ll
}

// p(θ) = N(0, 1) prior
export interface ThetaEstimate {
  theta: number
  se: number  // standard error
  cefrLevel: CefrLevel
}

export function estimateTheta(
  items: IrtItem[],
  responses: IrtResponse[],
  opts: { priorMean?: number; priorSd?: number; parentSpan?: Span } = {}
): ThetaEstimate {
  const span = opts.parentSpan
  const priorMean = opts.priorMean ?? 0
  const priorSd = opts.priorSd ?? 1

  let bestTheta = priorMean
  let bestLogPost = -Infinity

  for (let t = -3.0; t <= 2.5; t += 0.05) {
    const ll = logLikelihood(t, items, responses)
    // Gaussian log-prior
    const lp = -0.5 * Math.pow((t - priorMean) / priorSd, 2) - Math.log(priorSd * Math.sqrt(2 * Math.PI))
    const logPost = ll + lp
    if (logPost > bestLogPost) {
      bestLogPost = logPost
      bestTheta = t
    }
  }

  // Newton refinement: 5 iterations
  for (let iter = 0; iter < 5; iter++) {
    const h = 0.01
    const f0 = logPosterior(bestTheta, items, responses, priorMean, priorSd)
    const fPlus = logPosterior(bestTheta + h, items, responses, priorMean, priorSd)
    const fMinus = logPosterior(bestTheta - h, items, responses, priorMean, priorSd)
    const grad = (fPlus - fMinus) / (2 * h)
    const hess = (fPlus - 2 * f0 + fMinus) / (h * h)
    if (Math.abs(hess) < 1e-8) break
    bestTheta = bestTheta - grad / hess
    // Clamp to valid range
    bestTheta = Math.max(-3.5, Math.min(3.0, bestTheta))
  }

  // Standard error: -1 / (second derivative of log-posterior at MAP)
  const h = 0.01
  const f0 = logPosterior(bestTheta, items, responses, priorMean, priorSd)
  const fPlus = logPosterior(bestTheta + h, items, responses, priorMean, priorSd)
  const fMinus = logPosterior(bestTheta - h, items, responses, priorMean, priorSd)
  const hess = (fPlus - 2 * f0 + fMinus) / (h * h)
  const se = hess < -1e-8 ? Math.sqrt(-1 / hess) : 1.0

  span?.setAttribute('irt.theta_estimate', bestTheta)
  span?.setAttribute('irt.se_estimate', se)
  span?.setAttribute('irt.items_count', items.length)

  return {
    theta: bestTheta,
    se,
    cefrLevel: thetaToCefr(bestTheta),
  }
}

function logPosterior(
  theta: number,
  items: IrtItem[],
  responses: IrtResponse[],
  priorMean: number,
  priorSd: number
): number {
  const ll = logLikelihood(theta, items, responses)
  const lp = -0.5 * Math.pow((theta - priorMean) / priorSd, 2) - Math.log(priorSd * Math.sqrt(2 * Math.PI))
  return ll + lp
}

// 2. FSRS (Free Spaced Repetition Scheduler)

export interface FsrsItem {
  term: string
  stability: number  // days
  difficulty: number  // 1-10
  retrievability: number  // 0-1
  lastReviewedAt: Date | null
  reviewCount: number
  lapseCount: number
}

export interface FsrsReviewResult {
  rating: 1 | 2 | 3 | 4 | 5  // 1=again, 2=hard, 3=good, 4=easy, 5=perfect
  reviewedAt: Date
}

export interface FsrsUpdate {
  newStability: number
  newDifficulty: number
  newRetrievability: number
  nextReviewAt: Date
  newReviewCount: number
  newLapseCount: number
}

const TARGET_R = 0.90

export function fsrsUpdate(item: FsrsItem, review: FsrsReviewResult): FsrsUpdate {
  // Compute current retrievability (decays with time since last review)
  let currentR = item.retrievability
  if (item.lastReviewedAt) {
    const daysSince = (review.reviewedAt.getTime() - item.lastReviewedAt.getTime()) / (1000 * 60 * 60 * 24)
    // R(t) = exp(-t / S)
    currentR = Math.exp(-daysSince / Math.max(item.stability, 0.1))
  }

  const rating = review.rating
  const isCorrect = rating >= 3

  let newD = item.difficulty + (3 - rating) * 0.4 - (item.difficulty - 5) * 0.2
  newD = Math.max(1, Math.min(10, newD))

  // Update stability (S)
  let newS: number
  if (isCorrect) {
    // Stability grows: S' = S * (1 + factor based on difficulty + rating)
    const difficultyFactor = (10 - newD) / 10  // 0.0-0.9
    const ratingFactor = (rating - 2) / 3  // 0.33-1.0
    const growthRate = 1 + difficultyFactor * ratingFactor * 2
    newS = item.stability * growthRate
  } else {
    // Stability shrinks on lapse
    newS = Math.max(0.1, item.stability * 0.3)
  }

  // Cap stability at 365 days (1 year)
  newS = Math.min(365, newS)

  // New retrievability = 1.0 if just reviewed
  const newR = 1.0

  // Next review: when R drops to TARGET_R
  // R(t) = exp(-t / S) → t = -S * ln(TARGET_R)
  const daysUntilNext = -newS * Math.log(TARGET_R)
  const nextReviewAt = new Date(review.reviewedAt.getTime() + daysUntilNext * 24 * 60 * 60 * 1000)

  return {
    newStability: newS,
    newDifficulty: newD,
    newRetrievability: newR,
    nextReviewAt,
    newReviewCount: item.reviewCount + 1,
    newLapseCount: isCorrect ? item.lapseCount : item.lapseCount + 1,
  }
}

// 3. Weibull Retention Model
// S(t) = exp(-(t/η)^β), β=0.7, η=18 → E[T] = η * Γ(1 + 1/β) ≈ 22.8 months
const WEIBULL_BETA = 0.7
const WEIBULL_ETA = 18  // months

export function weibullSurvival(tMonths: number): number {
  return Math.exp(-Math.pow(tMonths / WEIBULL_ETA, WEIBULL_BETA))
}

export function weibullHazard(tMonths: number): number {
  return (WEIBULL_BETA / WEIBULL_ETA) * Math.pow(tMonths / WEIBULL_ETA, WEIBULL_BETA - 1)
}

// Life expectancy E[T] = η * Γ(1 + 1/β)
export function weibullExpectedLifetime(): number {
  return WEIBULL_ETA * gamma(1 + 1 / WEIBULL_BETA)
}

// Lanczos approximation of the Gamma function
function gamma(z: number): number {
  const g = 7
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ]

  if (z < 0.5) {
    // Reflection formula
    return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z))
  }

  z -= 1
  let x = c[0]
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i)
  }
  const t = z + g + 0.5
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x
}

// Expected lifetime for documentation/audit
export const WEIBULL_EXPECTED_LIFETIME_MONTHS = weibullExpectedLifetime()  // ~22.8
