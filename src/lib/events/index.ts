// AXIOM — Event-Driven Design
// 15 system events; in-process bus + SystemEvent table for audit/replay

import { db } from '@/lib/db'
import { logger, audit, tracer, type Span } from '@/lib/observability'
import { SYSTEM_EVENTS, type SystemEventName } from '@/lib/types'
import { EventEmitter } from 'events'

// Event Bus
class EventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(50)  // many consumers
  }

  async publish(opts: {
    name: SystemEventName
    producer: string
    producerUserId?: string
    payload: Record<string, unknown>
    parentSpan?: Span
  }): Promise<string> {
    return tracer.withSpan(
      'event.publish',
      async (span) => {
        span.setAttribute('event.name', opts.name)
        span.setAttribute('event.producer', opts.producer)
        if (opts.producerUserId) span.setAttribute('user.id', opts.producerUserId)

        // 1. Persist for audit/replay
        const record = await db.systemEvent.create({
          data: {
            name: opts.name,
            producer: opts.producer,
            producerUserId: opts.producerUserId || null,
            payloadJson: JSON.stringify(opts.payload),
            status: 'pending',
          },
        })

        // 2. Emit to in-process subscribers
        try {
          this.emit(opts.name, {
            eventId: record.id,
            name: opts.name,
            producer: opts.producer,
            producerUserId: opts.producerUserId,
            payload: opts.payload,
          })
        } catch (error) {
          logger.error('event.emit_failed', {
            event_id: record.id,
            event_name: opts.name,
            error: (error as Error).message,
          }, error as Error)
        }

        // 3. Also emit a wildcard event for logging/debugging
        try {
          this.emit('*', {
            eventId: record.id,
            name: opts.name,
            producer: opts.producer,
            producerUserId: opts.producerUserId,
            payload: opts.payload,
          })
        } catch {}

        return record.id
      },
      { parentSpanId: opts.parentSpan?.spanId }
    )
  }

  subscribe(eventName: SystemEventName | '*', handler: (event: SystemEventInstance) => void | Promise<void>) {
    this.on(eventName, async (event) => {
      try {
        await handler(event)
      } catch (error) {
        logger.error('event.consumer_failed', {
          event_id: event.eventId,
          event_name: event.name,
          error: (error as Error).message,
        }, error as Error)
      }
    })
  }
}

export interface SystemEventInstance {
  eventId: string
  name: SystemEventName
  producer: string
  producerUserId?: string
  payload: Record<string, unknown>
}

const bus = new EventBus()

// Mark event as processed (for audit trail)
export async function markEventProcessed(eventId: string, consumer: string, status: 'completed' | 'failed', errorMessage?: string) {
  await db.systemEvent.update({
    where: { id: eventId },
    data: {
      consumer,
      status,
      processedAt: new Date(),
      errorMessage,
    },
  })
}

// Public API
export const events = {
  publish: (opts: Parameters<typeof bus.publish>[0]) => bus.publish(opts),
  subscribe: (eventName: Parameters<typeof bus.subscribe>[0], handler: Parameters<typeof bus.subscribe>[1]) =>
    bus.subscribe(eventName, handler),
  bus,  // exposed for testing
}

// Validated event payload schemas
export const EVENT_PAYLOAD_VALIDATORS = {
  USER_REGISTERED: (p: any): p is { userId: string; email: string } =>
    typeof p?.userId === 'string' && typeof p?.email === 'string',

  USER_LOGGED_IN: (p: any): p is { userId: string; ip?: string } =>
    typeof p?.userId === 'string',

  SESSION_STARTED: (p: any): p is { sessionId: string; userId: string; module: string; mode: string } =>
    typeof p?.sessionId === 'string' && typeof p?.userId === 'string' && typeof p?.module === 'string' && typeof p?.mode === 'string',

  MESSAGE_SENT: (p: any): p is { sessionId: string; userId: string; messageId: string; contentLength: number } =>
    typeof p?.sessionId === 'string' && typeof p?.userId === 'string' && typeof p?.messageId === 'string',

  MESSAGE_RECEIVED: (p: any): p is { sessionId: string; userId: string; messageId: string; tokens: number; costMxnCents: number } =>
    typeof p?.sessionId === 'string' && typeof p?.userId === 'string' && typeof p?.messageId === 'string',

  CORRECTION_ISSUED: (p: any): p is { sessionId: string; userId: string; messageId: string; corrections: unknown[] } =>
    typeof p?.sessionId === 'string' && typeof p?.userId === 'string' && Array.isArray(p?.corrections),

  USER_COMPLETED_LESSON: (p: any): p is { sessionId: string; userId: string; durationSec: number; thetaDelta: number } =>
    typeof p?.sessionId === 'string' && typeof p?.userId === 'string' && typeof p?.durationSec === 'number',

  RECOMMENDATION_GENERATED: (p: any): p is { userId: string; recommendation: string; reason: string } =>
    typeof p?.userId === 'string' && typeof p?.recommendation === 'string',

  PROGRESS_UPDATED: (p: any): p is { userId: string; thetaBefore: number; thetaAfter: number; date: string } =>
    typeof p?.userId === 'string' && typeof p?.thetaBefore === 'number' && typeof p?.thetaAfter === 'number',

  VOCABULARY_LEARNED: (p: any): p is { userId: string; term: string; cefrLevel: string } =>
    typeof p?.userId === 'string' && typeof p?.term === 'string',

  PAYMENT_SUCCEEDED: (p: any): p is { userId: string; paymentId: string; amountMxnCents: number; planCode: string } =>
    typeof p?.userId === 'string' && typeof p?.paymentId === 'string' && typeof p?.amountMxnCents === 'number',

  PAYMENT_FAILED: (p: any): p is { userId: string; paymentId: string; reason: string } =>
    typeof p?.userId === 'string' && typeof p?.paymentId === 'string',

  PLAN_CHANGED: (p: any): p is { userId: string; oldPlanCode: string; newPlanCode: string; reason: string } =>
    typeof p?.userId === 'string' && typeof p?.oldPlanCode === 'string' && typeof p?.newPlanCode === 'string',

  ERROR_DETECTED: (p: any): p is { errorId: string; fingerprint: string; name: string; statusCode?: number } =>
    typeof p?.errorId === 'string' && typeof p?.fingerprint === 'string',

  ENGINEERING_INSIGHT: (p: any): p is { clusterId: string; insight: string; affectedUsers: number } =>
    typeof p?.clusterId === 'string' && typeof p?.insight === 'string',
} as const
