/** Sonda: estado de los botones zoom en la página real */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const AUTH = 'tests/e2e/.auth/demo-state.json'
const BASE = 'http://localhost:3000'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] },
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.clock.install({ time: new Date('2026-10-06T12:00:00') })
  if (!fs.existsSync(AUTH)) {
    await page.goto(`${BASE}/`, { timeout: 60000 })
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }
  await page.goto(`${BASE}/`, { timeout: 60000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  const card = page.locator('.axiom-card', { hasText: 'Módulo 1 ·' }).first()
  await card.click()
  await card.locator('.module-cta').click()
  await page.locator('.path-scene.has-3d-scene').waitFor({ timeout: 30000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 30000 })
  await page.waitForTimeout(2500)
  const info = await page.evaluate(() => {
    const zooms = [...document.querySelectorAll('.d3d-zoom')]
    const dock = document.querySelector('.lesson-dock')
    const plaque = document.querySelector('.d3d-plaque')
    const scene = document.querySelector('.path-scene')
    const r = (el: Element | null) => {
      if (!el) return null
      const b = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { x: b.x, y: b.y, w: b.width, h: b.height, pe: cs.pointerEvents, op: cs.opacity, pos: cs.position }
    }
    return {
      zoomCount: zooms.length,
      zooms: zooms.map(r),
      dock: r(dock),
      plaque: r(plaque),
      scene: r(scene),
      canvas: r(document.querySelector('.landscape3d canvas')),
    }
  })
  console.log(JSON.stringify(info, null, 1))
  await browser.close()
}

main().catch((e) => { console.error('FALLO:', e); process.exit(1) }).finally(() => process.exit(0))
