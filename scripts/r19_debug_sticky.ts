/** Debug: ¿por qué no pega el sticky? */
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
  await page.waitForTimeout(1500)
  const info = await page.evaluate(() => {
    const scene = document.querySelector('.path-scene') as HTMLElement
    const land = document.querySelector('.landscape3d') as HTMLElement
    const csS = getComputedStyle(scene), csL = getComputedStyle(land)
    // subir por ancestros buscando overflow/transform
    const chain: string[] = []
    let el: HTMLElement | null = land
    while (el && el !== document.documentElement) {
      const cs = getComputedStyle(el)
      if (cs.overflow !== 'visible' || cs.transform !== 'none' || cs.willChange.includes('transform')) {
        chain.push(`${el.className.toString().slice(0, 40)} | ov:${cs.overflow} tr:${cs.transform.slice(0, 24)} wc:${cs.willChange}`)
      }
      el = el.parentElement
    }
    return {
      sceneOverflow: csS.overflow, landPos: csL.position, landTop: csL.top, landH: csL.height,
      landMB: csL.marginBottom, chain,
    }
  })
  console.log(JSON.stringify(info, null, 1))
  await page.evaluate(() => window.scrollBy(0, 1200))
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => {
    const land = document.querySelector('.landscape3d') as HTMLElement
    const r = land.getBoundingClientRect()
    return { landTop: Math.round(r.top), landBottom: Math.round(r.bottom), scrollY: Math.round(window.scrollY) }
  })
  console.log('tras scroll 1200:', JSON.stringify(after))
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
