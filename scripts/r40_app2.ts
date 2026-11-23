import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } })
const page = await ctx.newPage()
await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
await page.goto('http://localhost:3000/', { timeout: 60000 })
await page.fill('input[type="email"]', 'admin@axiom.mx')
await page.fill('input[type="password"]', 'axiom12345')
await page.click('button[type="submit"]')
await page.waitForSelector('.axiom-hello', { timeout: 30000 })
// entrar al módulo 1 (vista del mundo 3D con nodos)
await page.getByRole('button', { name: /Continuar/i }).first().click().catch(async () => {
  await page.getByText('Continuar').first().click()
})
await page.waitForTimeout(11000) // GLB + nodos + cuervo
const hasD3d = await page.evaluate(() => typeof (window as any).__d3d !== 'undefined')
console.log('d3d:', hasD3d)
if (hasD3d) {
  const s = await page.evaluate(() => (window as any).__d3d.stats())
  console.log('stats:', JSON.stringify(s))
}
await page.screenshot({ path: 'download/evidencia-r40/r40-app-mundo.png' })
await browser.close()
console.log('OK')
