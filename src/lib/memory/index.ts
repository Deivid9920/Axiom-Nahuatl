// AXIOM — Dual Memory Architecture
// Short-term: in-memory map keyed by session_id (TTL 30 min)
// Long-term: AgentMemory table

import { db } from '@/lib/db'
import { logger, tracer, type Span } from '@/lib/observability'
import type { AgentType } from '@/lib/types'

// Short-term memory (active session state)
interface ShortTermEntry {
  sessionId: string
  userId: string
  state: Map<string, unknown>  // arbitrary session-scoped state
  history: { role: string; content: string; ts: number }[]  // recent messages
  lastAccessed: number
}

class ShortTermMemory {
  private entries = new Map<string, ShortTermEntry>()
  private ttlMs = 30 * 60 * 1000  // 30 minutes

  set(sessionId: string, userId: string, key: string, value: unknown) {
    const now = Date.now()
    let entry = this.entries.get(sessionId)
    if (!entry) {
      entry = { sessionId, userId, state: new Map(), history: [], lastAccessed: now }
      this.entries.set(sessionId, entry)
    }
    entry.state.set(key, value)
    entry.lastAccessed = now
    this.evict()
  }

  get<T = unknown>(sessionId: string, key: string): T | undefined {
    const entry = this.entries.get(sessionId)
    if (!entry) return undefined
    entry.lastAccessed = Date.now()
    return entry.state.get(key) as T | undefined
  }

  pushHistory(sessionId: string, role: string, content: string) {
    const now = Date.now()
    let entry = this.entries.get(sessionId)
    if (!entry) {
      // Need userId; fetch from session
      // For now, lazy init without userId (set later)
      entry = { sessionId, userId: '', state: new Map(), history: [], lastAccessed: now }
      this.entries.set(sessionId, entry)
    }
    entry.history.push({ role, content, ts: now })
    // Cap history to last 50 messages in short-term
    if (entry.history.length > 50) {
      entry.history = entry.history.slice(-50)
    }
    entry.lastAccessed = now
    this.evict()
  }

  getHistory(sessionId: string) {
    const entry = this.entries.get(sessionId)
    if (!entry) return []
    entry.lastAccessed = Date.now()
    return [...entry.history]
  }

  clear(sessionId: string) {
    this.entries.delete(sessionId)
  }

  private evict() {
    const now = Date.now()
    for (const [id, entry] of this.entries.entries()) {
      if (now - entry.lastAccessed > this.ttlMs) {
        this.entries.delete(id)
      }
    }
  }
}

const shortTermMemory = new ShortTermMemory()

export interface AgentMemoryEntry {
  id: string
  agentType: AgentType
  userId: string
  context: Record<string, unknown>
  metadata: Record<string, unknown>
  timestamp: Date
}

export async function writeLongTermMemory(opts: {
  agentType: AgentType
  userId: string
  context: Record<string, unknown>
  metadata?: Record<string, unknown>
}, parentSpan?: Span): Promise<string> {
  return tracer.withSpan(
    'memory.long_term.write',
    async (span) => {
      span.setAttribute('agent.type', opts.agentType)
      span.setAttribute('user.id', opts.userId)

      const record = await db.agentMemory.create({
        data: {
          agentType: opts.agentType,
          userId: opts.userId,
          context: JSON.stringify(opts.context),
          metadata: JSON.stringify(opts.metadata || {}),
        },
      })
      return record.id
    },
    { parentSpanId: parentSpan?.spanId }
  )
}

