import { chromium } from '@playwright/test'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage()
await p.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
await p.goto('http://localhost:3001/', { timeout: 90000 })
try { await p.locator('.axiom-hello').waitFor({ timeout: 8000 }) } catch {
  await p.fill('input[type="email"]', 'admin@axiom.mx')
  await p.fill('input[type="password"]', 'axiom12345')
  await p.click('button[type="submit"]', { timeout: 20000 })
  await p.locator('.axiom-hello').waitFor({ timeout: 60000 })
}
await p.locator('.axiom-card').first().waitFor({ timeout: 30000 })
const cards = await p.locator('.axiom-card').allTextContents()
console.log(cards.map((c, i) => `${i + 1}: ${c.slice(0, 90).replace(/\n/g, ' | ')}`).join('\n'))
await b.close()
