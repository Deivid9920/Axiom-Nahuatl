/**
 * R34 — Evidencia: auto-refresco de la cola con badge (R34-b), auditoría reciente
 * del panel (R34-c) y conciliación MP con acción de reparación disponible (R34-a;
 * el botón «Reprocesar» aparece en filas con discrepancia en modo live — con
 * dev_skip la sección muestra el resumen sin filas).
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true).
 * Genera en <OUT>:
 *   01-badge-auto-cola.png      — Correos enviados con badge «auto · 30 s» + cola de reintentos
 *   02-reintento-auto.png       — tras «Enviar ahora»: fila reenviada (dev_logged)
 *   03-auditoria-reintentos.png — Auditoría reciente filtrada por «Correo reintentado»
 *   04-conciliacion-devskip.png — conciliación MP dev_skip (panel v7)
 * Aserciones: badge visible, reintento pasa la fila a dev_logged (BD), la auditoría
 * registra emails.retried con resourceId = correo y la sección lo muestra filtrada.
 * Uso: env -u DATABASE_URL bun scripts/r34_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r34'] = process.argv

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
  console.log('[r34] login ok')

  // ------------------------------------------------ Preparación (usuario dedicado)
  let u = await prisma.user.findUnique({ where: { email: 'r34-evid@axiom.mx' } })
  if (!u) {
    u = await prisma.user.create({
      data: { email: 'r34-evid@axiom.mx', name: 'Evidencia R34', passwordHash: 'evid-no-login', profile: { create: {} } },
    })
  }
  await prisma.emailLog.deleteMany({ where: { userId: u!.id } })
  await prisma.auditLog.deleteMany({ where: { action: 'emails.retried', resourceId: u!.id } })
  const enCola = await prisma.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: aviso de renovación (R34 en cola)',
      kind: 'renewal_notice',
      body: 'Tu plan vence pronto; lo reintentaremos automáticamente.',
      status: 'failed',
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 30 * 60000),
      lastError: 'resend_error_500',
      dedupeKey: `evid-r34:queue:${Date.now()}`,
    },
  })
  console.log('[r34] correo preparado:', enCola.id)

  // ------------------------------------------------ R34-b: badge auto · 30 s + cola
  await page.locator('button:has-text("Panel")').first().click({ timeout: 20000 })
  const emailsHeading = page.locator('h3:has-text("Correos enviados")')
  await emailsHeading.waitFor({ timeout: 30000 })
  const badge = page.locator('.r34-auto-badge')
  await badge.waitFor({ timeout: 20000 })
  const badgeText = await badge.textContent()
  console.log('[r34] badge:', badgeText?.trim())
  if (!badgeText?.includes('auto · 30 s')) throw new Error('el badge de auto-refresco no aparece')
  const queue = page.locator('.r33-mail-queue')
  await queue.waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01-badge-auto-cola.png`, fullPage: false })
  console.log('[r34] captura 01-badge-auto-cola.png')

  // ------------------------------------------------ R33-b/R34: «Enviar ahora» desde la cola
  const miFila = page.locator('.r33-queue-row', { has: page.locator('text=Axiom: aviso de renovación (R34 en cola)') })
  await miFila.locator('.r33-retry-btn').click({ timeout: 20000 })
  await miFila.waitFor({ state: 'detached', timeout: 20000 })
  const retried = await prisma.emailLog.findUnique({ where: { id: enCola.id } })
  if (!retried || retried.status !== 'dev_logged' || retried.nextRetryAt !== null) {
    throw new Error(`el correo en cola no fue reenviado: status=${retried?.status}`)
  }
  console.log('[r34] correo reenviado (dev_logged, nextRetryAt null) ✔')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/02-reintento-auto.png`, fullPage: false })
  console.log('[r34] captura 02-reintento-auto.png')

  // ------------------------------------------------ R34-c: auditoría reciente filtrada
  const audited = await prisma.auditLog.findFirst({ where: { action: 'emails.retried', resourceId: enCola.id } })
  if (!audited) throw new Error('la operación del reintento no quedó auditada')
  console.log('[r34] audit emails.retried registrada:', audited.id)
  const auditHeading = page.locator('h3:has-text("Auditoría reciente")')
  await auditHeading.scrollIntoViewIfNeeded()
  await auditHeading.waitFor({ timeout: 20000 })
  await page.locator('select[aria-label="Filtrar por acción"]').selectOption('emails.retried')
  await page.locator('.r31-emails-apply').last().click({ timeout: 20000 })
  const auditTable = page.locator('.r34-audit-table')
  await auditTable.waitFor({ timeout: 20000 })
  const auditText = await auditTable.textContent()
  if (!auditText?.includes('Correo reintentado')) throw new Error('la auditoría no muestra la entrada del reintento')
  console.log('[r34] auditoría:', auditText?.replace(/\s+/g, ' ').trim()?.slice(0, 160))
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-auditoria-reintentos.png`, fullPage: false })
  console.log('[r34] captura 03-auditoria-reintentos.png')

  // ------------------------------------------------ R34-a: conciliación MP (dev_skip en demo;
  //        en producción las filas con discrepancia muestran el botón «Reprocesar»)
  const metricsHeading = page.locator('h3:has-text("Facturación · ciclo de renovación")')
  await metricsHeading.scrollIntoViewIfNeeded()
  await metricsHeading.waitFor({ timeout: 20000 })
  await page.locator('.r33-reconcile-btn').click({ timeout: 20000 })
  const reconcileResult = page.locator('.r33-reconcile-result')
  await reconcileResult.waitFor({ timeout: 30000 })
  const reconcileText = await reconcileResult.textContent()
  console.log('[r34] conciliación:', reconcileText?.replace(/\s+/g, ' ').trim())
  if (!reconcileText?.includes('Sin token de Mercado Pago')) throw new Error('la conciliación no respondió dev_skip')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04-conciliacion-devskip.png`, fullPage: false })
  console.log('[r34] captura 04-conciliacion-devskip.png')

  if (errors.length > 0) {
    console.error('[r34] pageerror:', errors)
    process.exitCode = 1
  }

  // Limpieza: dejar la BD demo sin residuos de la evidencia
  await prisma.emailLog.deleteMany({ where: { userId: u!.id } })
  await prisma.auditLog.deleteMany({ where: { action: 'emails.retried', resourceId: enCola.id } })
  await browser.close()
  console.log('[r34] evidencia completa ✔')
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
