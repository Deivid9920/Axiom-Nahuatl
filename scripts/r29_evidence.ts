/**
 * R29 — Evidencia: renovación anual desde el fin del periodo vigente (R29-a),
 * reversión de revocaciones (R29-b) y recordatorios de vencimiento + renovación
 * automática (R29-c).
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true).
 * Genera en <OUT>:
 *   01-aviso-vencimiento.png      — franja warning «se renovará automáticamente» (5 días)
 *   02-autorenew-activa.png       — «Tu suscripción» con la renovación automática Activa
 *   03-autorenew-inactiva.png     — tras el toggle: mensaje manual + switch Inactiva
 *   04-renovacion-anual.png       — «Tu suscripción» anual: Renueva ≈ +2 años (extensión)
 *   05-documento-revocado.png     — fila del documento con chip «Revocado»
 *   06-verificar-revocado.png     — /verificar/<folio> en estado revocado
 *   07-restaurar-confirmar.png    — flujo «Restaurar» con confirmación inline
 *   08-documento-restaurado.png   — chip «Válido» tras restaurar
 *   09-verificar-restaurado.png   — /verificar/<folio> de nuevo «Documento válido»
 * Aserciones: banner warning con renovación automática, toggle autoRenew persistido,
 * segunda renovación anual EXTIENDE el periodo (fin ≈ antiguo fin + 365, sin fila nueva),
 * revocación → verificación pública revocada → restauración → verificación pública válida.
 * Uso: env -u DATABASE_URL bun scripts/r29_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r29'] = process.argv

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('db', 'custom.db')}` } },
})

const DAY = 24 * 60 * 60 * 1000

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
    await page.click('button[type="submit"]')
    await hello.waitFor({ timeout: 60000 })
  }
  console.log('[r29] login ok')

  // ------------------------------------------------ R29-c: aviso + autoRenew
  // Suscripción mensual activa (pago dev basico) y periodo a 5 días (nivel warning)
  const subRes = await ctx.request.get(`${BASE}/api/billing`)
  const subData = await subRes.json()
  const cadence: string | undefined = subData?.subscription?.cadence
  if (cadence !== 'monthly') {
    const pref = await ctx.request.post(`${BASE}/api/billing`, { data: { planCode: 'basico', cadence: 'monthly' } })
    const prefData = await pref.json()
    if (!prefData.ok) throw new Error(`no se pudo crear preferencia dev: ${JSON.stringify(prefData)}`)
    const pay = await ctx.request.get(`${BASE}${prefData.sandboxInitPoint}`)
    if (!(await pay.json()).ok) throw new Error('pago dev falló')
    console.log('[r29] suscripción mensual dev creada (basico)')
  } else {
    console.log('[r29] suscripción mensual ya activa')
  }

  const demo = await prisma.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (!demo) throw new Error('demo ausente')
  const sub = await prisma.subscription.findFirst({
    where: { userId: demo.id, status: { in: ['active', 'trialing'] } },
    orderBy: { createdAt: 'desc' },
  })
  if (!sub) throw new Error('suscripción demo ausente')
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { currentPeriodEnd: new Date(Date.now() + 5 * DAY), autoRenew: true },
  })
  console.log('[r29] periodo movido a +5 días con autoRenew activa')

  await page.goto(`${BASE}/`, { timeout: 90000 })
  await page.locator('.sidebar-link', { hasText: 'Planes' }).first().click()
  await page.locator('h2', { hasText: 'Planes y Suscripciones' }).waitFor({ timeout: 60000 })

  const banner = page.locator('.r29-renewal-banner.warning')
  await banner.waitFor({ timeout: 20000 })
  await banner.getByText(/renovará automáticamente/).waitFor({ timeout: 10000 })
  console.log('[r29] franja warning con renovación automática visible')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01-aviso-vencimiento.png`, fullPage: true })

  const subCard = page.locator('div.bg-white.rounded-2xl', { hasText: 'Tu suscripción' })
  await subCard.waitFor({ timeout: 30000 })
  const sw = subCard.locator('button[role="switch"]')
  await subCard.getByText('Renovación automática').waitFor({ timeout: 10000 })
  await subCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/02-autorenew-activa.png`, fullPage: true })

  // Toggle a inactiva: la franja pasa a mensaje manual y el switch a «Inactiva»
  await sw.click()
  await expectAttr(sw, 'aria-checked', 'false')
  await banner.getByText(/vence en 5 días/).waitFor({ timeout: 15000 })
  await subCard.getByText('Desactivada: te avisaremos antes del vencimiento').waitFor({ timeout: 10000 })
  console.log('[r29] toggle autoRenew → inactiva (mensaje manual en la franja)')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-autorenew-inactiva.png`, fullPage: true })

  // Reactivar (estado por defecto) y dejar el periodo mensual a 30 días
  await sw.click()
  await expectAttr(sw, 'aria-checked', 'true')
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { currentPeriodEnd: new Date(Date.now() + 30 * DAY), autoRenew: true },
  })

  // --------------------------------------- R29-a: renovación anual extendida
  // 1ª compra anual Pro: como la suscripción vigente es mensual de otro plan,
  // crea suscripción nueva (hoy + 365 + días de proration del ciclo mensual).
  const payAnnual = async () => {
    const pref = await ctx.request.post(`${BASE}/api/billing`, { data: { planCode: 'pro', cadence: 'annual' } })
    const prefData = await pref.json()
    if (!prefData.ok) throw new Error(`preferencia anual falló: ${JSON.stringify(prefData)}`)
    const pay = await ctx.request.get(`${BASE}${prefData.sandboxInitPoint}`)
    if (!(await pay.json()).ok) throw new Error('pago anual dev falló')
  }
  await payAnnual()
  const afterFirst = await ctx.request.get(`${BASE}/api/billing`)
  const firstData = await afterFirst.json()
  const end1 = new Date(firstData.subscription.currentPeriodEnd)
  console.log(`[r29] 1ª compra anual: fin = ${end1.toISOString().slice(0, 10)} (cadence ${firstData.subscription.cadence})`)

  // 2ª compra anual del MISMO plan: R29-a EXTIENDE desde el fin vigente (sin fila nueva)
  const subsBefore = await prisma.subscription.count({ where: { userId: demo.id, status: 'active' } })
  await payAnnual()
  const afterSecond = await ctx.request.get(`${BASE}/api/billing`)
  const secondData = await afterSecond.json()
  const end2 = new Date(secondData.subscription.currentPeriodEnd)
  const subsAfter = await prisma.subscription.count({ where: { userId: demo.id, status: 'active' } })
  const expectedEnd = new Date(end1.getTime() + 365 * DAY)
  const driftDays = Math.abs(end2.getTime() - expectedEnd.getTime()) / DAY
  if (driftDays > 1) throw new Error(`renovación no extendió: fin2=${end2.toISOString()} esperado≈${expectedEnd.toISOString()}`)
  if (subsAfter !== subsBefore) throw new Error(`la renovación duplicó filas: ${subsBefore} → ${subsAfter}`)
  console.log(`[r29] 2ª compra anual EXTENDIÓ: fin = ${end2.toISOString().slice(0, 10)} (≈ fin anterior + 365; filas activas ${subsAfter})`)

  await page.goto(`${BASE}/`, { timeout: 90000 })
  await page.locator('.sidebar-link', { hasText: 'Planes' }).first().click()
  const subCard2 = page.locator('div.bg-white.rounded-2xl', { hasText: 'Tu suscripción' })
  await subCard2.waitFor({ timeout: 30000 })
  await subCard2.getByText(/Si renuevas tu plan anual antes de que termine/).waitFor({ timeout: 15000 })
  await subCard2.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04-renovacion-anual.png`, fullPage: true })

  // ------------------------------------------------ R29-b: revocar + restaurar
  const meRes = await ctx.request.get(`${BASE}/api/auth`)
  const meData = await meRes.json()
  const myId: string = meData?.user?.id || meData?.id
  if (!myId) throw new Error('no se pudo resolver el id del demo')
  const issueRes = await ctx.request.post(`${BASE}/api/issued-docs/issue`, {
    data: {
      userId: myId,
      holderName: 'Docente Demo Axiom',
      holderEmail: 'admin@axiom.mx',
      windowDays: 30,
      snapshot: { windowDays: 30, cefrCurrent: 'B1', sessionsCount: 8, totalActiveMinutes: 176 },
    },
  })
  const issueData = await issueRes.json()
  if (!issueData.ok) throw new Error(`emisión falló: ${JSON.stringify(issueData)}`)
  const folio: string = issueData.folio
  console.log(`[r29] documento emitido: ${folio}`)

  await page.locator('.sidebar-link', { hasText: 'Panel' }).first().click()
  await page.locator('h3', { hasText: 'Documentos emitidos' }).waitFor({ timeout: 60000 })
  const docsSection = page.locator('div.bg-white.rounded-2xl', { hasText: 'Documentos emitidos' }).last()
  await docsSection.locator('.r28-doc-folio', { hasText: folio }).waitFor({ timeout: 20000 })

  // Revocar vía UI
  const row = docsSection.locator('tr', { hasText: folio })
  await row.locator('.r28-revoke-btn').click()
  await row.locator('.r28-revoke-input').fill('Evidencia R29: verificación de la reversión')
  await row.locator('.r28-revoke-confirm').click()
  await row.locator('.r28-status-chip.revoked').waitFor({ timeout: 15000 })
  console.log('[r29] documento revocado desde la UI')
  await docsSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/05-documento-revocado.png`, fullPage: true })

  // Página pública → revocado (contexto anónimo)
  const anon = await browser.newContext()
  const anonPage = await anon.newPage()
  await anonPage.goto(`${BASE}/verificar/${folio}`, { timeout: 60000 })
  await anonPage.locator('.verify-state.revoked').waitFor({ timeout: 20000 })
  console.log('[r29] /verificar muestra «Documento revocado»')
  await anonPage.screenshot({ path: `${OUT}/06-verificar-revocado.png`, fullPage: true })
  await anon.close()

  // Restaurar vía UI (R29-b): botón «Restaurar» + confirmación inline
  await row.locator('.r29-restore-btn').click()
  await row.locator('button:has-text("Confirmar restauración")').waitFor({ timeout: 10000 })
  await docsSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/07-restaurar-confirmar.png`, fullPage: true })
  await row.locator('button:has-text("Confirmar restauración")').click()
  await row.locator('.r28-status-chip.valid').waitFor({ timeout: 15000 })
  console.log('[r29] documento restaurado desde la UI (chip Válido)')
  await docsSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/08-documento-restaurado.png`, fullPage: true })

  // Página pública → Documento válido otra vez
  const anon2 = await browser.newContext()
  const anon2Page = await anon2.newPage()
  await anon2Page.goto(`${BASE}/verificar/${folio}`, { timeout: 60000 })
  await anon2Page.locator('.verify-state.valid').waitFor({ timeout: 20000 })
  console.log('[r29] /verificar vuelve a «Documento válido»')
  await anon2Page.screenshot({ path: `${OUT}/09-verificar-restaurado.png`, fullPage: true })
  await anon2.close()

  if (errors.length) {
    console.warn(`[r29] AVISO pageerror: ${errors.length}`)
    errors.slice(0, 3).forEach(e => console.warn(`  ${e.slice(0, 140)}`))
  }
  console.log(`[r29] EVIDENCIA COMPLETA → ${OUT}`)
  await browser.close()
  await prisma.$disconnect()

  async function expectAttr(locator: ReturnType<typeof page.locator>, attr: string, value: string) {
    await locator.waitFor({ timeout: 10000 })
    // Poll: el switch deriva del prop subscription, que se refresca tras loadProfile()
    for (let i = 0; i < 48; i++) {
      const actual = await locator.getAttribute(attr)
      if (actual === value) return
      await new Promise(r => setTimeout(r, 250))
    }
    const final = await locator.getAttribute(attr)
    throw new Error(`atributo ${attr}=${final}, esperado ${value}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
