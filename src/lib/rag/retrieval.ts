// AXIOM — RAG Retrieval
import { db } from '@/lib/db'
import { getVectorStore, type ScoredPoint } from './vector-store'
import { embedSync } from '@/lib/llm'
import { logger, tracer, type Span } from '@/lib/observability'
import type { Domain, CefrLevel } from '@/lib/types'

export interface RetrievalRequest {
  query: string
  userId: string
  domain?: Domain
  cefrLevel: CefrLevel
  topK?: number
  // Boost by user's historical errors
  useErrorBoost?: boolean
  // Include user's uploaded documents in the search
  includeUserDocuments?: boolean
}

export interface RetrievalResult {
  chunks: ScoredPoint[]
  debug?: {
    vectorSearchTopK: ScoredPoint[]
    errorBoostApplied: boolean
    cefrFilter: string[]
  }
}

export async function retrieve(
  req: RetrievalRequest,
  parentSpan?: Span
): Promise<RetrievalResult> {
  return tracer.withSpan(
    'rag.retrieve',
    async (span) => {
      span.setAttribute('rag.query_length', req.query.length)
      span.setAttribute('rag.top_k', req.topK ?? 8)
      span.setAttribute('rag.domain', req.domain || 'any')
      span.setAttribute('rag.cefr_level', req.cefrLevel)
      span.setAttribute('user.id', req.userId)

      // 1. Embed query
      const queryVec = embedSync(req.query)
      span.addEvent('query.embedded')

      // 2. CEFR filter: user's level ±1
      const cefrLevels = getCefrNeighbors(req.cefrLevel)
      span.setAttribute('rag.cefr_filter', cefrLevels.join(','))

      // 3. Vector search top-K (K = topK * 2.5 for re-ranking headroom)
      const store = getVectorStore()
      const topK = req.topK ?? 8
      const searchK = Math.ceil(topK * 2.5)
      const vectorResults = await store.search({
        vector: queryVec,
        topK: searchK,
        filter: {
          domain: req.domain,
          cefrLevels,
        },
      })
      span.addEvent('vector.search_done', { count: vectorResults.length })

      // 4. Re-rank by difficulty proximity to user's theta
      const userProfile = await db.userProfile.findUnique({
        where: { userId: req.userId },
      })
      const userTheta = userProfile?.theta ?? -2.0

      // 5. Boost by user's historical errors (if requested)
      let errorBoostMap = new Map<string, number>()
      if (req.useErrorBoost) {
        const recentErrors = await db.sessionEvaluation.findMany({
          where: {
            session: { userId: req.userId },
            createdAt: { gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
          take: 10,
          orderBy: { createdAt: 'desc' },
        })

        // Extract error types from evaluations
        const errorTypes: string[] = []
        for (const ev of recentErrors) {
          try {
            const errs = JSON.parse(ev.errorsJson || '[]') as { type: string }[]
            for (const e of errs) errorTypes.push(e.type)
          } catch {}
        }
        // If user has errors related to certain concepts, boost chunks containing those concepts
        if (errorTypes.length > 0) {
          for (const result of vectorResults) {
            const content = result.payload.content.toLowerCase()
            let boost = 0
            for (const errType of errorTypes) {
              if (content.includes(errType.toLowerCase())) boost += 0.1
            }
            if (boost > 0) errorBoostMap.set(result.id, boost)
          }
        }
      }
      span.setAttribute('rag.error_boost_count', errorBoostMap.size)

      // 6. Compute final score: vector similarity + difficulty match + error boost
      const reranked = vectorResults
        .map(r => {
          // Difficulty match: closer to user's θ (mapped to 0-1 difficulty) = better
          const chunkDifficulty = r.payload.difficultyScore ?? 0.5
          const userDifficulty = thetaToDifficulty(userTheta)
          const difficultyPenalty = Math.abs(chunkDifficulty - userDifficulty) * 0.3

          const errorBoost = errorBoostMap.get(r.id) ?? 0
          const finalScore = r.score - difficultyPenalty + errorBoost

          return { ...r, score: finalScore }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)

      span.setAttribute('rag.final_count', reranked.length)

      logger.debug('rag.retrieve_done', {
        user_id: req.userId,
        query_length: req.query.length,
        vector_count: vectorResults.length,
        reranked_count: reranked.length,
        error_boost_count: errorBoostMap.size,
      })

      return {
        chunks: reranked,
        debug: {
          vectorSearchTopK: vectorResults,
          errorBoostApplied: errorBoostMap.size > 0,
          cefrFilter: cefrLevels,
        },
      }
    },
    { parentSpanId: parentSpan?.spanId }
  )
}

// Helpers
function getCefrNeighbors(level: CefrLevel): string[] {
  const levels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const idx = levels.indexOf(level)
  const result: string[] = [level]
  if (idx > 0) result.push(levels[idx - 1])
  if (idx < levels.length - 1) result.push(levels[idx + 1])
  return result
}

// Map IRT theta (-3..+2) to difficulty (0..1): A1 → 0.0, C2 → 1.0
function thetaToDifficulty(theta: number): number {
  return Math.max(0, Math.min(1, (theta + 3) / 5))
}

// Chunking (recursive character splitting, per MVP)
export function chunkText(
  text: string,
  opts: { chunkSize?: number; chunkOverlap?: number } = {}
): { content: string; index: number }[] {
  const chunkSize = opts.chunkSize ?? 500
  const overlap = opts.chunkOverlap ?? 50
  const chunks: { content: string; index: number }[] = []

  if (text.length <= chunkSize) {
    return [{ content: text.trim(), index: 0 }]
  }

  // Split by paragraphs first, then sentences, then words
  const paragraphs = text.split(/\n\n+/)
  let current = ''
  let idx = 0

  for (const para of paragraphs) {
    if (para.length > chunkSize) {
      // Save current buffer
      if (current.trim()) {
        chunks.push({ content: current.trim(), index: idx++ })
        current = ''
      }
      // Split long paragraph by sentences
      const sentences = para.split(/(?<=[.!?])\s+/)
      for (const sent of sentences) {
        if ((current + ' ' + sent).length > chunkSize && current.trim()) {
          chunks.push({ content: current.trim(), index: idx++ })
          // Keep overlap
          const words = current.split(/\s+/)
          const overlapText = words.slice(-Math.ceil(overlap / 6)).join(' ')
          current = overlapText + ' ' + sent
        } else {
          current = current ? current + ' ' + sent : sent
        }
      }
    } else {
      if ((current + '\n\n' + para).length > chunkSize && current.trim()) {
        chunks.push({ content: current.trim(), index: idx++ })
        current = para
      } else {
        current = current ? current + '\n\n' + para : para
      }
    }
  }

  if (current.trim()) {
    chunks.push({ content: current.trim(), index: idx++ })
  }

  return chunks
}
