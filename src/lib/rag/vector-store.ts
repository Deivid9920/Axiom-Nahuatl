// AXIOM — RAG VectorStore
// In-memory (default) or Qdrant Cloud (when QDRANT_URL is set); same interface
// Setup: see .env.example

import { embedSync, embed, EMBEDDING_DIMENSION } from '@/lib/llm'
import { logger } from '@/lib/observability'

export interface VectorPoint {
  id: string
  vector: number[]
  payload: {
    documentId?: string
    chunkId: string
    content: string
    domain?: string
    cefrLevel?: string
    section?: string
    source: 'user_document' | 'knowledge_base' | 'vocabulary' | 'grammar_rule' | 'exercise'
    sourceId: string  // ID of the source entity (UserDocument, VocabularyEntry, etc.)
    difficultyScore?: number
    metadata?: Record<string, unknown>
  }
}

export interface SearchParams {
  vector: number[]
  topK?: number
  filter?: {
    domain?: string
    cefrLevels?: string[]
    source?: VectorPoint['payload']['source']
    userId?: string  // for user_document filter
    sourceIds?: string[]
  }
}

export interface ScoredPoint {
  id: string
  score: number
  payload: VectorPoint['payload']
}

// Provider detection
const QDRANT_URL = process.env.QDRANT_URL || ''
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || ''
const USE_QDRANT = QDRANT_URL.length > 0

export const VECTOR_STORE_PROVIDER = USE_QDRANT ? 'qdrant' : 'in-memory'

// In-Memory VectorStore (Qdrant-compatible API)
class InMemoryVectorStore {
  private points = new Map<string, VectorPoint>()

  async upsert(point: VectorPoint): Promise<void> {
    this.points.set(point.id, point)
  }

  async upsertBatch(points: VectorPoint[]): Promise<void> {
    for (const p of points) this.points.set(p.id, p)
  }

  async delete(id: string): Promise<void> {
    this.points.delete(id)
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    for (const [id, p] of this.points.entries()) {
      if (p.payload.documentId === documentId) this.points.delete(id)
    }
  }

