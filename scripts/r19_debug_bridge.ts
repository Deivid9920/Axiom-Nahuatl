/** Debug: cámara panorámica sobre el río M3 para verificar puente/agua */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
async function main() {
  const browser = await chromium.launch()
  const AUTH = 'tests/e2e/.auth/demo-state.json'
  const ctx = await browser.newContext({ storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.clock.install({ time: new Date('2026-10-06T12:00:00') })
  await page.goto('http://localhost:3000/', { timeout: 60000 })
  try { await page.locator('.axiom-hello').waitFor({ timeout: 20000 }) } catch {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  }
  const card = page.locator('.axiom-card', { hasText: 'Módulo 3 ·' }).first()
  await card.click(); await card.locator('.module-cta').waitFor({ timeout: 15000 }); await card.locator('.module-cta').click()
  await page.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2000)
  await page.evaluate(() => (document.querySelector('.path-scene') as HTMLElement).scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/r19-bridge-a.png' })
  // apartar la mirada: parallax del ratón hacia abajo (my=+1 → target y 3.35)
  await page.mouse.move(720, 890)
  await page.waitForTimeout(2500)
  await page.screenshot({ path: '/tmp/r19-bridge-b.png' })
  await browser.close()
  console.log('listo')
}
main().catch((e) => { console.error(e); process.exit(1) })
