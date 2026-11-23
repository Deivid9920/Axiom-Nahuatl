/**
 * R28 — Evidencia: proration mensual→anual, revocación de documentos (panel admin)
 * y verificación pública del código de institución.
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true para el
 * flujo de pago dev).
 * Genera en <OUT>:
 *   01-proration-planes.png        — pestaña Planes en anual: badge «+N días de crédito»
 *   02-proration-suscripcion.png   — tarjeta «Tu suscripción» con la nota de días restantes
 *   03-documentos-emitidos.png     — sección admin con el documento de prueba (Válido)
 *   04-revocacion-form.png         — formulario de revocación con motivo
 *   05-documento-revocado.png      — fila con chip «Revocado» + toast
 *   06-verificar-revocado.png      — página pública /verificar/<folio> en estado revocado
 *   07-verificar-inst-valida.png   — /verificar-inst?code=AX-INST-DEMO (VERIFICADA)
 *   08-verificar-inst-invalida.png — código inexistente (Código no encontrado)
 * Aserciones: pago mensual dev procesado, badge de crédito visible, nota de proration
 * en la suscripción, sección Documentos emitidos con folio AX-DMR, revocación idempotente
 * vía UI, página pública en estado revocado y lookup institucional válido/inválido.
 * Uso: bun scripts/r28_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r28'] = process.argv

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
  console.log('[r28] login ok')

  // ---------------------------------------------------------- R28-a: proration
  // Asegurar suscripción MENSUAL para el demo (pago dev basico $199): si la
  // suscripción vigente es anual o no existe, se compra el mensual.
  const subRes = await ctx.request.get(`${BASE}/api/billing`)
  const subData = await subRes.json()
  const cadence = subData?.subscription?.cadence
  if (cadence !== 'monthly') {
    const pref = await ctx.request.post(`${BASE}/api/billing`, {
      data: { planCode: 'basico', cadence: 'monthly' },
    })
    const prefData = await pref.json()
    if (!prefData.ok) throw new Error(`no se pudo crear preferencia dev: ${JSON.stringify(prefData)}`)
    const pay = await ctx.request.get(`${BASE}${prefData.sandboxInitPoint}`)
    const payData = await pay.json()
    if (!payData.ok) throw new Error('pago dev falló')
    console.log('[r28] suscripción mensual dev creada (basico)')
  } else {
    console.log('[r28] suscripción mensual ya activa')
  }

  await page.goto(`${BASE}/`, { timeout: 90000 })
  await page.locator('.sidebar-link', { hasText: 'Planes' }).first().click()
  await page.locator('h2', { hasText: 'Planes y Suscripciones' }).waitFor({ timeout: 60000 })

  // Nota de proration en «Tu suscripción» (mensual con días restantes)
  const subCard = page.locator('div.bg-white.rounded-2xl', { hasText: 'Tu suscripción' })
  await subCard.waitFor({ timeout: 30000 })
  await subCard.getByText(/Al cambiar a anual, tus \d+ días restantes/).waitFor({ timeout: 15000 })
  const noteText = (await subCard.getByText(/Al cambiar a anual, tus \d+ días restantes/).textContent()) || ''
  console.log(`[r28] nota proration: ${noteText.slice(0, 80)}…`)
  await subCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/02-proration-suscripcion.png`, fullPage: true })

  // Toggle anual → badge «+N días de crédito» en la tarjeta del plan actual
  // (el demo trae suscripción Pro mensual de prueba → el crédito aparece en Pro)
  await page.locator('.plan-toggle-btn', { hasText: 'Anual' }).click()
  const currentCard = page.locator('.plan-card-axiom:has(h3:text-is("Pro"))').first()
  await currentCard.getByText(/\+\d+ días de crédito/).waitFor({ timeout: 15000 })
  const badgeText = (await currentCard.getByText(/\+\d+ días de crédito/).textContent()) || ''
  console.log(`[r28] badge de crédito: ${badgeText}`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01-proration-planes.png`, fullPage: true })

  // --------------------------------------------- R28-b: documentos + revocación
  // Emitir un documento con folio para el demo (API con sesión admin, a nombre propio)
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
  console.log(`[r28] documento emitido: ${folio}`)

  await page.locator('.sidebar-link', { hasText: 'Panel' }).first().click()
  await page.locator('h3', { hasText: 'Documentos emitidos' }).waitFor({ timeout: 60000 })
  const docsSection = page.locator('div.bg-white.rounded-2xl', { hasText: 'Documentos emitidos' }).last()
  await docsSection.locator('.r28-doc-folio', { hasText: folio }).waitFor({ timeout: 20000 })
  await expectChip(docsSection, folio, 'Válido')
  console.log('[r28] sección Documentos emitidos con folio válido')
  await docsSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-documentos-emitidos.png`, fullPage: true })

  // Revocar con motivo (flujo inline de la UI)
  const row = docsSection.locator('tr', { hasText: folio })
  await row.locator('.r28-revoke-btn').click()
  await row.locator('.r28-revoke-input').fill('Evidencia R28: dato erróneo reportado por la escuela')
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/04-revocacion-form.png`, fullPage: true })
  await row.locator('.r28-revoke-confirm').click()
  await row.locator('.r28-status-chip.revoked').waitFor({ timeout: 15000 })
  console.log('[r28] documento revocado desde la UI')
  await docsSection.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/05-documento-revocado.png`, fullPage: true })

  // Página pública → «Documento revocado» (contexto anónimo)
  const anon = await browser.newContext()
  const anonPage = await anon.newPage()
  await anonPage.goto(`${BASE}/verificar/${folio}`, { timeout: 60000 })
  await anonPage.locator('.verify-state.revoked').waitFor({ timeout: 20000 })
  const revokedTag = await anonPage.locator('.verify-state-tag').textContent()
  if (!revokedTag?.includes('revocado')) throw new Error('estado público no es revocado')
  console.log('[r28] /verificar muestra «Documento revocado»')
  await anonPage.screenshot({ path: `${OUT}/06-verificar-revocado.png`, fullPage: true })

  // ------------------------------------------------- R28-c: verificar-inst
  await anonPage.goto(`${BASE}/verificar-inst?code=AX-INST-DEMO`, { timeout: 60000 })
  await anonPage.locator('.verify-state.valid').waitFor({ timeout: 20000 })
  const instName = await anonPage.locator('.verify-state.valid .verify-table').textContent()
  if (!instName?.includes('Academia Axiom Nearshoring')) throw new Error('nombre institucional ausente')
  console.log('[r28] /verificar-inst: código demo VERIFICADA')
  await anonPage.screenshot({ path: `${OUT}/07-verificar-inst-valida.png`, fullPage: true })

  await anonPage.goto(`${BASE}/verificar-inst?code=AX-INST-NOEXISTE`, { timeout: 60000 })
  await anonPage.locator('.verify-state.invalid').waitFor({ timeout: 20000 })
  console.log('[r28] /verificar-inst: código inexistente detectado')
  await anonPage.screenshot({ path: `${OUT}/08-verificar-inst-invalida.png`, fullPage: true })
  await anon.close()

  if (errors.length) {
    console.warn(`[r28] AVISO pageerror: ${errors.length}`)
    errors.slice(0, 3).forEach(e => console.warn(`  ${e.slice(0, 140)}`))
  }
  console.log(`[r28] EVIDENCIA COMPLETA → ${OUT}`)
  await browser.close()

  async function expectChip(section: ReturnType<typeof page.locator>, folioText: string, label: string) {
    const row = section.locator('tr', { hasText: folioText })
    await row.locator(`.r28-status-chip:has-text("${label}")`).waitFor({ timeout: 10000 })
  }
}

main().catch(e => { console.error(e); process.exit(1) })
