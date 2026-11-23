/**
 * R27 — Evidencia de la fase 2 del documento formal (folio en BD + QR + verificación pública).
 * Requiere dev server del proyecto en :3000.
 * Genera en <OUT>:
 *   01-reporte-con-qr.png    — documento formal en media print con QR y folio de BD
 *   02-verificacion-valida.png — página pública /verificar/<folio> (Documento válido)
 *   03-verificacion-inexistente.png — folio inexistente (Sin registro)
 *   reporte-formal-qr.pdf    — PDF A4 con QR embebido
 * Aserciones: folio de BD (no el determinista), línea de verificación, QR renderizado,
 * API pública con integridad ok, página pública válida y estado «Sin registro».
 * Uso: bun scripts/r27_evidence.ts <BASE> <OUT> <PREFIX> [INSTITUCION]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r27', PREFIX = 'AX-DMR', INSTITUTION = 'Universidad Nacional de México · Coordinación de Lenguas'] = process.argv
const AUTH_FILE = 'tests/e2e/.auth/demo-state.json'
// Folio de BD: AX-DMR-2026-K7M3XQ (año de 4 dígitos + 6 base32). El determinista de
// R23 lleva la fecha completa (8 dígitos), así que este regex distingue ambos.
const FOLIO_RE = new RegExp(`^${PREFIX}-\\d{4}-[A-HJ-KM-NP-Z2-9]{6}$`)

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
    fs.mkdirSync('tests/e2e/.auth', { recursive: true })
    await ctx.storageState({ path: AUTH_FILE })
  }
  console.log('[r27] login ok')

  // Panel de administración → reporte del demo admin (auto-emisión a su propio nombre)
  await page.locator('.sidebar-link', { hasText: 'Panel' }).first().click()
  await page.locator('input[placeholder*="Buscar por nombre o correo"]').waitFor({ timeout: 60000 })
  await page.fill('input[placeholder*="Buscar por nombre o correo"]', 'admin')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('button', { name: 'Ver estadísticas' }).first().click({ timeout: 30000 })
  await page.locator('h2', { hasText: 'Reporte de avance' }).waitFor({ timeout: 60000 })

  await page.fill('input[placeholder*="Institución o programa"]', INSTITUTION)
  // La emision ocurre al montar el documento; el QR aparece tras compilar la ruta en
  // dev. El .axdoc es sólo impresión (oculto en pantalla) → state 'attached'.
  await page.locator('.axdoc-qr img').waitFor({ state: 'attached', timeout: 45000 })
  console.log('[r27] QR renderizado')

  const folioText = (await page.locator('.axdoc-folio').textContent()) || ''
  const folio = folioText.replace('Folio de control', '').trim()
  if (!FOLIO_RE.test(folio)) {
    throw new Error(`folio de BD ausente: «${folio}» no cumple ${FOLIO_RE}`)
  }
  const verifyLine = (await page.locator('.axdoc-verify').textContent()) || ''
  if (!verifyLine.includes(`/verificar/${folio}`)) throw new Error('línea de verificación ausente en el documento')
  console.log(`[r27] folio de BD: ${folio}`)

  // Documento formal en media print + PDF con QR
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/01-reporte-con-qr.png`, fullPage: true })
  await page.pdf({ path: `${OUT}/reporte-formal-qr.pdf`, preferCSSPageSize: true, printBackground: true })
  await page.emulateMedia({ media: null })

  // API pública de verificación (sin sesión: nueva request context)
  const anon = await browser.newContext()
  const apiRes = await anon.request.get(`${BASE}/api/verify/${folio}`)
  const apiData = await apiRes.json()
  console.log('[r27] api', JSON.stringify(apiData))
  if (!apiData.found || apiData.integrity !== 'ok' || apiData.revoked) {
    throw new Error('la verificación de la API no es válida/encontrada')
  }

  // Página pública: documento válido
  const vpage = await anon.newPage()
  await vpage.goto(`${BASE}/verificar/${folio}`, { timeout: 60000 })
  await vpage.locator('.verify-state.valid').waitFor({ timeout: 30000 })
  await vpage.locator('.verify-folio').filter({ hasText: folio }).waitFor({ timeout: 10000 })
  await vpage.screenshot({ path: `${OUT}/02-verificacion-valida.png`, fullPage: true })
  console.log('[r27] página pública: Documento válido')

  // Página pública: folio inexistente
  await vpage.goto(`${BASE}/verificar/${PREFIX}-1999-NOPE00`, { timeout: 60000 })
  await vpage.locator('.verify-state.invalid').waitFor({ timeout: 30000 })
  await vpage.screenshot({ path: `${OUT}/03-verificacion-inexistente.png`, fullPage: true })
  console.log('[r27] página pública: Sin registro para folio inexistente')

  await anon.close()
  await browser.close()
  if (errors.length) throw new Error(`errores de consola: ${errors.join(' | ')}`)
  console.log(`[r27] OK -> ${OUT}`)
}

main().catch(e => { console.error('[r27] FALLO', e); process.exit(1) })
