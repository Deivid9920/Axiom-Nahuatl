/** R41h — lee el log de diagnóstico de la mascota UI. */
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage()
page.on('console', m => { if (m.text().includes('R41-diag')) console.log('[browser]', m.text().slice(0, 300)) })
await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
await page.goto('http://localhost:3000/', { timeout: 90000 })
try { await page.locator('.axiom-hello').waitFor({ timeout: 8000 }) } catch {
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]', { timeout: 20000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 60000 })
}
await page.waitForTimeout(4000)
await browser.close()
