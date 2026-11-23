// R26 — evidencia visual de la fase 2 de coordinación
// (instituciones PENDING/VERIFIED, importación masiva y métricas agregadas)
// Ejecutar:  bun scripts/r26_evidence.ts   (dev server en :3000, BD con seed R25)
import { chromium, test, expect } from '@playwright/test'
import fs from 'node:fs'

const OUT = '/home/z/my-project/download/evidencia-r26'

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

  const toggle = page.locator('.sidebar-toggle, button[aria-label*="sidebar" i], button[aria-label*="menú" i]').first()
  if (await toggle.isVisible().catch(() => false)) await toggle.click().catch(() => {})
  await page.locator('button:has-text("Grupos")').first().click({ timeout: 15000 })
  await page.locator('h2:has-text("Coordinación")').waitFor({ timeout: 20000 })
  await page.waitForTimeout(800)

  // 1. Sección de instituciones con el demo VERIFIED
  const instRow = page.locator('.r26-inst-row', { hasText: 'Academia Axiom Nearshoring' })
  await expect(instRow).toBeVisible({ timeout: 10000 })
  await expect(instRow.locator('.r26-status-badge.verified')).toBeVisible()
  console.log('✓ sección de instituciones con demo VERIFIED')

  // 2. Registrar una institución nueva (queda PENDING con código visible)
  await page.locator('button:has-text("Registrar")').first().click()
  await page.locator('input[placeholder*="Nombre de la escuela"]').fill('Preparatoria Evidencia R26')
  await page.screenshot({ path: `${OUT}/01-instituciones.png` })
  await page.locator('button:has-text("Registrar institución")').click()
  const codeNote = page.locator('.r26-inst-code-note')
  await expect(codeNote).toBeVisible({ timeout: 10000 })
  const code = (await codeNote.textContent())?.match(/AX-INST-[A-Z2-9]{6}/)?.[0]
  if (!code) throw new Error('❌ código de verificación no visible')
  console.log(`✓ institución PENDING con código ${code}`)
  await page.screenshot({ path: `${OUT}/02-institucion-pending.png` })

  // 3. Grupo de importación con nombre único
  const groupName = `Grupo Evidencia R26 ${Date.now().toString(36)}`
  await page.locator('button:has-text("Crear grupo")').first().click()
  await page.locator('input[placeholder*="Nombre del grupo"]').fill(groupName)
  await page.locator('button:has-text("Crear grupo")').last().click()
  const card = page.locator('.axiom-card', { hasText: groupName })
  await expect(card).toBeVisible({ timeout: 10000 })

  // 4. Importación masiva con resultado por correo
  await card.locator('button:has-text("Importar")').click()
  await card.locator('.r26-bulk-area').fill('alumno1@axiom.mx\nalumno2@axiom.mx, maestro\nfantasma@axiom.mx\nno-es-correo')
  await page.waitForTimeout(300)
  await card.locator('.r26-bulk button:has-text("Importar")').click()
  const results = card.locator('.r26-bulk-results')
  await expect(results).toBeVisible({ timeout: 15000 })
  await expect(results).toContainText('2 agregados')
  await expect(results).toContainText('2 con problema')
  await expect(card.locator('.r25-member-row')).toHaveCount(2)
  console.log('✓ importación masiva: 2 agregados, 1 inexistente, 1 correo inválido')
  await page.screenshot({ path: `${OUT}/03-importacion-masiva.png`, fullPage: true })

  // 5. Métricas agregadas del grupo
  await card.locator('button:has-text("Métricas")').click()
  const metrics = card.locator('.r26-metrics')
  await expect(metrics).toBeVisible({ timeout: 15000 })
  await expect(metrics).toContainText('Engagement')
  await expect(metrics).toContainText('Distribución MCER')
  console.log('✓ métricas agregadas visibles (engagement + distribución MCER)')
  await page.screenshot({ path: `${OUT}/04-metricas-grupo.png`, fullPage: true })

  // 6. Restaurar el estado demo: quitar el grupo de evidencia
  await card.locator('button[aria-label="Eliminar grupo"]').click()
  await card.locator('button:has-text("Eliminar")').click()
  await expect(card).toHaveCount(0, { timeout: 10000 })
  console.log('✓ grupo de evidencia eliminado (demo restaurada)')

  if (errors.length) throw new Error(`❌ errores de consola: ${errors.join(' | ')}`)
  console.log('✓ consola sin errores')
  await browser.close()
  console.log(`\nEvidencia R26 lista en ${OUT} (4 capturas)`)
}

main().catch(e => { console.error(e); process.exit(1) })
