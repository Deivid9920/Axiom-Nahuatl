// Security headers + rate limiting on all API routes

import { NextRequest, NextResponse } from 'next/server'
import { rateLimiter, getClientIp } from '@/lib/security/rate-limiter'

// Routes that need special rate limiting
const LOGIN_PATH = '/api/auth'
const REGISTER_PATH = '/api/auth?action=register'
const LLM_PATHS = ['/api/modules', '/api/voice', '/api/agents']

export function proxy(req: NextRequest) {
  const res = NextResponse.next()

  // Security Headers (applied to ALL responses)
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=()')
  res.headers.set('X-DNS-Prefetch-Control', 'off')
  res.headers.set('X-Download-Options', 'noopen')

  // Content-Security-Policy
  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com"
    : "script-src 'self' 'unsafe-inline' https://fonts.googleapis.com"
  const csp = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    // R41: blob: en connect-src — GLTFLoader descarga las texturas embebidas
    // de los GLB vía fetch() de un blob URL (img-src blob: no basta: fetch se
    // rige por connect-src). Sin esto, lémur/fauna GLB cargan SIN textura.
    // blob: es de documento propio (sólo la página puede crearlo): riesgo nulo.
    "connect-src 'self' ws: wss: https: blob:",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join('; ')
  res.headers.set('Content-Security-Policy', csp)

  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  // Rate Limiting on API routes
  const { pathname, searchParams } = req.nextUrl
  if (!pathname.startsWith('/api/')) {
    return res
  }

  const ip = getClientIp(req)

  // Login rate limiting: 5 attempts per 15 min per IP
  if (pathname === '/api/auth' && req.method === 'POST') {
    const action = searchParams.get('action') || 'login'
    if (action === 'register') {
      const registerCheck = rateLimiter.checkRegister(ip)
      if (!registerCheck.allowed) {
        return NextResponse.json(
          { error: 'Demasiados intentos de registro. Intenta más tarde.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(registerCheck.retryAfter),
              'X-Content-Type-Options': 'nosniff',
            }
          }
        )
      }
    } else {
      const loginCheck = rateLimiter.checkLogin(ip)
      if (!loginCheck.allowed) {
        return NextResponse.json(
          { error: 'Demasiados intentos de inicio de sesión. Intenta más tarde.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(loginCheck.retryAfter),
              'X-Content-Type-Options': 'nosniff',
            }
          }
        )
      }
    }
  }

  // General API rate limiting: 60 req/min per IP. Opera en producción; en
  // desarrollo se omite para no interferir con la recarga en caliente ni con
  // las pruebas E2E (múltiples navegaciones desde la misma IP).
  if (process.env.NODE_ENV === 'production') {
    const apiCheck = rateLimiter.checkApi(ip)
    if (!apiCheck.allowed) {
      return NextResponse.json(
        { error: 'Límite de peticiones excedido. Intenta más tarde.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(apiCheck.retryAfter),
            'X-Content-Type-Options': 'nosniff',
          }
        }
      )
    }
  }

  return res
}

export const config = {
  matcher: [
    // Apply to all routes except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|logo.svg).*)',
  ],
}
