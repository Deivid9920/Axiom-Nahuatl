import { chromium } from '@playwright/test'
import fs from 'node:fs'
async function main() {
  const browser = await chromium.launch()
  const AUTH = 'tests/e2e/.auth/demo-state.json'
  const ctx = await browser.newContext({ storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.goto('http://localhost:3000/', { timeout: 60000 })
  try { await page.locator('.axiom-hello').waitFor({ timeout: 20000 }) } catch {
    await page.fill('input[type="email"]', 'admin@axiom.mx'); await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]'); await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  }
  const card = page.locator('.axiom-card', { hasText: 'Módulo 1 ·' }).first()
  await card.click(); await card.locator('.module-cta').waitFor({ timeout: 15000 }); await card.locator('.module-cta').click()
  await page.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1200)
  const n = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('.path-scene'))
    return all.map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      return { cls: el.className.slice(0, 60), top: Math.round(r.top + window.scrollY), h: Math.round(r.height), canvases: el.querySelectorAll('canvas').length }
    })
  })
  console.log('path-scenes:', JSON.stringify(n, null, 1))
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
