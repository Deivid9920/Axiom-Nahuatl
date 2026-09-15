// AXIOM — Authentication & RBAC

import argon2 from 'argon2'
import { SignJWT, jwtVerify } from 'jose'
import { db } from '@/lib/db'
import { logger, audit } from '@/lib/observability'
import { ROLES, ROLE_PERMISSIONS, type Role, type Permission } from '@/lib/types'

const DEV_FALLBACK_SECRET = 'axiom-dev-secret-DO-NOT-USE-IN-PRODUCTION-32chars-min'

let cachedSecret: Uint8Array | null = null
let devWarningShown = false

function getJwtSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret

  const raw = process.env.JWT_SECRET
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production. Set it in .env')
    }
    if (!devWarningShown) {
      console.warn(' WARNING: JWT_SECRET not set. Using insecure dev fallback. DO NOT use in production.')
      devWarningShown = true
    }
  }

  cachedSecret = new TextEncoder().encode(raw || DEV_FALLBACK_SECRET)
  return cachedSecret
}
const JWT_ISSUER = 'axiom.app'
const JWT_AUDIENCE = 'axiom.web'

const ACCESS_TOKEN_TTL = 15 * 60  // 15 minutes (seconds)
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60  // 7 days

export interface JwtPayload {
  sub: string
  email: string
  roles: Role[]
  jti: string
  sid: string
  type: 'access' | 'refresh'
  iat: number
  exp: number
}

// Password hashing (Argon2id)
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password)
  } catch (err) {
    // DIAGNÓSTICO: registrar fallos de argon2 sin exponer la contraseña
    console.error('[auth] argon2.verify falló — revisa la instalación del módulo nativo:', err)
    return false
  }
}

// Password strength validation (zxcvbn-style heuristic)
const COMMON_PASSWORDS = new Set([
  'password', '12345678', '123456789', 'qwerty123', 'abc12345',
  'password1', 'iloveyou', 'admin123', 'welcome1', 'monkey123',
  'sunshine1', 'princess1', 'football1', 'charlie1', 'shadow12',
  'axiom12345', 'axiom123', 'letmein1', 'master12', 'dragon12',
])

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres')
  }
  if (password.length > 128) {
    errors.push('La contraseña no puede exceder 128 caracteres')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una minúscula')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una mayúscula')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número')
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un carácter especial')
  }
  // Check common passwords (case-insensitive)
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    errors.push('Esta contraseña es demasiado común. Elige una más segura')
  }
  // Check for sequences
  if (/(.)\1{3,}/.test(password)) {
    errors.push('La contraseña no debe contener más de 3 caracteres repetidos seguidos')
  }
  if (/(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(password)) {
    errors.push('La contraseña no debe contener secuencias obvias')
  }
  return { valid: errors.length === 0, errors }
}

// JWT issue/verify
export async function issueSession(user: { id: string; email: string; roles: Role[] }): Promise<{
  accessToken: string
  refreshToken: string
  sessionId: string
}> {
  const sessionId = crypto.randomUUID()   // identifica la sesión (jti del access)
  const refreshSecret = crypto.randomUUID() // material secreto del refresco
  const now = Math.floor(Date.now() / 1000)
  const refreshHash = await argon2.hash(refreshSecret)

  await db.authSession.create({
    data: {
      userId: user.id,
      jwtJti: sessionId,
      refreshHash,
      expiresAt: new Date(now * 1000 + REFRESH_TOKEN_TTL * 1000),
    },
  })

  const base = { email: user.email, roles: user.roles, sid: sessionId }

  const accessToken = await new SignJWT({ ...base, type: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setJti(sessionId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TOKEN_TTL)
    .sign(getJwtSecret())

  const refreshToken = await new SignJWT({ ...base, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.id)
    .setJti(refreshSecret)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TOKEN_TTL)
    .sign(getJwtSecret())

  return { accessToken, refreshToken, sessionId }
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

// RBAC helpers
export async function getUserRoles(userId: string): Promise<Role[]> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: { role: true },
  })
  return userRoles.map(ur => ur.role.name as Role)
}

export function hasPermission(roles: Role[], permission: Permission): boolean {
  return roles.some(role => ROLE_PERMISSIONS[role]?.includes(permission))
}

export function hasAnyPermission(roles: Role[], permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(roles, p))
}

// Session helpers (for Next.js API routes / Server Actions)
import { cookies } from 'next/headers'

const ACCESS_COOKIE = 'ax_access'
const REFRESH_COOKIE = 'ax_refresh'

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies()
  const common = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  }
  cookieStore.set(ACCESS_COOKIE, accessToken, { ...common, maxAge: ACCESS_TOKEN_TTL })
  cookieStore.set(REFRESH_COOKIE, refreshToken, { ...common, maxAge: REFRESH_TOKEN_TTL })
}

export async function clearAuthCookies() {
  const cookieStore = await cookies()
  cookieStore.delete(ACCESS_COOKIE)
  cookieStore.delete(REFRESH_COOKIE)
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value
  if (!accessToken) return null

  const payload = await verifyToken(accessToken)
  if (!payload || payload.type !== 'access') {
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value
    if (!refreshToken) return null
    return refreshSession(refreshToken)
  }

  const session = await db.authSession.findUnique({
    where: { jwtJti: payload.jti },
  })
  if (!session || session.revokedAt) return null

  const roles = await getUserRoles(payload.sub)
  return {
    userId: payload.sub,
    email: payload.email,
    roles,
    jti: payload.jti,
    requestId: crypto.randomUUID(),
  }
}

