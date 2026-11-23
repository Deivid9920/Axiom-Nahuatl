/** Debug R19: valores de scroll/cámara en vivo para el M3 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const AUTH = '/home/z/my-project/axiom-v7-extracted/tests/e2e/.auth/demo-state.json'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.goto('http://localhost:3000/', { timeout: 60000 })
  try { await page.locator('.axiom-hello').waitFor({ timeout: 20000 }) } catch { await page.fill('input[type="email"]', 'admin@axiom.mx'); await page.fill('input[type="password"]', 'axiom12345'); await page.click('button[type="submit"]'); await page.locator('.axiom-hello').waitFor({ timeout: 30000 }) }
  const card = page.locator('.axiom-card', { hasText: 'Módulo 3 ·' }).first()
  await card.click()
  await card.locator('.module-cta').waitFor({ timeout: 15000 })
  await card.locator('.module-cta').click()
  await page.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2000)

  const probe = () => page.evaluate(() => {
    const el = document.querySelector('.path-scene') as HTMLElement
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    const raw = (vh * 0.66 - r.top) / Math.max(1, r.height - vh * 0.28)
    return { scrollY: Math.round(window.scrollY), top: Math.round(r.top), h: Math.round(r.height), vh, raw: raw.toFixed(3), camZ: (8 - Math.min(1, Math.max(0, raw)) * 112).toFixed(1) }
  })
  console.log('inicial:', await probe())
  await page.evaluate(() => (document.querySelector('.path-scene') as HTMLElement).scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(600)
  console.log('tras scrollIntoView:', await probe())
  await page.evaluate(() => window.scrollBy(0, 245))
  await page.waitForTimeout(600)
  console.log('tras +245:', await probe())
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(600)
  console.log('tras +645:', await probe())
  await page.evaluate(() => window.scrollBy(0, 400))
  await page.waitForTimeout(600)
  console.log('tras +1045:', await probe())
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
