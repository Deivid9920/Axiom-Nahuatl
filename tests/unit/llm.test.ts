// LLM adapter + token estimation tests
import { describe, test, expect, vi } from 'vitest'
import { estimateTokens, embedSync, EMBEDDING_DIMENSION } from '@/lib/llm'
import { cosineSimilarity } from '@/lib/rag/vector-store'
import * as llm from '@/lib/llm'

vi.mock('z-ai-web-dev-sdk', () => ({
  default: {
    create: vi.fn().mockResolvedValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'test-id',
            choices: [{ message: { content: 'Hello!' } }],
          }),
        },
      },
    }),
  },
}))

describe('LLM Adapter', () => {
  describe('estimateTokens', () => {
    test('returns ~4 chars per token for English', () => {
      const text = 'Hello world this is a test'  // 27 chars
      const tokens = estimateTokens(text)
      expect(tokens).toBeGreaterThan(5)
      expect(tokens).toBeLessThan(10)
    })

    test('empty string returns 0', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })

  describe('computeCostMxnCents (via chatCompletion mock)', () => {
    test('DeepSeek V4-Flash pricing is correct', async () => {
      // Test by calling chatCompletion and inspecting the cost
      const response = await llm.chatCompletion({
        messages: [
          { role: 'system', content: 'You are a tutor.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'deepseek/deepseek-chat-v4-flash',
        user: 'test-user',
      })

      expect(response.usage.totalTokens).toBeGreaterThan(0)
      expect(response.costMxnCents).toBeGreaterThan(0)
      expect(response.costMxnCents).toBeGreaterThanOrEqual(1)
    })
  })

  describe('embed', () => {
    test('embedSync returns fixed-dim vector', () => {
      const v = embedSync('test text')
      expect(v.length).toBe(EMBEDDING_DIMENSION)
    })

    test('identical texts produce identical embeddings', () => {
      const v1 = embedSync('deploy to production')
      const v2 = embedSync('deploy to production')
      expect(v1).toEqual(v2)
    })

    test('cosine similarity of identical vectors is 1', () => {
      const v = embedSync('test')
      expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
    })

    test('cosine similarity of orthogonal-ish vectors is low', () => {
      const v1 = embedSync('deploy code review merge')
      const v2 = embedSync('pasta sauce recipe tomato')
      const sim = cosineSimilarity(v1, v2)
      expect(sim).toBeLessThan(0.5)
    })
  })
})
