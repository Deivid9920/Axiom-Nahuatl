// AXIOM — LLM Abstraction Layer
// Hybrid: OpenRouter (real, when OPENROUTER_API_KEY is set) OR z-ai-web-dev-sdk (dev proxy).
// The interface is identical — only the underlying client changes.
// See .env.example for setup instructions.

import ZAI from 'z-ai-web-dev-sdk'
import { logger, recordMetric, tracer, type Span } from '@/lib/observability'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
}

export interface ChatCompletionRequest {
  model?: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  stream?: boolean
  route?: 'fallback' | 'auto'
  user?: string
  sessionId?: string
  requestId?: string
}

export interface ChatCompletionResponse {
  id: string
  model: string
  choices: {
    index: number
    message: ChatMessage
    finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter'
  }[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  costMxnCents: number
}

const USD_PER_M_TOKENS: Record<string, { input: number; output: number }> = {
  'deepseek/deepseek-chat-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek/deepseek-chat-v4-pro': { input: 0.435, output: 0.87 },
  'openai/gpt-5.4-mini': { input: 0.15, output: 0.60 },
  'openai/gpt-5.4': { input: 4.50, output: 12.00 },
  'zai-default': { input: 0.20, output: 0.40 },
}

const USD_TO_MXN = 17.20

function computeCostMxnCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = USD_PER_M_TOKENS[model] || USD_PER_M_TOKENS['zai-default']
  const usdCost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output
  return Math.ceil(usdCost * USD_TO_MXN * 100)
}

// Provider detection — set OPENROUTER_API_KEY in .env to use real OpenRouter
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'deepseek/deepseek-chat-v4-flash'
const FALLBACK_MODEL = process.env.FALLBACK_MODEL || 'openai/gpt-5.4-mini'
const USE_OPENROUTER = OPENROUTER_API_KEY.length > 0

if (USE_OPENROUTER) {
  logger.info('llm.provider_openrouter', { model: DEFAULT_MODEL })
} else {
  logger.info('llm.provider_dev_proxy', { reason: 'OPENROUTER_API_KEY not set, using z-ai-web-dev-sdk' })
}

async function openRouterChatCompletion(req: ChatCompletionRequest): Promise<{
  content: string; promptTokens: number; completionTokens: number; id: string; model: string
}> {
  const model = req.model || DEFAULT_MODEL
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://axiom.mx',
      'X-Title': 'Axiom',
    },
    body: JSON.stringify({
      model,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1024,
      top_p: req.topP ?? 1,
      stream: false,
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`OpenRouter API ${response.status}: ${errText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  const promptTokens = data.usage?.prompt_tokens || estimateTokens(req.messages.map(m => m.content).join('\n'))
  const completionTokens = data.usage?.completion_tokens || estimateTokens(content)

  return {
    content,
    promptTokens,
    completionTokens,
    id: data.id || crypto.randomUUID(),
    model: data.model || model,
  }
}

// Streaming via OpenRouter (real SSE)
async function* openRouterStreamChat(req: ChatCompletionRequest): AsyncGenerator<{ delta: string; done: boolean }, void, void> {
  const model = req.model || DEFAULT_MODEL
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://axiom.mx',
      'X-Title': 'Axiom',
    },
    body: JSON.stringify({
      model,
      messages: req.messages.map(m => ({ role: m.role, content: m.content })),
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 1024,
      top_p: req.topP ?? 1,
      stream: true,
    }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok || !response.body) {
    throw new Error(`OpenRouter stream ${response.status}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') { yield { delta: '', done: true }; return }
      try {
        const json = JSON.parse(data)
        const delta = json.choices?.[0]?.delta?.content || ''
        if (delta) yield { delta, done: false }
      } catch { /* partial JSON, skip */ }
    }
  }
  yield { delta: '', done: true }
}

// Dev proxy client (z-ai-web-dev-sdk) — for sandbox/development without API key
let zaiClient: any = null

