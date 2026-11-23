/** Extraer el canvas crudo para ver si la franja beige está en el render */
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
  const card = page.locator('.axiom-card', { hasText: 'Módulo 3 ·' }).first()
  await card.click(); await card.locator('.module-cta').waitFor({ timeout: 15000 }); await card.locator('.module-cta').click()
  await page.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2000)
  await page.evaluate(() => (document.querySelector('.path-scene') as HTMLElement).scrollIntoView({ block: 'start' }))
  await page.waitForTimeout(1500)
  const data = await page.evaluate(() => {
    const c = document.querySelector('.landscape3d canvas') as HTMLCanvasElement
    return c.toDataURL('image/png')
  })
  fs.writeFileSync('/tmp/r19-canvas-raw.png', Buffer.from(data.split(',')[1], 'base64'))
  const rect = await page.evaluate(() => {
    const c = document.querySelector('.landscape3d canvas') as HTMLCanvasElement
    const r = c.getBoundingClientRect()
    return { w: c.width, h: c.height, cssW: r.width, cssH: r.height, top: Math.round(r.top) }
  })
  console.log('canvas rect:', JSON.stringify(rect))
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
