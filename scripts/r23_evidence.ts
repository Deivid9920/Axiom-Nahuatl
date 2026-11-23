/**
 * R23 — Evidencia del documento formal de desempeño (v7 inglés y náhuatl).
 * Requiere dev server del proyecto en :3000.
 * Genera en <OUT>:
 *   01-panel.png             — panel admin con buscador
 *   02-reporte-pantalla.png  — vista en pantalla del reporte (sin cambios visuales)
 *   03-documento-formal.png  — documento formal (media print, página completa)
 *   reporte-formal.pdf       — PDF real A4 vertical (preferCSSPageSize)
 * Aserciones: data-print-report activo, data-cert-open inactivo, @page portrait
 * inyectado, .axdoc visible en impresión, print-area oculta, 6 secciones, folio.
 * Uso: bun scripts/r23_evidence.ts <BASE> <OUT> [INSTITUCION]
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r23', INSTITUTION = 'Universidad Nacional de México · Coordinación de Lenguas'] = process.argv
const AUTH_FILE = 'tests/e2e/.auth/demo-state.json'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })

  await page.goto(`${BASE}/`, { timeout: 90000 })
  const hello = page.locator('.axiom-hello')
  try {
    await hello.waitFor({ timeout: 10000 })
  } catch {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await hello.waitFor({ timeout: 60000 })
    fs.mkdirSync('tests/e2e/.auth', { recursive: true })
    await ctx.storageState({ path: AUTH_FILE })
  }

  // Panel de administración
  await page.locator('.sidebar-link', { hasText: 'Panel' }).first().click()
  await page.locator('input[placeholder*="Buscar por nombre o correo"]').waitFor({ timeout: 60000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/01-panel.png` })

  // Buscar y abrir el reporte del demo admin
  await page.fill('input[placeholder*="Buscar por nombre o correo"]', 'admin')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await page.getByRole('button', { name: 'Ver estadísticas' }).first().click({ timeout: 30000 })
  await page.locator('h2', { hasText: 'Reporte de avance' }).waitFor({ timeout: 60000 })

  // Institución opcional del membrete
  await page.fill('input[placeholder*="Institución o programa"]', INSTITUTION)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/02-reporte-pantalla.png`, fullPage: true })

  // Aserciones del modo impresión por documento
  const flags = await page.evaluate(() => ({
    printReport: document.body.getAttribute('data-print-report'),
    certOpen: document.body.getAttribute('data-cert-open'),
    printPage: document.getElementById('ax-print-page')?.textContent || null,
  }))
  console.log('[r23] flags', JSON.stringify(flags))
  if (flags.printReport !== '1') throw new Error('data-print-report no activo en la vista de reporte')
  if (flags.certOpen === '1') throw new Error('data-cert-open no debe estar activo fuera de la constancia')
  if (!String(flags.printPage).includes('portrait')) throw new Error('@page portrait no fijado')

  // Documento formal en media print
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-documento-formal.png`, fullPage: true })
  const doc = await page.evaluate(() => {
    const axdoc = document.querySelector('.axdoc')
    const area = document.querySelector('.print-area')
    return {
      axdocVisible: !!axdoc && getComputedStyle(axdoc).display !== 'none',
      printAreaHidden: !area || getComputedStyle(area).display === 'none',
      title: axdoc?.querySelector('.axdoc-title')?.textContent || null,
      folio: axdoc?.querySelector('.axdoc-folio')?.textContent || null,
      institution: axdoc?.querySelector('.axdoc-subject')?.textContent || null,
      sections: axdoc ? axdoc.querySelectorAll('.axdoc-sec').length : 0,
      signs: axdoc ? axdoc.querySelectorAll('.axdoc-sign').length : 0,
    }
  })
  console.log('[r23] doc', JSON.stringify(doc))
  if (!doc.axdocVisible || !doc.printAreaHidden) throw new Error('el documento formal no toma el control de la impresión')
  if ((doc.sections ?? 0) < 6) throw new Error('faltan secciones del documento formal')
  if (!String(doc.folio).includes('AX-DMR-')) throw new Error('folio de control ausente')
  if (!String(doc.institution).includes(INSTITUTION.split('·')[0].trim().slice(0, 10))) throw new Error('membrete institucional ausente')

  // PDF real — A4 vertical vía el @page inyectado (reemplaza el landscape global)
  await page.pdf({ path: `${OUT}/reporte-formal.pdf`, preferCSSPageSize: true, printBackground: true })
  await page.emulateMedia({ media: null })
  await browser.close()
  console.log(`[r23] OK -> ${OUT}`)
}

main().catch(e => { console.error('[r23] FALLO', e); process.exit(1) })
