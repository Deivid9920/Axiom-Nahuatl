/** Sonda de fase: reloj simulado vs data-phase del panel */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const AUTH = 'tests/e2e/.auth/demo-state.json'
const BASE = 'http://localhost:3000'
async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.clock.install({ time: new Date('2026-10-06T21:30:00') })
  await page.goto(`${BASE}/`, { timeout: 60000 })
  if (!fs.existsSync(AUTH)) {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  const before = await page.evaluate(() => ({ now: new Date().toString(), phase: document.querySelector('.path-scene')?.getAttribute('data-phase') ?? 'sin panel' }))
  console.log('inicio:', JSON.stringify(before))
  const card = page.locator('.axiom-card', { hasText: 'Módulo 3 ·' }).first()
  await card.click()
  await card.locator('.module-cta:not([disabled])').click()
  await page.locator('.path-scene.has-3d-scene').waitFor({ timeout: 30000 })
  await page.waitForTimeout(2500)
  const after = await page.evaluate(() => ({
    now: new Date().toString(),
    phase: document.querySelector('.path-scene')?.getAttribute('data-phase') ?? 'sin panel',
    dark: document.documentElement.classList.contains('dark'),
  }))
  console.log('camino:', JSON.stringify(after))
  await page.screenshot({ path: '/home/z/my-project/download/evidencia-r21/dbg-phase-noche.png' })
  await browser.close()
}
main().catch((e) => { console.error('FALLO:', e); process.exit(1) }).finally(() => process.exit(0))
