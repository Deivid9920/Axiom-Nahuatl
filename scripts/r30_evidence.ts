/**
 * R30 — Evidencia: cobro automático efectivo de la renovación (R30-a),
 * avisos de vencimiento por correo (R30-b) y renovación mensual con ancla
 * al fin de periodo (R30-c, nota visible en «Tu suscripción» + FAQ).
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true y CRON_SECRET).
 * Genera en <OUT>:
 *   01-franja-critical.png          — franja critical «se renovará automáticamente» (3 días)
 *   02-faq-cobro-falla.png          — FAQ «¿Y si el cobro de la renovación falla?» abierta
 *   03-nota-renovacion-mensual.png  — «Tu suscripción» con la nota de renovación mensual R30-c
 *   04-renovacion-automatica.png    — tras el ciclo: pago procesado, «Renueva» ≈ +30 días
 * Aserciones: franja critical con autoRenew, ciclo cobra la suscripción vencida
 * (payment succeeded + recibo en EmailLog), periodo extendido ≈ +30 días desde el cobro.
 * Uso: env -u DATABASE_URL bun scripts/r30_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r30'] = process.argv

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('db', 'custom.db')}` } },
})

const DAY = 24 * 60 * 60 * 1000

// CRON_SECRET del .env del proyecto (el script no carga .env automáticamente)
const cronSecret = fs.readFileSync('.env', 'utf8').match(/CRON_SECRET=(\S+)/)?.[1] ?? ''

async function main() {
  if (!cronSecret) throw new Error('CRON_SECRET ausente en .env')
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
    await page.click('button[type="submit"]')
    await hello.waitFor({ timeout: 60000 })
  }
  console.log('[r30] login ok')

  // ------------------------------------------------ estado demo: suscripción a 3 días
  const demo = await prisma.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (!demo) throw new Error('demo ausente')
  const sub = await prisma.subscription.findFirst({
    where: { userId: demo.id, status: { in: ['active', 'trialing'] } },
    orderBy: { createdAt: 'desc' },
  })
  if (!sub) throw new Error('suscripción demo ausente')
  console.log('[r30] suscripción demo:', sub.cadence, 'fin', sub.currentPeriodEnd.toISOString())

  // — a 3 días del vencimiento (nivel critical) con autoRenew activa
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'active', autoRenew: true, currentPeriodEnd: new Date(Date.now() + 3 * DAY) },
  })

  await page.goto(`${BASE}/`, { timeout: 90000 })
  await page.locator('button:has-text("Planes")').first().click()
  const banner = page.locator('.r29-renewal-banner.critical')
  await expectVisible(banner, 'franja critical')
  await expectText(banner, 'renueva automáticamente', 'franja critical con autoRenew')
  await banner.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '01-franja-critical.png') })
  console.log('[r30] captura 01 ok')

  // — FAQ R30 «¿Y si el cobro de la renovación falla?»
  await page.locator('button:has-text("¿Y si el cobro de la renovación falla?")').click()
  const faqAnswer = page.locator('p:has-text("pasa a estado «pago pendiente»")')
  await expectVisible(faqAnswer, 'respuesta FAQ R30')
  await faqAnswer.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '02-faq-cobro-falla.png') })
  console.log('[r30] captura 02 ok')

  // — nota de renovación mensual R30-c en «Tu suscripción»
  const note = page.locator('p:has-text("Si renuevas tu plan mensual antes de que termine tu ciclo")')
  await expectVisible(note, 'nota R30-c')
  await note.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '03-nota-renovacion-mensual.png') })
  console.log('[r30] captura 03 ok')

  // ------------------------------------------------ R30-a: el ciclo cobra la renovación
  // — vencer la suscripción (ayer) y correr el ciclo con el secreto del cron
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { currentPeriodEnd: new Date(Date.now() - 1 * DAY) },
  })
  const cycle = await ctx.request.post(`${BASE}/api/billing/cron/renewals`, {
    headers: { 'x-cron-secret': cronSecret },
    data: {},
  })
  const cycleData = await cycle.json()
  if (!cycle.ok || !cycleData.ok) throw new Error(`ciclo falló: ${cycle.status()} ${JSON.stringify(cycleData)}`)
  console.log('[r30] ciclo:', JSON.stringify(cycleData))
  if (cycleData.charged < 1) throw new Error('el ciclo no cobró ninguna renovación')

  // — recibo en EmailLog (R30-b) y pago succeeded
  const receipt = await prisma.emailLog.findFirst({
    where: { userId: demo.id, kind: 'renewal_receipt' },
    orderBy: { createdAt: 'desc' },
  })
  if (!receipt) throw new Error('recibo de renovación ausente en EmailLog')
  const payment = await prisma.payment.findFirst({
    where: { userId: demo.id, status: 'succeeded' },
    orderBy: { createdAt: 'desc' },
  })
  if (!payment) throw new Error('pago de renovación ausente')
  console.log('[r30] recibo:', receipt.subject, '· pago:', payment.amountMxnCents, 'centavos')

  // — «Tu suscripción» con la fecha renovada ≈ +30 días (suscripción mensual)
  const renewed = await prisma.subscription.findUnique({ where: { id: sub.id } })
  const drift = Math.abs(renewed!.currentPeriodEnd.getTime() - (Date.now() + 30 * DAY))
  if (drift > 60_000) throw new Error(`periodo no extendido: fin ${renewed!.currentPeriodEnd.toISOString()}`)
  await page.reload({ timeout: 90000 })
  await page.locator('button:has-text("Planes")').first().click()
  const subCard = page.locator('div.bg-white', { hasText: 'Tu suscripción' }).first()
  await expectVisible(subCard, 'tarjeta Tu suscripción')
  const renovates = await subCard.locator('div:has(> div:text("Renueva"))').first().textContent()
  console.log('[r30] tarjeta Renueva:', renovates?.trim())
  await subCard.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '04-renovacion-automatica.png') })
  console.log('[r30] captura 04 ok')

  if (errors.length) throw new Error(`pageerror: ${errors.join(' | ')}`)
  await browser.close()
  console.log('[r30] EVIDENCIA COMPLETA ✔')
}

async function expectVisible(locator: import('@playwright/test').Locator, label: string) {
  try {
    await locator.waitFor({ state: 'visible', timeout: 20000 })
  } catch {
    throw new Error(`no visible: ${label}`)
  }
}

async function expectText(locator: import('@playwright/test').Locator, text: string, label: string) {
  const t = await locator.textContent()
  if (!t || !t.includes(text)) throw new Error(`texto ausente (${label}): "${text}" en "${t?.slice(0, 120)}"`)
}

main()
  .catch(e => { console.error('[r30] FALLO:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
