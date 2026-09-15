// Memory processor tests
import { describe, test, expect, beforeEach } from 'vitest'
import { memory } from '@/lib/memory'
import { prisma } from '../setup'

describe('Short-term memory', () => {
  beforeEach(() => {
    // Clear short-term memory between tests
    memory.clearSession('test-session')
  })

  test('set + get round-trip', () => {
    memory.set('test-session', 'user-1', 'foo', { bar: 'baz' })
    const val = memory.get('test-session', 'foo')
    expect(val).toEqual({ bar: 'baz' })
  })

  test('pushHistory + getHistory', () => {
    memory.pushHistory('test-session', 'user', 'hello')
    memory.pushHistory('test-session', 'assistant', 'hi there')
    const history = memory.getHistory('test-session')
    expect(history.length).toBe(2)
    expect(history[0].role).toBe('user')
    expect(history[1].role).toBe('assistant')
  })

  test('history caps at 50 messages', () => {
    for (let i = 0; i < 60; i++) {
      memory.pushHistory('test-session', 'user', `msg ${i}`)
    }
    const history = memory.getHistory('test-session')
    expect(history.length).toBe(50)
    expect(history[49].content).toBe('msg 59')
  })

  test('clearSession removes data', () => {
    memory.set('test-session', 'user-1', 'foo', 'bar')
    memory.pushHistory('test-session', 'user', 'hello')
    memory.clearSession('test-session')
    expect(memory.get('test-session', 'foo')).toBeUndefined()
    expect(memory.getHistory('test-session')).toEqual([])
  })
})

describe('Long-term memory (AgentMemory table)', () => {
  test('write + read round-trip', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-memory@example.com',
        passwordHash: 'hash',
        profile: { create: {} },
      },
    })

    const id = await memory.writeLongTerm({
      agentType: 'ai_tutor',
      userId: user.id,
      context: { topic: 'past_tense', summary: 'user struggles with irregular verbs' },
      metadata: { sessionId: 's1' },
    })

    expect(id).toBeTruthy()

    const entries = await memory.readLongTerm({
      agentType: 'ai_tutor',
      userId: user.id,
      limit: 10,
    })

    expect(entries.length).toBe(1)
    expect(entries[0].agentType).toBe('ai_tutor')
    expect((entries[0].context as any).topic).toBe('past_tense')
    expect((entries[0].metadata as any).sessionId).toBe('s1')
  })

  test('read filters by agentType', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-filter@example.com',
        passwordHash: 'hash',
        profile: { create: {} },
      },
    })

    await memory.writeLongTerm({
      agentType: 'ai_tutor',
      userId: user.id,
      context: { type: 'tutor_memory' },
    })
    await memory.writeLongTerm({
      agentType: 'learning',
      userId: user.id,
      context: { type: 'learning_memory' },
    })

    const tutorEntries = await memory.readLongTerm({
      agentType: 'ai_tutor',
      userId: user.id,
    })
    const learningEntries = await memory.readLongTerm({
      agentType: 'learning',
      userId: user.id,
    })

    expect(tutorEntries.length).toBe(1)
    expect(learningEntries.length).toBe(1)
    expect((tutorEntries[0].context as any).type).toBe('tutor_memory')
  })

  test('read respects limit', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test-limit@example.com',
        passwordHash: 'hash',
        profile: { create: {} },
      },
    })

    for (let i = 0; i < 10; i++) {
      await memory.writeLongTerm({
        agentType: 'analytics',
        userId: user.id,
        context: { index: i },
      })
    }

    const entries = await memory.readLongTerm({
      agentType: 'analytics',
      userId: user.id,
      limit: 3,
    })
    expect(entries.length).toBe(3)
    // Most recent first
    expect((entries[0].context as any).index).toBe(9)
  })
})