export async function refreshSession(refreshToken: string): Promise<AuthContext | null> {
  const payload = await verifyToken(refreshToken)
  if (!payload || payload.type !== 'refresh' || !payload.sid) return null

  const session = await db.authSession.findUnique({
    where: { jwtJti: payload.sid },
  })
  if (!session || session.revokedAt || session.userId !== payload.sub) return null
  if (session.expiresAt.getTime() < Date.now()) return null

  const valid = await argon2.verify(session.refreshHash, payload.jti)
  if (!valid) return null

  const roles = await getUserRoles(payload.sub)

  await db.authSession.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  })

  const issued = await issueSession({ id: payload.sub, email: payload.email, roles })
  await setAuthCookies(issued.accessToken, issued.refreshToken)

  return {
    userId: payload.sub,
    email: payload.email,
    roles,
    jti: issued.sessionId,
    requestId: crypto.randomUUID(),
  }
}

export interface AuthContext {
  userId: string
  email: string
  roles: Role[]
  jti: string
  requestId: string
}

// Permission enforcement for API routes
export async function requirePermission(
  permission: Permission
): Promise<{ ok: true; ctx: AuthContext } | { ok: false; status: 401 | 403; message: string }> {
  const ctx = await getAuthContext()
  if (!ctx) {
    return { ok: false, status: 401, message: 'No autenticado' }
  }
  if (!hasPermission(ctx.roles, permission)) {
    await audit('rbac.deny', {
      userId: ctx.userId,
      resourceType: 'permission',
      resourceId: permission,
      requestId: ctx.requestId,
    })
    return { ok: false, status: 403, message: 'Permiso denegado' }
  }
  return { ok: true, ctx }
}

// User registration & authentication
export async function registerUser(opts: {
  email: string
  password: string
  name?: string
}): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const email = opts.email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Email inválido' }
  }

  const strengthCheck = validatePasswordStrength(opts.password)
  if (!strengthCheck.valid) {
    return { ok: false, error: strengthCheck.errors[0] }
  }

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return { ok: false, error: 'No se pudo crear la cuenta. Verifica tus datos.' }
  }

  const passwordHash = await hashPassword(opts.password)
  const user = await db.user.create({
    data: {
      email,
      name: opts.name,
      passwordHash,
      profile: { create: {} },
    },
  })

  const studentRole = await db.role.findUnique({ where: { name: 'STUDENT' } })
  if (studentRole) {
    await db.userRole.create({
      data: { userId: user.id, roleId: studentRole.id },
    })
  }

  const basicoPlan = await db.plan.findUnique({ where: { code: 'basico' } })
  if (basicoPlan) {
    await db.subscription.create({
      data: {
        userId: user.id,
        planId: basicoPlan.id,
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    })
  }

  await audit('user.register', { userId: user.id, resourceId: user.id })
  logger.info('user.registered', { user_id: user.id, email })

  return { ok: true, userId: user.id }
}

export async function authenticate(opts: {
  email: string
  password: string
  ipAddress?: string
  userAgent?: string
}): Promise<{ ok: true; ctx: AuthContext } | { ok: false; dbIssue?: boolean; error: string }> {
  const email = opts.email.toLowerCase().trim()
  let user
  try {
    user = await db.user.findUnique({ where: { email } })
  } catch (err) {
    const code = (err as { code?: string })?.code
    if (code === 'P2021' || code === 'P2022' || code === 'P1003') {
      return {
        ok: false,
        dbIssue: true,
        error: 'La base de datos no está inicializada. Ejecuta: bunx prisma db push',
      }
    }
    throw err
  }

  const DUMMY_HASH = '$argon2id$v=19$m=19456,t=2,p=1$dGhpcyBpcyBhIGR1bW15IHNhbHQ$dummyhashthatwillalwaysfailverification1234567890'
  const hashToVerify = user?.passwordHash || DUMMY_HASH
  const valid = await verifyPassword(opts.password, hashToVerify)

  if (!user || !valid) {
    if (!user) {
      let userCount = -1
      try {
        userCount = await db.user.count()
      } catch {
        userCount = -1
      }
      if (userCount === 0) {
        await audit('login.failed', { metadata: { reason: 'db_not_seeded' } })
        return {
          ok: false,
          dbIssue: true,
          error: 'La base de datos está vacía (falta el seed). Ejecuta: bun run scripts/seed.ts — crea el usuario demo admin@axiom.mx / axiom12345',
        }
      }
    }
    await audit('login.failed', {
      userId: user?.id,
      metadata: { reason: user ? 'bad_password' : 'user_not_found' }
    })
    return { ok: false, error: 'Credenciales inválidas' }
  }

  const roles = await getUserRoles(user.id)
  const issued = await issueSession({ id: user.id, email: user.email, roles })
  await setAuthCookies(issued.accessToken, issued.refreshToken)

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  await audit('login', {
    userId: user.id,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
  })

  return {
    ok: true,
    ctx: {
      userId: user.id,
      email: user.email,
      roles,
      jti: issued.sessionId,
      requestId: crypto.randomUUID(),
    },
  }
}

export async function logout(authCtx: AuthContext) {
  await db.authSession.updateMany({
    where: { userId: authCtx.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  await clearAuthCookies()
  await audit('logout', { userId: authCtx.userId, requestId: authCtx.requestId })
}
