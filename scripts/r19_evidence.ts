/**
 * R19 — Evidencia del paisaje 3D completo (inglés v7).
 * Captura: M1 pradera (inicio + avance del scroll), M2 otoño, M3 río con
 * puente, y M1 de noche (estrellas, luna, luciérnagas). Verifica que el
 * decorado SVG/CSS se retiró (has-3d-scene) y que la consola no tiene errores.
 * Uso: dev server arriba en :3000 → bun scripts/r19_evidence.ts
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const OUT = '/home/z/my-project/download/evidencia-r19'
const AUTH = 'tests/e2e/.auth/demo-state.json'
const BASE = 'http://localhost:3000'

async function openModule(page: import('@playwright/test').Page, n: number) {
  await page.goto(`${BASE}/`, { timeout: 60000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  const card = page.locator('.axiom-card', { hasText: `Módulo ${n} ·` }).first()
  await card.waitFor({ timeout: 20000 })
  await card.click()
  await card.locator('.module-cta').waitFor({ timeout: 15000 })
  await card.locator('.module-cta').click()
  await page.locator('.path-scene').waitFor({ timeout: 30000 })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] },
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.clock.install({ time: new Date('2026-10-06T12:00:00') }) // mediodía: tomas diurnas
  if (!fs.existsSync(AUTH)) {
    await page.goto(`${BASE}/`, { timeout: 60000 })
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }

  // M1 pradera — inicio del camino (captura de VIEWPORT: el canvas es sticky)
  await openModule(page, 1)
  await page.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2600)
  const scene = page.locator('.path-scene').first()
  await scene.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  const has3d = await page.locator('.path-scene.has-3d-scene').count()
  console.log('has-3d-scene activo:', has3d > 0)
  await page.screenshot({ path: `${OUT}/r19-1-m1-pradera-inicio.png` })

  // avance por el camino con el scroll (la cámara recorre el sendero)
  await page.evaluate(() => window.scrollBy(0, 950))
  await page.waitForTimeout(2400)
  await page.screenshot({ path: `${OUT}/r19-2-m1-pradera-avance.png` })

  // M2 otoño
  await openModule(page, 2)
  await page.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2600)
  await page.locator('.path-scene').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/r19-3-m2-otono.png` })

  // M3 río — scroll exacto: raw 0.42 → camZ ≈ -39 (sobre el puente)
  await openModule(page, 3)
  await page.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(2200)
  await page.evaluate(() => {
    const el = document.querySelector('.path-scene') as HTMLElement
    const top = el.getBoundingClientRect().top + window.scrollY
    const H = el.offsetHeight, vh = window.innerHeight
    const raw = 0.42
    const topInVp = vh * 0.66 - raw * Math.max(1, H - vh * 0.28)
    window.scrollTo(0, top - topInVp)
  })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/r19-4-m3-rio-puente.png` })

  await ctx.close()

  // M1 de noche: reloj fijado de madrugada → ciclo día/noche por hora local
  const ctxN = await browser.newContext({
    storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] },
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const pageN = await ctxN.newPage()
  pageN.on('pageerror', (e) => errors.push('noche: ' + String(e)))
  await pageN.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await pageN.clock.install({ time: new Date('2026-10-06T03:00:00') })
  await openModule(pageN, 1)
  await pageN.locator('.landscape3d canvas').first().waitFor({ state: 'visible', timeout: 30000 })
  await pageN.waitForTimeout(2600)
  const phase = await pageN.locator('.path-scene').first().getAttribute('data-phase')
  console.log('fase nocturna:', phase)
  await pageN.locator('.path-scene').first().scrollIntoViewIfNeeded()
  await pageN.waitForTimeout(1200)
  await pageN.screenshot({ path: `${OUT}/r19-5-m1-noche.png` })
  await ctxN.close()

  await browser.close()
  console.log('errores de página:', errors.length ? errors : 'ninguno')
  if (errors.length) process.exit(1)
  console.log('Evidencia R19 (v7) lista en', OUT)
}

main().catch((e) => { console.error(e); process.exit(1) })