  async search(params: SearchParams): Promise<ScoredPoint[]> {
    const topK = params.topK ?? 10
    const results: ScoredPoint[] = []

    for (const point of this.points.values()) {
      // Apply filters
      if (params.filter) {
        const f = params.filter
        if (f.domain && point.payload.domain !== f.domain) continue
        if (f.cefrLevels && point.payload.cefrLevel && !f.cefrLevels.includes(point.payload.cefrLevel)) continue
        if (f.source && point.payload.source !== f.source) continue
        if (f.sourceIds && !f.sourceIds.includes(point.payload.sourceId)) continue
        if (f.userId && point.payload.documentId) {
          // user_document filter requires user_id check
          // (in real Qdrant this would be a payload match)
          // we handle it at the chunk-fetch level via DB
        }
      }

      const score = cosineSimilarity(params.vector, point.vector)
      results.push({ id: point.id, score, payload: point.payload })
    }

    // Sort by score descending, take top K
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  async count(filter?: { source?: VectorPoint['payload']['source'] }): Promise<number> {
    if (!filter) return this.points.size
    let n = 0
    for (const p of this.points.values()) {
      if (p.payload.source === filter.source) n++
    }
    return n
  }

  // For warm-up: load all chunks from DB at startup
  async bulkLoad(points: VectorPoint[]): Promise<void> {
    for (const p of points) this.points.set(p.id, p)
    logger.info('vectorstore.bulk_loaded', { count: points.length, total: this.points.size })
  }

  // For testing/debugging
  clear() {
    this.points.clear()
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Qdrant Cloud VectorStore (production)
// Uses Qdrant REST API directly (no SDK needed) — https://qdrant.tech/documentation/
const QDRANT_COLLECTION = 'axiom_chunks'

class QdrantVectorStore {
  private headers: Record<string, string>
  private baseUrl: string
  private initialized = false

  constructor() {
    this.baseUrl = QDRANT_URL.replace(/\/$/, '')
    this.headers = {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY,
    }
  }

  private async ensureCollection(): Promise<void> {
    if (this.initialized) return
    try {
      // Check if collection exists
      const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}`, { headers: this.headers })
      if (res.ok) {
        this.initialized = true
        return
      }
      // Create collection
      await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          vectors: { size: EMBEDDING_DIMENSION, distance: 'Cosine' },
        }),
      })
      this.initialized = true
      logger.info('vectorstore.qdrant_collection_created', { collection: QDRANT_COLLECTION })
    } catch (e) {
      logger.error('vectorstore.qdrant_init_failed', { error: (e as Error).message }, e as Error)
      throw e
    }
  }

  private buildFilter(filter?: SearchParams['filter']): Record<string, any> {
    if (!filter) return {}
    const must: any[] = []
    if (filter.domain) must.push({ key: 'domain', match: { value: filter.domain } })
    if (filter.source) must.push({ key: 'source', match: { value: filter.source } })
    if (filter.cefrLevels?.length) {
      const should = filter.cefrLevels.map(level => ({ key: 'cefrLevel', match: { value: level } }))
      return { must, should }
    }
    if (filter.sourceIds?.length) {
      // Qdrant matches one of the sourceIds
      must.push({ key: 'sourceId', match: { any: filter.sourceIds } })
    }
    return must.length ? { must } : {}
  }

  async upsert(point: VectorPoint): Promise<void> {
    await this.ensureCollection()
    await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}/points`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        points: [{ id: point.id, vector: point.vector, payload: point.payload }],
      }),
    })
  }

  async upsertBatch(points: VectorPoint[]): Promise<void> {
    await this.ensureCollection()
    // Qdrant accepts up to 1000 points per request
    for (let i = 0; i < points.length; i += 500) {
      const batch = points.slice(i, i + 500)
      await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}/points`, {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify({
          points: batch.map(p => ({ id: p.id, vector: p.vector, payload: p.payload })),
        }),
      })
    }
  }

  async delete(id: string): Promise<void> {
    await this.ensureCollection()
    await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}/points/delete`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ points: [id] }),
    })
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.ensureCollection()
    await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}/points/delete`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
      }),
    })
  }

  async search(params: SearchParams): Promise<ScoredPoint[]> {
    await this.ensureCollection()
    const topK = params.topK ?? 10
    const filter = this.buildFilter(params.filter)

    const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}/points/search`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        vector: params.vector,
        limit: topK,
        with_payload: true,
        filter: Object.keys(filter).length ? filter : undefined,
      }),
    })

    if (!res.ok) {
      logger.error('vectorstore.qdrant_search_failed', { status: res.status })
      return []
    }

    const data = await res.json()
    const results = (data.result || []).map((r: any) => ({
      id: r.id as string,
      score: r.score as number,
      payload: r.payload as VectorPoint['payload'],
    }))

    return results
  }

  async count(filter?: { source?: VectorPoint['payload']['source'] }): Promise<number> {
    await this.ensureCollection()
    const body: any = { exact: true }
    if (filter?.source) body.filter = { must: [{ key: 'source', match: { value: filter.source } }] }
    const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}/points/count`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) return 0
    const data = await res.json()
    return data.result?.count || 0
  }

  async bulkLoad(points: VectorPoint[]): Promise<void> {
    await this.upsertBatch(points)
    logger.info('vectorstore.qdrant_bulk_loaded', { count: points.length })
  }

  clear() {
    // Drop collection and recreate
    fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION}`, { method: 'DELETE', headers: this.headers })
      .then(() => { this.initialized = false })
      .catch(() => {})
  }
}

// Singleton
let store: InMemoryVectorStore | QdrantVectorStore | null = null

export function getVectorStore(): InMemoryVectorStore | QdrantVectorStore {
  if (!store) {
    if (USE_QDRANT) {
      store = new QdrantVectorStore()
      logger.info('vectorstore.qdrant_initialized', { url: QDRANT_URL })
    } else {
      store = new InMemoryVectorStore()
      logger.info('vectorstore.inmemory_initialized', { reason: 'QDRANT_URL not set' })
    }
  }
  return store
}

// Helper: embed + upsert a chunk (uses real BGE-M3 if HF_TOKEN is set)
export async function indexChunk(opts: {
  chunkId: string
  content: string
  documentId?: string
  domain?: string
  cefrLevel?: string
  section?: string
  source: VectorPoint['payload']['source']
  sourceId: string
  difficultyScore?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  const embedResponse = await embed({
    input: opts.content,
    model: 'bge-m3',
  })
  const vector = embedResponse.data[0].embedding
  const store = getVectorStore()
  await store.upsert({
    id: opts.chunkId,
    vector,
    payload: {
      documentId: opts.documentId,
      chunkId: opts.chunkId,
      content: opts.content,
      domain: opts.domain,
      cefrLevel: opts.cefrLevel,
      section: opts.section,
      source: opts.source,
      sourceId: opts.sourceId,
      difficultyScore: opts.difficultyScore,
      metadata: opts.metadata,
    },
  })
}

export { EMBEDDING_DIMENSION, cosineSimilarity }
