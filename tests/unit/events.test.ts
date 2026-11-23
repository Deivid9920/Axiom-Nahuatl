// Event bus tests
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { events, markEventProcessed, EVENT_PAYLOAD_VALIDATORS } from '@/lib/events'
import { prisma } from '../setup'

describe('Event Bus', () => {
  test('publish + subscribe', async () => {
    const handler = vi.fn()
    events.subscribe('USER_REGISTERED', handler)

    await events.publish({
      name: 'USER_REGISTERED',
      producer: 'test',
      payload: { userId: 'u1', email: 'test@example.com' },
    })

    // Give async handlers time to run
    await new Promise(r => setTimeout(r, 50))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].payload.userId).toBe('u1')
  })

  test('wildcard subscription receives all events', async () => {
    const handler = vi.fn()
    events.subscribe('*', handler)

    await events.publish({
      name: 'USER_LOGGED_IN',
      producer: 'test',
      payload: { userId: 'u1' },
    })

    await new Promise(r => setTimeout(r, 50))
    expect(handler).toHaveBeenCalled()
  })

  test('payload validators work correctly', () => {
    expect(EVENT_PAYLOAD_VALIDATORS.USER_REGISTERED({ userId: 'u1', email: 'a@b.com' })).toBe(true)
    expect(EVENT_PAYLOAD_VALIDATORS.USER_REGISTERED({ userId: 'u1' })).toBe(false)  // missing email
    expect(EVENT_PAYLOAD_VALIDATORS.USER_REGISTERED({})).toBe(false)

    expect(EVENT_PAYLOAD_VALIDATORS.SESSION_STARTED({
      sessionId: 's1', userId: 'u1', module: 'conversation', mode: 'casual',
    })).toBe(true)
    expect(EVENT_PAYLOAD_VALIDATORS.SESSION_STARTED({
      sessionId: 's1', userId: 'u1', module: 'conversation',  // missing mode
    })).toBe(false)
  })

  test('persisted events can be queried', async () => {
    const user = await prisma.user.create({
      data: { email: 'event-test@example.com', passwordHash: 'hash', profile: { create: {} } },
    })

    const eventId = await events.publish({
      name: 'USER_LOGGED_IN',
      producer: 'test',
      producerUserId: user.id,
      payload: { userId: user.id, ip: '127.0.0.1' },
    })

    const persisted = await prisma.systemEvent.findUnique({ where: { id: eventId } })
    expect(persisted).toBeTruthy()
    expect(persisted!.name).toBe('USER_LOGGED_IN')
    expect(persisted!.producer).toBe('test')
    expect(persisted!.status).toBe('pending')
  })

  test('markEventProcessed updates status', async () => {
    const eventId = await events.publish({
      name: 'MESSAGE_SENT',
      producer: 'test',
      payload: { sessionId: 's1', userId: 'u1', messageId: 'm1', contentLength: 100 },
    })

    await markEventProcessed(eventId, 'test-consumer', 'completed')

    const updated = await prisma.systemEvent.findUnique({ where: { id: eventId } })
    expect(updated!.status).toBe('completed')
    expect(updated!.consumer).toBe('test-consumer')
    expect(updated!.processedAt).toBeTruthy()
  })

  test('handler errors do not crash the bus', async () => {
    const badHandler = vi.fn(() => { throw new Error('boom') })
    const goodHandler = vi.fn()
    events.subscribe('PAYMENT_SUCCEEDED', badHandler)
    events.subscribe('PAYMENT_SUCCEEDED', goodHandler)

    await events.publish({
      name: 'PAYMENT_SUCCEEDED',
      producer: 'test',
      payload: { userId: 'u1', paymentId: 'p1', amountMxnCents: 39900, planCode: 'pro' },
    })

    await new Promise(r => setTimeout(r, 50))

    // Both handlers called; bad one threw but didn't crash
    expect(badHandler).toHaveBeenCalled()
    expect(goodHandler).toHaveBeenCalled()
  })
})
