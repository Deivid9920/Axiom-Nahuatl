// AXIOM — Error capture (for Engineering Agent consumption)

import { db } from '@/lib/db'
import { events } from '@/lib/events'
import { logger } from '@/lib/observability'
import crypto from 'crypto'

export async function captureError(opts: {
  name: string
  message: string
  stack?: string
  statusCode?: number
  requestUrl?: string
  requestMethod?: string
  requestId?: string
  userAgent?: string
  ipAddress?: string
  userId?: string
  metadata?: Record<string, unknown>
}) {
  // Fingerprint: name + first 100 chars of message + statusCode
  const fingerprintInput = `${opts.name}|${opts.message.slice(0, 100)}|${opts.statusCode || ''}`
  const fingerprint = crypto.createHash('sha256').update(fingerprintInput).digest('hex').slice(0, 16)

  try {
    const errorEvent = await db.errorEvent.create({
      data: {
        fingerprint,
        name: opts.name,
        message: opts.message,
        stack: opts.stack,
        statusCode: opts.statusCode,
        requestUrl: opts.requestUrl,
        requestMethod: opts.requestMethod,
        requestId: opts.requestId,
        userAgent: opts.userAgent,
        ipAddress: opts.ipAddress,
        userId: opts.userId,
        metadataJson: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    })

    await events.publish({
      name: 'ERROR_DETECTED',
      producer: 'error_capture',
      producerUserId: opts.userId,
      payload: {
        errorId: errorEvent.id,
        fingerprint,
        name: opts.name,
        statusCode: opts.statusCode,
      },
    })

    logger.warn('error.captured', {
      error_id: errorEvent.id,
      fingerprint,
      name: opts.name,
      status_code: opts.statusCode,
    })
  } catch (e) {
    // Fail silently — we don't want error capture to crash the app
    logger.error('error.capture_failed', { original_error: opts.message, capture_error: (e as Error).message })
  }
}
