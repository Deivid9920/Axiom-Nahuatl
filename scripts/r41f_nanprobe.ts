/** R41f — ¿el pageerror del rig dispara sin interacción? marca de tiempo por paso. */
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage()
let n = 0
page.on('pageerror', e => { n++; console.log(`[err#${n} @${new Date().toISOString().slice(11,19)}]`, String(e).slice(0, 120), '\n', (e as Error).stack?.split('\n').slice(1, 4).join('\n')) })
await page.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})
console.log('== lab: carga y 12 s de espera pasiva ==')
await page.goto('http://localhost:3000/lab-isla', { timeout: 90000 })
await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
await page.waitForTimeout(12000)
console.log('lab: errores hasta ahora =', n)
console.log('== app: login + módulo 1 ==')
await page.goto('http://localhost:3000/', { timeout: 90000 })
try { await page.locator('.axiom-hello').waitFor({ timeout: 8000 }) } catch {
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]', { timeout: 20000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 60000 })
}
const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
await card.waitFor({ timeout: 30000 })
await card.click()
await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
await page.waitForTimeout(9000)
console.log('app: errores hasta ahora =', n)
await browser.close()