async function getZaiClient() {
  if (zaiClient) return zaiClient
  zaiClient = await ZAI.create()
  return zaiClient
}

async function zaiChatCompletion(req: ChatCompletionRequest): Promise<{
  content: string; promptTokens: number; completionTokens: number; id: string; model: string
}> {
  const client = await getZaiClient()
  const messages = req.messages.map(m => ({ role: m.role, content: m.content }))

  const response = await client.chat.completions.create({
    messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.maxTokens ?? 1024,
    top_p: req.topP ?? 1,
  })

  const content = response.choices?.[0]?.message?.content || ''
  const promptTokens = estimateTokens(req.messages.map(m => m.content).join('\n'))
  const completionTokens = estimateTokens(content)

  return {
    content,
    promptTokens,
    completionTokens,
    id: response.id || crypto.randomUUID(),
    model: 'zai-default',
  }
}

// Unified chatCompletion (auto-routes based on env)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export async function chatCompletion(req: ChatCompletionRequest, parentSpan?: Span): Promise<ChatCompletionResponse> {
  return tracer.withSpan(
    'llm.chat_completion',
    async (span) => {
      span.setAttribute('llm.model', req.model || DEFAULT_MODEL)
      span.setAttribute('llm.message_count', req.messages.length)
      span.setAttribute('llm.temperature', req.temperature ?? 0.7)
      span.setAttribute('llm.stream', req.stream ?? false)
      span.setAttribute('llm.provider', USE_OPENROUTER ? 'openrouter' : 'zai-dev')
      if (req.user) span.setAttribute('user.id', req.user)
      if (req.sessionId) span.setAttribute('session.id', req.sessionId)

      const start = Date.now()
      const model = req.model || (USE_OPENROUTER ? DEFAULT_MODEL : 'zai-default')

      try {
        const result = USE_OPENROUTER
          ? await openRouterChatCompletion(req)
          : await zaiChatCompletion(req)

        const totalTokens = result.promptTokens + result.completionTokens
        const costMxnCents = computeCostMxnCents(model, result.promptTokens, result.completionTokens)

        span.setAttribute('llm.tokens_in', result.promptTokens)
        span.setAttribute('llm.tokens_out', result.completionTokens)
        span.setAttribute('llm.cost_mxn_cents', costMxnCents)
        span.setAttribute('llm.duration_ms', Date.now() - start)

        recordMetric('llm.tokens_in', result.promptTokens, { type: 'counter', unit: 'tokens', userId: req.user, tags: { model } })
        recordMetric('llm.tokens_out', result.completionTokens, { type: 'counter', unit: 'tokens', userId: req.user, tags: { model } })
        recordMetric('llm.cost_mxn_cents', costMxnCents, { type: 'counter', unit: 'mxn_cents', userId: req.user })
        recordMetric('llm.duration_ms', Date.now() - start, { type: 'histogram', unit: 'ms', userId: req.user, tags: { model } })

        return {
          id: result.id,
          model: result.model,
          choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finishReason: 'stop' }],
          usage: { promptTokens: result.promptTokens, completionTokens: result.completionTokens, totalTokens },
          costMxnCents,
        }
      } catch (error) {
        span.recordError(error as Error)
        logger.error('llm.chat_completion_failed', {
          user_id: req.user,
          session_id: req.sessionId,
          request_id: req.requestId,
          provider: USE_OPENROUTER ? 'openrouter' : 'zai-dev',
          error: (error as Error).message,
        }, error as Error)
        throw error
      }
    },
    { parentSpanId: parentSpan?.spanId }
  )
}

