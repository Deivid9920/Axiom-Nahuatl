/**
 * R33 — Evidencia: cola de reintentos en el panel (R33-a), reintento manual de un
 * correo concreto (R33-b) y conciliación de pagos MP (R33-c, dev_skip sin token).
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true).
 * Genera en <OUT>:
 *   01-cola-reintentos.png     — panel admin: bloque «Cola de reintentos» con el correo programado
 *   02-reintento-cola.png      — tras «Enviar ahora»: fila reenviada, cola vacía
 *   03-reintento-manual.png    — correo terminal reenviado desde la tabla («Reintentar»)
 *   04-conciliacion-devskip.png— botón «Conciliar pagos MP» + resumen dev_skip
 * Aserciones: la cola muestra el correo pendiente (próximo intento 2 de 3), el
 * reintento manual pasa la fila a dev_logged (BD), la conciliación responde dev_skip.
 * Uso: env -u DATABASE_URL bun scripts/r33_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r33'] = process.argv

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('db', 'custom.db')}` } },
})

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })

  await page.goto(`${BASE}/`, { timeout: 90000 })
  const hello = page.locator('.axiom-hello')
  try {
    await hello.waitFor({ timeout: 8000 })
  } catch {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]', { timeout: 20000 })
    await hello.waitFor({ timeout: 60000 })
  }
  console.log('[r33] login ok')

  // ------------------------------------------------ Preparación (usuario dedicado)
  // correo A: en cola (nextRetryAt a futuro) · correo B: terminal (calendario agotado)
  let u = await prisma.user.findUnique({ where: { email: 'r33-evid@axiom.mx' } })
  if (!u) {
    u = await prisma.user.create({
      data: { email: 'r33-evid@axiom.mx', name: 'Evidencia R33', passwordHash: 'evid-no-login', profile: { create: {} } },
    })
  }
  await prisma.emailLog.deleteMany({ where: { userId: u!.id } })
  await prisma.subscription.deleteMany({ where: { userId: u!.id } })
  await prisma.payment.deleteMany({ where: { userId: u!.id } })
  const enCola = await prisma.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: aviso de renovación (en cola)',
      kind: 'renewal_notice',
      body: 'Tu plan vence pronto; lo reintentaremos automáticamente.',
      status: 'failed',
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 30 * 60000), // a futuro → visible en la cola
      lastError: 'resend_error_500',
      dedupeKey: `evid-r33:queue:${Date.now()}`,
    },
  })
  const terminal = await prisma.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: recibo de renovación (terminal)',
      kind: 'renewal_receipt',
      body: 'Renovación confirmada.',
      status: 'failed',
      retryCount: 3,
      nextRetryAt: null, // terminal: sólo reenviable manualmente
      lastError: 'resend_error_503',
      dedupeKey: `evid-r33:terminal:${Date.now()}`,
    },
  })
  console.log('[r33] correos preparados:', { enCola: enCola.id, terminal: terminal.id })

  // ------------------------------------------------ R33-a: cola de reintentos en el panel
  await page.locator('button:has-text("Panel")').first().click({ timeout: 20000 })
  const emailsHeading = page.locator('h3:has-text("Correos enviados")')
  await emailsHeading.waitFor({ timeout: 30000 })
  const queue = page.locator('.r33-mail-queue')
  await queue.waitFor({ timeout: 20000 })
  const queueText = await queue.textContent()
  console.log('[r33] cola:', queueText?.replace(/\s+/g, ' ').trim())
  if (!queueText?.includes('Cola de reintentos')) throw new Error('la cola de reintentos no aparece')
  if (!queueText?.includes('Próximo intento 2 de 3')) throw new Error('la fila de cola no muestra el próximo intento')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01-cola-reintentos.png`, fullPage: false })
  console.log('[r33] captura 01-cola-reintentos.png')

  // ------------------------------------------------ R33-b: «Enviar ahora» desde la cola
  await page.locator('.r33-queue-row .r33-retry-btn').first().click({ timeout: 20000 })
  // Señal UI: la cola queda vacía tras el refresco del reintento exitoso
  await queue.waitFor({ state: 'detached', timeout: 20000 })
  const retriedA = await prisma.emailLog.findUnique({ where: { id: enCola.id } })
  if (!retriedA || retriedA.status !== 'dev_logged' || retriedA.nextRetryAt !== null) {
    throw new Error(`el correo en cola no fue reenviado: status=${retriedA?.status} nextRetryAt=${retriedA?.nextRetryAt}`)
  }
  console.log('[r33] correo en cola reenviado (dev_logged, nextRetryAt null) ✔')
  await page.screenshot({ path: `${OUT}/02-reintento-cola.png`, fullPage: false })
  console.log('[r33] captura 02-reintento-cola.png')

  // ------------------------------------------------ R33-b: «Reintentar» del correo terminal
  const filaTerminal = page.locator('tr', { has: page.locator('text=Axiom: recibo de renovación (terminal)') })
  await filaTerminal.scrollIntoViewIfNeeded()
  await filaTerminal.locator('.r33-retry-btn').click({ timeout: 20000 })
  await filaTerminal.locator('span.r31-email-status.dev_logged').waitFor({ timeout: 20000 })
  const retriedB = await prisma.emailLog.findUnique({ where: { id: terminal.id } })
  if (!retriedB || retriedB.status !== 'dev_logged' || retriedB.nextRetryAt !== null) {
    throw new Error(`el correo terminal no fue reenviado: status=${retriedB?.status}`)
  }
  console.log('[r33] correo terminal reenviado desde la tabla (dev_logged) ✔')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-reintento-manual.png`, fullPage: false })
  console.log('[r33] captura 03-reintento-manual.png')

  // ------------------------------------------------ R33-c: conciliación MP (dev_skip)
  const metricsHeading = page.locator('h3:has-text("Facturación · ciclo de renovación")')
  await metricsHeading.scrollIntoViewIfNeeded()
  await metricsHeading.waitFor({ timeout: 20000 })
  await page.locator('.r33-reconcile-btn').click({ timeout: 20000 })
  const reconcileResult = page.locator('.r33-reconcile-result')
  await reconcileResult.waitFor({ timeout: 30000 })
  const reconcileText = await reconcileResult.textContent()
  console.log('[r33] conciliación:', reconcileText?.replace(/\s+/g, ' ').trim())
  if (!reconcileText?.includes('Sin token de Mercado Pago')) throw new Error('la conciliación no respondió dev_skip')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04-conciliacion-devskip.png`, fullPage: false })
  console.log('[r33] captura 04-conciliacion-devskip.png')

  if (errors.length > 0) {
    console.error('[r33] pageerror:', errors)
    process.exitCode = 1
  }

  // Limpieza: dejar la BD demo sin residuos de la evidencia
  await prisma.emailLog.deleteMany({ where: { userId: u!.id } })
  await prisma.subscription.deleteMany({ where: { userId: u!.id } })
  await prisma.payment.deleteMany({ where: { userId: u!.id } })
  await browser.close()
  console.log('[r33] evidencia completa ✔')
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
