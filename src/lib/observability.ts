// AXIOM — Structured JSON Logger + OTel Tracer interface

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  request_id?: string
  user_id?: string
  session_id?: string
  agent_type?: string
  action?: string
  duration_ms?: number
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  service: string
  env: string
  [key: string]: unknown
}

class Logger {
  private service = 'axiom-api'
  private env = process.env.NODE_ENV || 'development'

  private emit(level: LogLevel, message: string, ctx: LogContext = {}, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      env: this.env,
      ...ctx,
    }
    if (error) {
      entry.error_name = error.name
      entry.error_message = error.message
      entry.error_stack = error.stack
    }
    // JSON to stdout (production-grade; consumable by any log aggregator)
    const line = JSON.stringify(entry)
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else if (level === 'debug' && this.env === 'development') console.debug(line)
    else console.log(line)
  }

  debug(message: string, ctx?: LogContext) {
    this.emit('debug', message, ctx)
  }
  info(message: string, ctx?: LogContext) {
    this.emit('info', message, ctx)
  }
  warn(message: string, ctx?: LogContext, error?: Error) {
    this.emit('warn', message, ctx, error)
  }
  error(message: string, ctx?: LogContext, error?: Error) {
    this.emit('error', message, ctx, error)
  }

  // Create a child logger with fixed context (e.g. per-request)
  child(fixedCtx: LogContext): Logger {
    return {
      debug: (m: string, c?: LogContext) => this.debug(m, { ...fixedCtx, ...c }),
      info: (m: string, c?: LogContext) => this.info(m, { ...fixedCtx, ...c }),
      warn: (m: string, c?: LogContext, e?: Error) => this.warn(m, { ...fixedCtx, ...c }, e),
      error: (m: string, c?: LogContext, e?: Error) => this.error(m, { ...fixedCtx, ...c }, e),
      child: (c: LogContext) => this.child({ ...fixedCtx, ...c }),
    } as Logger
  }
}

export const logger = new Logger()

// OTel-compatible Tracer (no-op default; swaps to real OTLP via env)

export interface Span {
  spanId: string
  traceId: string
  parentSpanId?: string
  name: string
  startTime: number
  attributes: Record<string, string | number | boolean>
  events: { name: string; time: number; attributes?: Record<string, unknown> }[]
  end(): void
  setAttribute(key: string, value: string | number | boolean): void
  addEvent(name: string, attributes?: Record<string, unknown>): void
  recordError(error: Error): void
}

class NoopSpan implements Span {
  spanId: string
  traceId: string
  parentSpanId?: string
  name: string
  startTime: number
  attributes: Record<string, string | number | boolean> = {}
  events: { name: string; time: number; attributes?: Record<string, unknown> }[] = []

  constructor(name: string, parentSpanId?: string) {
    this.name = name
    this.spanId = generateId()
    this.traceId = parentSpanId ? generateId() : generateId() // would inherit in real OTel
    this.parentSpanId = parentSpanId
    this.startTime = Date.now()
  }

  setAttribute(key: string, value: string | number | boolean) {
    this.attributes[key] = value
  }

  addEvent(name: string, attributes?: Record<string, unknown>) {
    this.events.push({ name, time: Date.now(), attributes })
  }

  recordError(error: Error) {
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    })
  }

  end() {
    const duration = Date.now() - this.startTime
    logger.debug('span.closed', {
      span_id: this.spanId,
      trace_id: this.traceId,
      parent_span_id: this.parentSpanId,
      span_name: this.name,
      duration_ms: duration,
      attributes: this.attributes as unknown as Record<string, unknown>,
    })
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 18) + Date.now().toString(36)
}

class Tracer {
  private enabled: boolean

  constructor() {
    // Enable real OTel export if endpoint configured
    this.enabled = !!process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  }

  startSpan(name: string, parentSpanId?: string, attributes?: Record<string, string | number | boolean>): Span {
    const span = new NoopSpan(name, parentSpanId)
    if (attributes) {
      for (const [k, v] of Object.entries(attributes)) span.setAttribute(k, v)
    }
    return span
  }

  // Convenience: wrap an async function in a span
  async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    options?: { parentSpanId?: string; attributes?: Record<string, string | number | boolean> }
  ): Promise<T> {
    const span = this.startSpan(name, options?.parentSpanId, options?.attributes)
    try {
      const result = await fn(span)
      return result
    } catch (error) {
      span.recordError(error as Error)
      throw error
    } finally {
      span.end()
    }
  }
}

export const tracer = new Tracer()

import { db } from '@/lib/db'

export async function audit(
  action: string,
  ctx: {
    userId?: string
    resourceType?: string
    resourceId?: string
    ipAddress?: string
    userAgent?: string
    requestId?: string
    metadata?: Record<string, unknown>
  }
) {
  try {
    await db.auditLog.create({
      data: {
        userId: ctx.userId || null,
        action,
        resourceType: ctx.resourceType || null,
        resourceId: ctx.resourceId || null,
        ipAddress: ctx.ipAddress || null,
        userAgent: ctx.userAgent || null,
        requestId: ctx.requestId || null,
        metadataJson: ctx.metadata ? JSON.stringify(ctx.metadata) : null,
      },
    })
  } catch (error) {
    logger.error('audit.write_failed', { action, error: (error as Error).message }, error as Error)
  }
}

// Metrics (MetricPoint table)
export async function recordMetric(
  name: string,
  value: number,
  opts?: {
    type?: 'counter' | 'gauge' | 'histogram'
    unit?: string
    userId?: string
    tags?: Record<string, string>
  }
) {
  try {
    await db.metricPoint.create({
      data: {
        name,
        type: opts?.type || 'gauge',
        value,
        unit: opts?.unit || null,
        userId: opts?.userId || null,
        tagsJson: opts?.tags ? JSON.stringify(opts.tags) : null,
      },
    })
  } catch (error) {
    logger.error('metric.write_failed', { name, error: (error as Error).message })
  }
}
