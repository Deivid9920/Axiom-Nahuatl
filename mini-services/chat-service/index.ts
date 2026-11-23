// AXIOM — WebSocket Chat Service (SECURITY HARDENED)
// 1. JWT verification on connection (no trusting client-supplied userId)
// 2. Origin restriction (no wildcard CORS)
// 3. Input validation on all socket events
// 4. Rate limiting on messages
// 5. Message size limits

import { createServer } from 'http'
import { Server } from 'socket.io'
import { jwtVerify } from 'jose'

const PORT = 3003

// SECURITY: Restrict CORS to known origins only
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000', 'http://localhost:81']  // dev defaults

// SECURITY: JWT secret must match the main app
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'axiom-dev-secret-DO-NOT-USE-IN-PRODUCTION-32chars-min'
)

// SECURITY: Rate limiting per socket
const MESSAGE_RATE_LIMIT = 10  // messages per 10 seconds
const messageTimestamps = new Map<string, number[]>()

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: ALLOWED_ORIGINS,  // SECURITY: No wildcard
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,  // SECURITY: 1MB max message size
})

interface AuthenticatedUser {
  userId: string
  email: string
  socketId: string
}

const connectedUsers = new Map<string, AuthenticatedUser>()

// SECURITY: Verify JWT token
async function verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    if (payload.type !== 'access') return null
    return {
      userId: payload.sub as string,
      email: payload.email as string,
    }
  } catch {
    return null
  }
}

// SECURITY: Rate limit check
function checkRateLimit(socketId: string): boolean {
  const now = Date.now()
  const windowMs = 10 * 1000  // 10 seconds
  const timestamps = messageTimestamps.get(socketId) || []
  const recent = timestamps.filter(t => now - t < windowMs)
  if (recent.length >= MESSAGE_RATE_LIMIT) {
    return false  // rate limited
  }
  recent.push(now)
  messageTimestamps.set(socketId, recent)
  return true
}

// SECURITY: Input sanitization
function sanitizeInput(input: string, maxLength: number = 5000): string {
  return input
    .slice(0, maxLength)  // truncate to max length
    .replace(/\x00/g, '')  // remove null bytes
    .trim()
}

io.on('connection', (socket) => {
  console.log(`[chat-service] connected: ${socket.id}`)

  // SECURITY: Authentication required within 5 seconds or disconnect
  let authenticated = false
  const authTimeout = setTimeout(() => {
    if (!authenticated) {
      socket.emit('error', { message: 'Authentication timeout' })
      socket.disconnect(true)
    }
  }, 5000)

  socket.on('auth', async (payload: { token: string }) => {
    if (!payload || typeof payload.token !== 'string') {
      socket.emit('error', { message: 'Invalid auth payload' })
      socket.disconnect(true)
      return
    }

    const user = await verifyToken(payload.token)
    if (!user) {
      socket.emit('error', { message: 'Authentication failed' })
      socket.disconnect(true)
      return
    }

    authenticated = true
    clearTimeout(authTimeout)
    connectedUsers.set(socket.id, { ...user, socketId: socket.id })
    socket.emit('auth_ok', { socketId: socket.id, userId: user.userId })
    console.log(`[chat-service] authenticated: ${user.userId} → ${socket.id}`)
  })

  socket.on('chat:send', (payload: unknown) => {
    const user = connectedUsers.get(socket.id)
    if (!user) {
      socket.emit('error', { message: 'Not authenticated' })
      return
    }

    // SECURITY: Validate payload structure
    if (!payload || typeof payload !== 'object') {
      socket.emit('error', { message: 'Invalid payload' })
      return
    }

    const p = payload as { sessionId?: string; message?: string; module?: string; mode?: string }

    // SECURITY: Validate and sanitize all fields
    if (typeof p.sessionId !== 'string' || p.sessionId.length > 100) {
      socket.emit('error', { message: 'Invalid sessionId' })
      return
    }
    if (typeof p.message !== 'string' || p.message.length === 0) {
      socket.emit('error', { message: 'Invalid message' })
      return
    }
    if (typeof p.module !== 'string' || !['conversation', 'text', 'voice'].includes(p.module)) {
      socket.emit('error', { message: 'Invalid module' })
      return
    }

    // SECURITY: Rate limit
    if (!checkRateLimit(socket.id)) {
      socket.emit('error', { message: 'Rate limit exceeded. Slow down.' })
      return
    }

    // Sanitize inputs
    const sanitizedMessage = sanitizeInput(p.message, 5000)
    const sanitizedSessionId = sanitizeInput(p.sessionId, 100)

    socket.emit('chat:ack', {
      sessionId: sanitizedSessionId,
      messageId: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),
    })

    console.log(`[chat-service] msg from ${user.userId} on session ${sanitizedSessionId}`)
  })

  socket.on('typing:start', (payload: unknown) => {
    const user = connectedUsers.get(socket.id)
    if (!user || !payload || typeof payload !== 'object') return
    const p = payload as { sessionId?: string }
    if (typeof p.sessionId !== 'string') return
    socket.broadcast.emit('typing:start', { sessionId: sanitizeInput(p.sessionId, 100) })
  })

  socket.on('typing:stop', (payload: unknown) => {
    const user = connectedUsers.get(socket.id)
    if (!user || !payload || typeof payload !== 'object') return
    const p = payload as { sessionId?: string }
    if (typeof p.sessionId !== 'string') return
    socket.broadcast.emit('typing:stop', { sessionId: sanitizeInput(p.sessionId, 100) })
  })

  socket.on('disconnect', () => {
    clearTimeout(authTimeout)
    connectedUsers.delete(socket.id)
    messageTimestamps.delete(socket.id)
    console.log(`[chat-service] disconnected: ${socket.id}`)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[chat-service] listening on port ${PORT}`)
  console.log(`[chat-service] allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
})
