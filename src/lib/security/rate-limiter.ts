// AXIOM — Rate Limiting Middleware
// Uses in-memory token bucket per IP + per user.

interface RateBucket {
  tokens: number
  lastRefill: number
  capacity: number
  refillRate: number  // tokens per second
}

class RateLimiter {
  private buckets = new Map<string, RateBucket>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired buckets every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    this.cleanupInterval.unref?.()
  }

  private cleanup() {
    const now = Date.now()
    const maxAge = 30 * 60 * 1000  // 30 minutes
    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > maxAge) {
        this.buckets.delete(key)
      }
    }
  }

  check(
    key: string,
    opts: { capacity: number; refillRate: number; refillSeconds: number }
  ): { allowed: true } | { allowed: false; retryAfter: number } {
    const now = Date.now()
    const refillRatePerMs = opts.refillRate / (opts.refillSeconds * 1000)

    let bucket = this.buckets.get(key)
    if (!bucket) {
      bucket = {
        tokens: opts.capacity,
        lastRefill: now,
        capacity: opts.capacity,
        refillRate: refillRatePerMs,
      }
      this.buckets.set(key, bucket)
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill
    const refilled = elapsed * bucket.refillRate
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refilled)
    bucket.lastRefill = now

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return { allowed: true }
    }

    // Calculate retry-after: time until 1 token is available
    const retryAfter = Math.ceil(1 / bucket.refillRate / 1000)
    return { allowed: false, retryAfter: Math.max(1, retryAfter) }
  }

  /**
   * Login rate limiter: 5 attempts per 15 minutes per IP
   */
  checkLogin(ip: string): { allowed: true } | { allowed: false; retryAfter: number } {
    return this.check(`login:${ip}`, {
      capacity: 5,
      refillRate: 5,
      refillSeconds: 15 * 60,
    })
  }

  /**
   * API rate limiter: 60 requests per minute per user (or IP if unauthenticated)
   */
  checkApi(identifier: string): { allowed: true } | { allowed: false; retryAfter: number } {
    return this.check(`api:${identifier}`, {
      capacity: 60,
      refillRate: 60,
      refillSeconds: 60,
    })
  }

  checkLlm(userId: string): { allowed: true } | { allowed: false; retryAfter: number } {
    return this.check(`llm:${userId}`, {
      capacity: 10,
      refillRate: 10,
      refillSeconds: 60,
    })
  }

  /**
   * Registration rate limiter: 3 registrations per hour per IP
   */
  checkRegister(ip: string): { allowed: true } | { allowed: false; retryAfter: number } {
    return this.check(`register:${ip}`, {
      capacity: 3,
      refillRate: 3,
      refillSeconds: 60 * 60,
    })
  }

  destroy() {
    clearInterval(this.cleanupInterval)
    this.buckets.clear()
  }
}

const rateLimiter = new RateLimiter()
export { rateLimiter }

const TRUSTED_PROXIES = new Set(
  (process.env.TRUSTED_PROXIES || '127.0.0.1,::1,::ffff:127.0.0.1')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
)

const IPV4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const IPV6 = /^[0-9a-fA-F:]+$/

function isValidIp(value: string): boolean {
  if (IPV4.test(value)) {
    return value.split('.').every(o => Number(o) <= 255)
  }
  return IPV6.test(value) && value.includes(':')
}

export function getClientIp(req: Request, socketIp?: string): string {
  const proxyIsTrusted = socketIp
    ? TRUSTED_PROXIES.has(socketIp)
    : process.env.TRUST_PROXY_HEADERS === 'true'

  if (proxyIsTrusted) {
    const xff = req.headers.get('x-forwarded-for')
    if (xff) {
      const firstIp = xff.split(',')[0].trim()
      if (isValidIp(firstIp)) return firstIp
    }
    const xri = req.headers.get('x-real-ip')
    if (xri && isValidIp(xri.trim())) return xri.trim()
  }

  // Sin proxy de confianza, la única fuente fiable es la conexión misma.
  if (socketIp && isValidIp(socketIp)) return socketIp

  return 'unknown'
}