// Unified streamChat (real SSE with OpenRouter, simulated with z-ai)
export async function* streamChat(req: ChatCompletionRequest, parentSpan?: Span): AsyncGenerator<{ delta: string; done: boolean }, void, void> {
  const span = tracer.startSpan('llm.stream_chat', parentSpan?.spanId, {
    'llm.model': req.model || DEFAULT_MODEL,
    'llm.stream': true,
    'llm.provider': USE_OPENROUTER ? 'openrouter' : 'zai-dev',
  })

  try {
    if (USE_OPENROUTER) {
      // Real SSE streaming from OpenRouter
      yield* openRouterStreamChat(req)
    } else {
      // Simulated streaming with z-ai proxy (chunk the full response)
      const response = await chatCompletion({ ...req, stream: false }, span)
      const fullText = response.choices[0].message.content
      const chunkSize = 50
      for (let i = 0; i < fullText.length; i += chunkSize) {
        yield { delta: fullText.slice(i, i + chunkSize), done: false }
        await new Promise(r => setTimeout(r, 10))
      }
      yield { delta: '', done: true }
    }
  } finally {
    span.end()
  }
}

// Embeddings (BGE-M3)
// When HF_TOKEN is set, calls HuggingFace Inference API for real BGE-M3 embeddings.
// Otherwise, falls back to hash-based mock embeddings (256 dims).
export interface EmbeddingRequest {
  input: string | string[]
  model?: string
  user?: string
}

export interface EmbeddingResponse {
  data: { embedding: number[]; index: number }[]
  model: string
  usage: { promptTokens: number; totalTokens: number }
}

const HF_TOKEN = process.env.HF_TOKEN || ''
const USE_REAL_EMBEDDINGS = HF_TOKEN.length > 0
const EMBEDDING_DIM = USE_REAL_EMBEDDINGS ? 1024 : 256

function hashToVector(text: string, dim: number = EMBEDDING_DIM): number[] {
  const vec = new Array(dim).fill(0)
  const tokens = text.toLowerCase().match(/\w+/g) || []

  for (const token of tokens) {
    for (let i = 0; i < 3; i++) {
      let h = 2166136261
      const salted = `${token}:${i}`
      for (let j = 0; j < salted.length; j++) {
        h ^= salted.charCodeAt(j)
        h = (h * 16777619) >>> 0
      }
      const d = h % dim
      const sign = ((h >>> 8) & 1) === 0 ? 1 : -1
      vec[d] += sign * (1 / Math.sqrt(tokens.length))
    }
  }

  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm
  }

  return vec
}

async function realEmbed(text: string): Promise<number[]> {
  const response = await fetch('https://api-inference.huggingface.co/models/BAAI/bge-m3', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inputs: text }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    logger.warn('embed.huggingface_failed', { status: response.status, fallback: 'hash' })
    return hashToVector(text)
  }

  const data = await response.json()
  // HF returns array of arrays (one per input)
  const embedding = Array.isArray(data[0]) ? data[0] : data
  return embedding as number[]
}

export async function embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
  const inputs = Array.isArray(req.input) ? req.input : [req.input]

  if (USE_REAL_EMBEDDINGS) {
    const embeddings = await Promise.all(inputs.map(realEmbed))
    const data = embeddings.map((embedding, index) => ({ embedding, index }))
    const promptTokens = inputs.reduce((s, t) => s + estimateTokens(t), 0)
    return { data, model: 'bge-m3-hf', usage: { promptTokens, totalTokens: promptTokens } }
  }

  const data = inputs.map((text, index) => ({ embedding: hashToVector(text), index }))
  const promptTokens = inputs.reduce((s, t) => s + estimateTokens(t), 0)
  return { data, model: 'bge-m3-local-mock', usage: { promptTokens, totalTokens: promptTokens } }
}

export function embedSync(text: string): number[] {
  return hashToVector(text)
}

export const EMBEDDING_DIMENSION = EMBEDDING_DIM

// Export provider info for UI/observability
export const LLM_PROVIDER = USE_OPENROUTER ? 'openrouter' : 'zai-dev-proxy'
export const EMBEDDING_PROVIDER = USE_REAL_EMBEDDINGS ? 'bge-m3-hf' : 'bge-m3-local-mock'
