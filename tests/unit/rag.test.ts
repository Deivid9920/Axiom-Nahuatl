// VectorStore + RAG retrieval tests
import { describe, test, expect, beforeEach } from 'vitest'
import { getVectorStore, indexChunk, cosineSimilarity, EMBEDDING_DIMENSION } from '@/lib/rag/vector-store'
import { embedSync } from '@/lib/llm'

describe('VectorStore', () => {
  beforeEach(() => {
    getVectorStore().clear()
  })

  test('embed produces fixed-dimension normalized vector', () => {
    const v = embedSync('hello world')
    expect(v.length).toBe(EMBEDDING_DIMENSION)
    // L2 norm should be ~1
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    expect(norm).toBeCloseTo(1, 3)
  })

  test('similar texts produce similar embeddings', () => {
    const v1 = embedSync('deploy the application to production')
    const v2 = embedSync('deploy the app to production environment')
    const v3 = embedSync('cook pasta with tomato sauce')

    const sim12 = cosineSimilarity(v1, v2)
    const sim13 = cosineSimilarity(v1, v3)

    expect(sim12).toBeGreaterThan(sim13)
  })

  test('upsert + search returns the document', async () => {
    await indexChunk({
      chunkId: 'c1',
      content: 'The pull request was approved by the senior engineer',
      domain: 'software_engineering',
      cefrLevel: 'B1',
      source: 'vocabulary',
      sourceId: 'vocab1',
    })

    const queryVec = embedSync('pull request review')
    const results = await getVectorStore().search({
      vector: queryVec,
      topK: 5,
    })

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].payload.chunkId).toBe('c1')
  })

  test('filter by domain excludes other domains', async () => {
    await indexChunk({
      chunkId: 'se1',
      content: 'deploy the code',
      domain: 'software_engineering',
      source: 'vocabulary',
      sourceId: 'v1',
    })
    await indexChunk({
      chunkId: 'fin1',
      content: 'deploy the code',  // same content, different domain
      domain: 'finance',
      source: 'vocabulary',
      sourceId: 'v2',
    })

    const queryVec = embedSync('deploy the code')
    const results = await getVectorStore().search({
      vector: queryVec,
      topK: 10,
      filter: { domain: 'finance' },
    })

    expect(results.every(r => r.payload.domain === 'finance')).toBe(true)
    expect(results.length).toBe(1)
  })

  test('filter by CEFR levels', async () => {
    await indexChunk({
      chunkId: 'a1',
      content: 'hello world',
      domain: 'general',
      cefrLevel: 'A1',
      source: 'vocabulary',
      sourceId: 'v1',
    })
    await indexChunk({
      chunkId: 'c1',
      content: 'hello world',
      domain: 'general',
      cefrLevel: 'C1',
      source: 'vocabulary',
      sourceId: 'v2',
    })

    const queryVec = embedSync('hello world')
    const results = await getVectorStore().search({
      vector: queryVec,
      topK: 10,
      filter: { cefrLevels: ['A1', 'A2'] },
    })

    expect(results.every(r => ['A1', 'A2'].includes(r.payload.cefrLevel || ''))).toBe(true)
  })

  test('deleteByDocumentId removes all chunks of that document', async () => {
    await indexChunk({
      chunkId: 'c1',
      content: 'chunk one',
      documentId: 'doc1',
      source: 'user_document',
      sourceId: 'doc1',
    })
    await indexChunk({
      chunkId: 'c2',
      content: 'chunk two',
      documentId: 'doc1',
      source: 'user_document',
      sourceId: 'doc1',
    })
    await indexChunk({
      chunkId: 'c3',
      content: 'chunk three',
      documentId: 'doc2',
      source: 'user_document',
      sourceId: 'doc2',
    })

    await getVectorStore().deleteByDocumentId('doc1')
    const all = await getVectorStore().search({ vector: embedSync('chunk'), topK: 100 })
    const docIds = new Set(all.map(r => r.payload.documentId))
    expect(docIds.has('doc1')).toBe(false)
    expect(docIds.has('doc2')).toBe(true)
  })

  test('topK limits results', async () => {
    for (let i = 0; i < 20; i++) {
      await indexChunk({
        chunkId: `c${i}`,
        content: `test chunk ${i} with words`,
        source: 'vocabulary',
        sourceId: `v${i}`,
      })
    }

    const results = await getVectorStore().search({
      vector: embedSync('test chunk'),
      topK: 5,
    })
    expect(results.length).toBe(5)
  })

  test('results are sorted by score descending', async () => {
    await indexChunk({
      chunkId: 'exact',
      content: 'deploy to production',
      source: 'vocabulary',
      sourceId: 'v1',
    })
    await indexChunk({
      chunkId: 'different',
      content: 'cooking recipes italian',
      source: 'vocabulary',
      sourceId: 'v2',
    })

    const results = await getVectorStore().search({
      vector: embedSync('deploy to production'),
      topK: 5,
    })

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }
  })
})
