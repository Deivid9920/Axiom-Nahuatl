import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { registerUser, authenticate, getAuthContext, logout } from '@/lib/auth'
import { audit } from '@/lib/observability'
import { events } from '@/lib/events'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function POST(req: NextRequest) {
  const url = new URL(req.url)
  const action = url.searchParams.get('action') || 'login'

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  if (action === 'register') {
    const parse = registerSchema.safeParse(body)
    if (!parse.success) {
      return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
    }
    const result = await registerUser(parse.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Auto-login after register
    const loginResult = await authenticate({
      email: parse.data.email,
      password: parse.data.password,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
      userAgent: req.headers.get('user-agent') || undefined,
    })
    if (!loginResult.ok) {
      return NextResponse.json({ error: 'Cuenta creada pero no se pudo iniciar sesión' }, { status: 500 })
    }

    await events.publish({
      name: 'USER_REGISTERED',
      producer: 'auth',
      producerUserId: result.userId,
      payload: { userId: result.userId, email: parse.data.email },
    })

    return NextResponse.json({
      ok: true,
      user: {
        id: result.userId,
        email: parse.data.email,
        name: parse.data.name,
        roles: loginResult.ctx.roles,
      },
    })
  }

  // Default: login
  const parse = loginSchema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 400 })
  }

  const result = await authenticate({
    email: parse.data.email,
    password: parse.data.password,
    ipAddress: req.headers.get('x-forwarded-for') || undefined,
    userAgent: req.headers.get('user-agent') || undefined,
  })
  if (!result.ok) {
    // Problemas de BD (sin push/seed) -> 503 con el comando exacto, no 401
    return NextResponse.json(
      { error: result.error },
      { status: result.dbIssue ? 503 : 401 }
    )
  }

  await events.publish({
    name: 'USER_LOGGED_IN',
    producer: 'auth',
    producerUserId: result.ctx.userId,
    payload: { userId: result.ctx.userId, ip: req.headers.get('x-forwarded-for') },
  })

  return NextResponse.json({
    ok: true,
    user: { id: result.ctx.userId, email: result.ctx.email, roles: result.ctx.roles },
  })
}

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({
    authenticated: true,
    user: { id: ctx.userId, email: ctx.email, roles: ctx.roles },
  })
}

export async function DELETE() {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ ok: true })  // idempotent
  }
  await logout(ctx)
  return NextResponse.json({ ok: true })
}
