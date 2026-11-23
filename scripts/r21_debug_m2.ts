/** Sonda M2: posición de cámara, foco y nodos del portal */
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
  await page.goto(`${BASE}/`, { timeout: 60000 })
  if (!fs.existsSync(AUTH)) {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  const card = page.locator('.axiom-card', { hasText: 'Módulo 2 ·' }).first()
  await card.click()
  await card.locator('.module-cta:not([disabled])').click()
  await page.locator('.path-scene.has-3d-scene').waitFor({ timeout: 30000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 30000 })
  await page.waitForTimeout(3600)
  const info = await page.evaluate(() => {
    const d = (window as any).__d3d
    if (!d) return { err: 'sin __d3d' }
    const nw = d.nodeWorld()
    const vis = nw ? nw.visuals.map((v: any) => ({
      pos: v.group.position.toArray().map((n: number) => +n.toFixed(1)),
      scale: +v.group.scale.x.toFixed(2),
    })) : []
    return {
      camera: d.camera.position.toArray().map((n: number) => +n.toFixed(1)),
      target: d.controls.target.toArray().map((n: number) => +n.toFixed(1)),
      dist: +d.camera.position.distanceTo(d.controls.target).toFixed(1),
      nodeCount: vis.length,
      first: vis[0],
      last: vis[vis.length - 1],
    }
  })
  console.log(JSON.stringify(info, null, 1))
  await browser.close()
}

main().catch((e) => { console.error('FALLO:', e); process.exit(1) }).finally(() => process.exit(0))
