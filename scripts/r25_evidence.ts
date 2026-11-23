// R25 — evidencia visual del panel de coordinación
// Ejecutar:  bun scripts/r25_evidence.ts   (dev server en :3000, BD con seed R25)
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const OUT = '/home/z/my-project/download/evidencia-r25'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.goto('http://localhost:3000', { timeout: 60000 })
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]')
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  console.log('✓ login demo')

  // Abrir el panel por el sidebar (expandir si está colapsado)
  const toggle = page.locator('.sidebar-toggle, button[aria-label*="sidebar" i], button[aria-label*="menú" i]').first()
  if (await toggle.isVisible().catch(() => false)) await toggle.click().catch(() => {})
  await page.locator('button:has-text("Grupos")').first().click({ timeout: 15000 })
  await page.locator('h2:has-text("Coordinación")').waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)

  // 1. Panel completo con grupo demo
  await expect2(page, 'text=B1 · Inglés para Nearshoring')
  await expect2(page, 'text=Academia Axiom Nearshoring')
  const rows = await page.locator('.r25-member-row').count()
  if (rows !== 3) throw new Error(`❌ filas de miembros=${rows} (esperadas 3)`)
  await expect2(page, 'text=MAESTRO')
  console.log(`✓ grupo demo con ${rows} miembros (maestro + 2 alumnos)`)

  await page.screenshot({ path: `${OUT}/01-panel-coordinacion.png`, fullPage: true })

  // 2. Formulario de crear grupo abierto
  await page.locator('button:has-text("Crear grupo")').first().click()
  await page.locator('input[placeholder*="Nombre del grupo"]').waitFor({ timeout: 5000 })
  await page.screenshot({ path: `${OUT}/02-crear-grupo.png` })
  await page.locator('button:has-text("Cancelar")').first().click()

  // 3. Formulario de agregar miembro abierto
  const card = page.locator('.axiom-card', { hasText: 'B1 · Inglés para Nearshoring' })
  await card.locator('button:has-text("Agregar miembro")').click()
  await card.locator('input[type="email"]').waitFor({ timeout: 5000 })
  await card.locator('input[type="email"]').fill('alumno3@axiom.mx')
  await page.screenshot({ path: `${OUT}/03-agregar-miembro.png` })
  await card.locator('button:has-text("Agregar")').last().click()
  await page.waitForTimeout(4000) // primera compilación on-demand de la ruta API en dev
  const rowsAfter = await page.locator('.r25-member-row').count()
  if (rowsAfter !== 4) throw new Error(`❌ miembros tras agregar=${rowsAfter} (esperadas 4)`)
  console.log('✓ alumno3 agregado al grupo demo (4 miembros)')

  // 4. Panel con el miembro nuevo
  await page.screenshot({ path: `${OUT}/04-miembro-agregado.png`, fullPage: true })

  // devolver el demo a su estado canónico (remover alumno3 del grupo demo)
  const row = page.locator('.r25-member-row', { hasText: 'Diego Alumno' })
  await row.locator('button[aria-label="Remover del grupo"]').click()
  await page.waitForTimeout(2500)
  console.log('✓ demo restaurada (alumno3 removido)')

  if (errors.length) throw new Error(`❌ errores de consola: ${errors.join(' | ')}`)
  console.log('✓ consola sin errores')
  await browser.close()
  console.log('\n✅ R25 evidencia visual OK → ' + OUT)
}

async function expect2(page: any, selector: string) {
  const visible = await page.locator(selector).first().isVisible()
  if (!visible) throw new Error(`❌ no visible: ${selector}`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
