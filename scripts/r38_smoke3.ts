/**
 * R38 — humo de la cascada (variante 3 = módulo 3, río z=-38): encuadre
 * manual vía __d3d (controls.target + camera.position) para ver el salto en
 * el borde +x de la isla. Fase día fijada.
 * Uso: bun scripts/r38_smoke3.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3001', OUT = '/tmp/r38smoke', TAG = 'smoke3'] = process.argv

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
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

  const card = page.locator('.axiom-card', { hasText: 'Módulo 3' }).first()
  await card.waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)
  await card.click()
  const { expect } = await import('@playwright/test')
  await expect(page.getByText(/Nivel A/).first()).toBeVisible({ timeout: 30000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
  await page.waitForTimeout(2600)

  // vista del salto: target al borde +x del río, cámara dentro de la isla
  await page.evaluate(() => {
    const d = (window as unknown as {
      __d3d?: { controls: { target: { set: (x: number, y: number, z: number) => void } }; camera: { position: { set: (x: number, y: number, z: number) => void }; lookAt: (t: unknown) => void } }
    }).__d3d
    if (!d) return
    d.controls.target.set(24.5, -2.2, -38)
    d.camera.position.set(13.5, 3.2, -33)
    d.camera.lookAt(d.controls.target)
  })
  await page.waitForTimeout(900)
  await page.screenshot({ path: path.join(OUT, `${TAG}-waterfall.png`) })

  // world view del módulo 3 (isla completa con el río y el salto)
  await page.evaluate(() => {
    const d = (window as unknown as { __d3d?: { setMode: (m: string) => void } }).__d3d
    d?.setMode('world')
  })
  await page.waitForTimeout(4200)
  await page.screenshot({ path: path.join(OUT, `${TAG}-world.png`) })

  if (errors.length) { console.error(`[${TAG}] PAGEERROR:`, errors); process.exitCode = 1 }
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
