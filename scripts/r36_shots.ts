/**
 * R36 — Capturas comparativas del camino 3D (variante 1, fase día fijada) y
 * del panel de tarjetas. Se ejecuta ANTES y DESPUÉS de los cambios R36 para
 * verificar: (a) la extracción a módulos no altera el render, (b) el tone
 * mapping sólo produce el suavizado esperado, (c) las tarjetas simplificadas.
 * La fase se fija a «day» (12:00) anulando getHours/getMinutes — sin tocar
 * timers (no se usa page.clock para no congelar el bucle rAF del 3D).
 * Uso: env -u DATABASE_URL bun scripts/r36_shots.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r36', TAG = 'r36'] = process.argv

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
  // fase día fija + onboarding saltado
  await page.addInitScript(() => {
    ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
    ;(Date.prototype as unknown as { getMinutes: () => number }).getMinutes = () => 0
    window.localStorage.setItem('axiom-onboarding-done', 'true')
  })

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
  console.log(`[${TAG}] login ok`)

  // Panel: tarjetas de módulos
  const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
  await card.waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, `${TAG}-dashboard.png`) })

  // Abrir el camino del módulo 1 (antes: expandir + CTA; después: clic directo)
  await card.click()
  const cta = card.locator('.module-cta')
  try {
    await cta.waitFor({ timeout: 4000 })
    await cta.click()
  } catch {
    // R36: la tarjeta abre el camino directamente
  }
  await expectPath(page)
  console.log(`[${TAG}] camino abierto`)

  // Escena 3D lista (clase d3d-on cuando el primer frame termina)
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT, `${TAG}-camino-v1-day.png`) })

  // stats del render (existe tras R36; null antes)
  const stats = await page.evaluate(() => {
    const d3d = (window as unknown as { __d3d?: { stats?: () => unknown } }).__d3d
    return d3d?.stats ? d3d.stats() : null
  })
  fs.writeFileSync(path.join(OUT, `${TAG}-stats.json`), JSON.stringify(stats, null, 2))
  console.log(`[${TAG}] stats:`, JSON.stringify(stats))

  if (errors.length) {
    console.error(`[${TAG}] PAGEERROR:`, errors)
    process.exitCode = 1
  }
  await browser.close()
}

async function expectPath(page: import('@playwright/test').Page) {
  const { expect } = await import('@playwright/test')
  await expect(page.getByText(/Nivel A1/).first()).toBeVisible({ timeout: 30000 })
}

main().catch(e => { console.error(e); process.exit(1) })