export async function readLongTermMemory(opts: {
  agentType: AgentType
  userId: string
  limit?: number
  since?: Date
}, parentSpan?: Span): Promise<AgentMemoryEntry[]> {
  return tracer.withSpan(
    'memory.long_term.read',
    async (span) => {
      span.setAttribute('agent.type', opts.agentType)
      span.setAttribute('user.id', opts.userId)
      span.setAttribute('memory.limit', opts.limit ?? 20)

      const records = await db.agentMemory.findMany({
        where: {
          agentType: opts.agentType,
          userId: opts.userId,
          ...(opts.since ? { timestamp: { gt: opts.since } } : {}),
        },
        orderBy: { timestamp: 'desc' },
        take: opts.limit ?? 20,
      })

      return records.map(r => ({
        id: r.id,
        agentType: r.agentType as AgentType,
        userId: r.userId,
        context: JSON.parse(r.context) as Record<string, unknown>,
        metadata: JSON.parse(r.metadata) as Record<string, unknown>,
        timestamp: r.timestamp,
      }))
    },
    { parentSpanId: parentSpan?.spanId }
  )
}

// Memory Processor
export interface CompressedContext {
  systemPrompt: string
  recentMessages: { role: string; content: string }[]  // last N (configurable)
  summary: string  // semantic summary of older messages
  longTermRelevant: AgentMemoryEntry[]  // long-term memories relevant to this session
}

export async function compressContext(opts: {
  sessionId: string
  userId: string
  currentMessage: string
  agentType: AgentType
  maxRecentMessages?: number  // default 6
  longTermLimit?: number  // default 5
}, parentSpan?: Span): Promise<CompressedContext> {
  return tracer.withSpan(
    'memory.compress_context',
    async (span) => {
      span.setAttribute('session.id', opts.sessionId)
      span.setAttribute('user.id', opts.userId)
      span.setAttribute('agent.type', opts.agentType)

      // 1. Get short-term history
      const fullHistory = shortTermMemory.getHistory(opts.sessionId)
      const maxRecent = opts.maxRecentMessages ?? 6
      const recent = fullHistory.slice(-maxRecent)
      const older = fullHistory.slice(0, -maxRecent)

      // 2. Compress older history (semantic summarization)
      let summary = ''
      if (older.length > 0) {
        summary = older
          .map(m => `[${m.role}]: ${m.content.slice(0, 200)}${m.content.length > 200 ? '...' : ''}`)
          .join('\n')
      }
      span.setAttribute('memory.older_count', older.length)
      span.setAttribute('memory.recent_count', recent.length)
      span.setAttribute('memory.summary_length', summary.length)

      // 3. Fetch relevant long-term memory
      const longTerm = await readLongTermMemory({
        agentType: opts.agentType,
        userId: opts.userId,
        limit: opts.longTermLimit ?? 5,
        since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),  // last 30 days
      }, span)
      span.setAttribute('memory.long_term_count', longTerm.length)

      // 4. Build system prompt (caller will prepend domain-specific system)
      const systemPrompt = `You are Axiom AI Tutor. Session: ${opts.sessionId}.

Conversation summary so far:
${summary || '(start of conversation)'}

Relevant context from past sessions:
${longTerm.length > 0
  ? longTerm.map(m => `- ${JSON.stringify(m.context).slice(0, 200)}`).join('\n')
  : '(none)'}`

      return {
        systemPrompt,
        recentMessages: recent.map(m => ({ role: m.role, content: m.content })),
        summary,
        longTermRelevant: longTerm,
      }
    },
    { parentSpanId: parentSpan?.spanId }
  )
}

// Public API
export const memory = {
  // Short-term
  set: (sessionId: string, userId: string, key: string, value: unknown) =>
    shortTermMemory.set(sessionId, userId, key, value),
  get: <T = unknown>(sessionId: string, key: string) =>
    shortTermMemory.get<T>(sessionId, key),
  pushHistory: (sessionId: string, role: string, content: string) =>
    shortTermMemory.pushHistory(sessionId, role, content),
  getHistory: (sessionId: string) => shortTermMemory.getHistory(sessionId),
  clearSession: (sessionId: string) => shortTermMemory.clear(sessionId),

  // Long-term
  writeLongTerm: writeLongTermMemory,
  readLongTerm: readLongTermMemory,

  // Processor
  compress: compressContext,
}
