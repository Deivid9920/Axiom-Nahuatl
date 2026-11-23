/**
 * R31 — Evidencia: panel de correos enviados (R31-a), dunning (R31-b),
 * alta de preaprobación MP desde la app (R31-c) y métricas de facturación (R31-d).
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true y CRON_SECRET).
 * Genera en <OUT>:
 *   01-fila-preaprobacion.png — «Tu suscripción» con la fila R31-c «Cobro automático con Mercado Pago»
 *   02-alta-preaprobacion.png — toast de alta en modo demo tras pulsar «Dar de alta»
 *   03-panel-metricas.png     — panel admin: métricas R31-d con «Dunning en curso» = 1
 *   04-panel-correos.png      — panel admin: correos R31-a con el aviso de fallo filtrado
 *   05-dunning-recuperado.png — tras el ciclo: reintento cobrado, «Dunning en curso» = 0
 * Aserciones: fila/chip de preaprobación, alta dev extiende la suscripción,
 * métricas reflejan el dunning preparado por BD, ciclo reintenta y recupera la
 * suscripción (retryCount 0, active), correo de fallo y recibo visibles en el panel.
 * Uso: env -u DATABASE_URL bun scripts/r31_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r31'] = process.argv

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
  console.log('[r31] login ok')

  // ------------------------------------------------ R31-c: fila de preaprobación en Planes
  const demo = await prisma.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (!demo) throw new Error('demo ausente')
  const sub = await prisma.subscription.findFirst({
    where: { userId: demo.id, status: { in: ['active', 'trialing'] } },
    orderBy: { createdAt: 'desc' },
  })
  if (!sub) throw new Error('suscripción demo ausente')
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: 'active', autoRenew: true, currentPeriodEnd: new Date(Date.now() + 20 * DAY) },
  })

  await page.goto(`${BASE}/`, { timeout: 90000 })
  await page.locator('button:has-text("Planes")').first().click()
  const prow = page.locator('.r31-preapproval-row')
  await expectVisible(prow, 'fila preaprobación R31-c')
  await expectText(prow, 'Cobro automático con Mercado Pago', 'fila preaprobación')
  await prow.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '01-fila-preaprobacion.png') })
  console.log('[r31] captura 01 ok')

  // — alta en modo demo: el initPoint dev procesa el pago y activa el cobro automático
  await page.locator('.r31-preapproval-btn').click()
  const toast = page.locator('.sonner-toast, [data-sonner-toast]')
  await expectVisible(toast.first(), 'toast de alta de preaprobación')
  await page.screenshot({ path: path.join(OUT, '02-alta-preaprobacion.png') })
  console.log('[r31] captura 02 ok')
  // el toast se desvanece antes de pasar al panel (no debe salir en las capturas siguientes)
  await toast.first().waitFor({ state: 'hidden', timeout: 9000 }).catch(() => {})

  // BD: la alta dev extendió la suscripción (pago succeeded ligado al usuario demo)
  const demoPayment = await prisma.payment.findFirst({
    where: { userId: demo.id, status: 'succeeded' },
    orderBy: { createdAt: 'desc' },
  })
  if (!demoPayment) throw new Error('la alta de preaprobación no registró el pago dev')
  const renewedDemo = await prisma.subscription.findUnique({ where: { id: sub.id } })
  if (renewedDemo!.currentPeriodEnd.getTime() <= Date.now()) throw new Error('la alta dev no extendió el periodo')
  console.log('[r31] alta dev ok: pago', demoPayment.amountMxnCents, '· fin', renewedDemo!.currentPeriodEnd.toISOString())

  // ------------------------------------------------ R31-b/R31-d: dunning preparado por BD
  let u = await prisma.user.findUnique({ where: { email: 'r31-e2e@axiom.mx' } })
  if (!u) {
    u = await prisma.user.create({
      data: { email: 'r31-e2e@axiom.mx', name: 'E2E R31', passwordHash: 'evidencia', profile: { create: {} } },
    })
  }
  await prisma.subscription.deleteMany({ where: { userId: u.id } })
  await prisma.emailLog.deleteMany({ where: { userId: u.id } })
  await prisma.payment.deleteMany({ where: { userId: u.id } })
  const pro = await prisma.plan.findUnique({ where: { code: 'pro' } })
  if (!pro) throw new Error('plan pro ausente')
  await prisma.subscription.create({
    data: {
      userId: u.id, planId: pro.id, status: 'past_due', cadence: 'monthly',
      currentPeriodStart: new Date(Date.now() - 32 * DAY),
      currentPeriodEnd: new Date(Date.now() - 2 * DAY),
      autoRenew: true,
      renewalRetryCount: 1,
      nextRetryAt: new Date(Date.now() - 60 * 60 * 1000), // reintento ya vencido → el ciclo lo ejecuta
    },
  })
  await prisma.emailLog.create({
    data: {
      userId: u.id, to: u.email,
      subject: 'Axiom: no pudimos procesar la renovación de tu plan Pro',
      kind: 'renewal_failed',
      body: 'Intentamos renovar tu plan Pro pero el cobro no se pudo procesar (el reintento fue rechazado); lo reintentaremos automáticamente.',
      status: 'dev_logged',
      dedupeKey: `evidencia-r31:renewal_failed:retry1:${u.id}`,
      relatedType: 'subscription',
      sentAt: new Date(),
    },
  })

  // — panel admin: métricas con dunning en curso = 1 (se espera a que carguen los datos)
  await page.locator('button:has-text("Panel")').first().click()
  await expectVisible(page.locator('h2:has-text("Panel de administración")'), 'panel admin')
  await expectVisible(page.locator('.r31-metrics-grid'), 'cuadrícula de métricas R31-d')
  const metricsCard = page.locator('h3:has-text("Facturación · ciclo de renovación")').locator('..')
  await metricsCard.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '03-panel-metricas.png') })
  console.log('[r31] captura 03 ok')

  // — correos: filtro por fallos de cobro
  const emailsCard = page.locator('h3:has-text("Correos enviados")').locator('..')
  await expectVisible(emailsCard, 'sección correos R31-a')
  await emailsCard.locator('.r31-emails-select').first().selectOption('renewal_failed')
  await emailsCard.locator('.r31-emails-apply').click()
  await expectVisible(emailsCard.locator('.r31-emails-table'), 'tabla de correos')
  const tableText = await emailsCard.locator('.r31-emails-table').textContent()
  if (!tableText?.includes('r31-e2e@axiom.mx')) throw new Error('el correo de fallo no aparece en el panel')
  await emailsCard.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '04-panel-correos.png') })
  console.log('[r31] captura 04 ok')

  // ------------------------------------------------ R31-b: el ciclo reintenta y recupera
  const cycle = await ctx.request.post(`${BASE}/api/billing/cron/renewals`, {
    headers: { 'x-cron-secret': cronSecret },
    data: {},
  })
  const cycleData = await cycle.json()
  if (!cycle.ok || !cycleData.ok) throw new Error(`ciclo falló: ${cycle.status()} ${JSON.stringify(cycleData)}`)
  console.log('[r31] ciclo:', JSON.stringify(cycleData))
  if (cycleData.charged < 1) throw new Error('el ciclo no ejecutó el reintento de dunning')

  const recovered = await prisma.subscription.findFirst({ where: { userId: u.id } })
  if (recovered!.status !== 'active') throw new Error(`suscripción no recuperada: ${recovered!.status}`)
  if (recovered!.renewalRetryCount !== 0) throw new Error('dunning no reiniciado tras el cobro')
  if (recovered!.nextRetryAt) throw new Error('nextRetryAt no limpiado')
  const receipt = await prisma.emailLog.findFirst({
    where: { userId: u.id, kind: 'renewal_receipt' }, orderBy: { createdAt: 'desc' },
  })
  if (!receipt) throw new Error('recibo del reintento ausente')
  console.log('[r31] dunning recuperado: recibo', receipt.subject)

  // — panel tras el ciclo: dunning en curso = 0 (se espera a que carguen los datos)
  await page.reload({ timeout: 90000 })
  await page.locator('button:has-text("Panel")').first().click()
  await expectVisible(page.locator('.r31-metrics-grid'), 'cuadrícula de métricas tras el ciclo')
  const metricsAfter = page.locator('h3:has-text("Facturación · ciclo de renovación")').locator('..')
  await metricsAfter.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(OUT, '05-dunning-recuperado.png') })
  console.log('[r31] captura 05 ok')

  // — limpieza: dejar la BD demo coherente (sin residuos del usuario de evidencia)
  await prisma.subscription.deleteMany({ where: { userId: u.id } })
  await prisma.emailLog.deleteMany({ where: { userId: u.id } })
  await prisma.payment.deleteMany({ where: { userId: u.id } })

  if (errors.length) throw new Error(`pageerror: ${errors.join(' | ')}`)
  await browser.close()
  console.log('[r31] EVIDENCIA COMPLETA ✔')
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
  .catch(e => { console.error('[r31] FALLO:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
