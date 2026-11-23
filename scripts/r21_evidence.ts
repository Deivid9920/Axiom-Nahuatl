/**
 * R21 — Evidencia del diorama 3D interactivo (inglés v7).
 * Fases por STEP (coreografiadas desde bash para el estado del progreso):
 *   m1       → tomas 01-06 con progreso mixto (2 hechos, actual, bloqueados)
 *   worlds   → tomas 07-09 (M2 otoño, M3 río, noche)
 *   fallback → toma 10 (sin WebGL: zigzag R16-R19 intacto)
 * Contexto fresco por toma (el token efímero + reloj simulado hacen frágil
 * la re-navegación). Uso: STEP=m1 bun scripts/r21_evidence.ts
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const OUT = '/home/z/my-project/download/evidencia-r21'
const AUTH = 'tests/e2e/.auth/demo-state.json'
const BASE = 'http://localhost:3000'
const STEP = process.env.STEP ?? 'all'

async function freshPage(browser: import('@playwright/test').Browser, opts: { clock?: string } = {}) {
  const ctx = await browser.newContext({
    storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] },
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.clock.install({ time: new Date(opts.clock ?? '2026-10-06T12:00:00') })
  if (!fs.existsSync(AUTH)) {
    await page.goto(`${BASE}/`, { timeout: 60000 })
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }
  return { ctx, page }
}

async function openModule(page: import('@playwright/test').Page, n: number) {
  await page.goto(`${BASE}/`, { timeout: 60000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  const card = page.locator('.axiom-card', { hasText: `Módulo ${n} ·` }).first()
  await card.waitFor({ timeout: 20000 })
  await card.click()
  await card.locator('.module-cta:not([disabled])').waitFor({ timeout: 15000 })
  await card.locator('.module-cta:not([disabled])').click()
  await page.locator('.path-scene.has-3d-scene').waitFor({ timeout: 30000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 30000 })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const errors: string[] = []

  if (STEP === 'm1' || STEP === 'all') {
    const { ctx, page } = await freshPage(browser)
    page.on('pageerror', (e) => errors.push(String(e)))
    await openModule(page, 1)
    await page.waitForTimeout(3400)
    await page.screenshot({ path: `${OUT}/r21-01-m1-diorama-inicial.png` })

    const canvas = page.locator('.landscape3d canvas').first()
    const box = await canvas.boundingBox()
    if (box) {
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx + 170, cy - 26, { steps: 12 })
      await page.mouse.move(cx + 250, cy + 12, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(900)
    }
    await page.screenshot({ path: `${OUT}/r21-02-m1-girado.png` })

    await page.locator('.d3d-zoom[aria-label="Acercar la cámara"]').click()
    await page.waitForTimeout(650)
    await page.locator('.d3d-zoom[aria-label="Acercar la cámara"]').click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/r21-03-m1-zoom.png` })

    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 30, { steps: 6 })
      await page.waitForTimeout(600)
    }
    await page.screenshot({ path: `${OUT}/r21-04-m1-hover.png` })

    await page.locator('.axiom-node.current').first().click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `${OUT}/r21-05-m1-vuelo-camara.png` })
    await page.waitForTimeout(2600)
    await page.screenshot({ path: `${OUT}/r21-06-m1-leccion-abierta.png` })
    await ctx.close()
  }

  if (STEP === 'worlds' || STEP === 'all') {
    {
      const { ctx, page } = await freshPage(browser)
      page.on('pageerror', (e) => errors.push(String(e)))
      await openModule(page, 2)
      await page.waitForTimeout(3400)
      await page.screenshot({ path: `${OUT}/r21-07-m2-otono.png` })
      await ctx.close()
    }
    {
      const { ctx, page } = await freshPage(browser)
      page.on('pageerror', (e) => errors.push(String(e)))
      await openModule(page, 3)
      await page.waitForTimeout(3400)
      await page.screenshot({ path: `${OUT}/r21-08-m3-rio-puente.png` })
      await ctx.close()
    }
    {
      // noche: contexto nuevo con el reloj fijado de entrada (la fase se
      // calcula al montar; setFixedTime/runFor no disparan el intervalo)
      const { ctx, page } = await freshPage(browser, { clock: '2026-10-06T21:30:00' })
      page.on('pageerror', (e) => errors.push(String(e)))
      await openModule(page, 3)
      const phaseSeen = await page.evaluate(() => ({
        now: new Date().getHours(),
        phase: document.querySelector('.path-scene')?.getAttribute('data-phase'),
      }))
      console.log('fase nocturna vista por la página:', JSON.stringify(phaseSeen))
      await page.waitForTimeout(3400)
      await page.screenshot({ path: `${OUT}/r21-09-m3-noche.png` })
      await ctx.close()
    }
  }

  if (STEP === 'fallback' || STEP === 'all') {
    const ctx0 = await browser.newContext({
      storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] },
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1.5,
    })
    const page = await ctx0.newPage()
    await page.addInitScript(() => {
      window.localStorage.setItem('axiom-onboarding-done', 'true')
      // sin WebGL el Landscape3D no monta y el decorado SVG/CSS de R16-R19
      // queda en su lugar con la columna zigzag original
      const origGetContext = HTMLCanvasElement.prototype.getContext
      ;(HTMLCanvasElement.prototype as any).getContext = function (type: string, ...a: any[]) {
        if (type === 'webgl2' || type === 'webgl') return null
        return (origGetContext as any).call(this, type, ...a)
      }
    })
    await page.clock.install({ time: new Date('2026-10-06T12:00:00') })
    await page.goto(`${BASE}/`, { timeout: 60000 })
    if (!fs.existsSync(AUTH)) {
      await page.fill('input[type="email"]', 'admin@axiom.mx')
      await page.fill('input[type="password"]', 'axiom12345')
      await page.click('button[type="submit"]')
      await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
      await ctx0.storageState({ path: AUTH })
    }
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    const card = page.locator('.axiom-card', { hasText: 'Módulo 1 ·' }).first()
    await card.click()
    await card.locator('.module-cta:not([disabled])').click()
    await page.locator('.path-scene').waitFor({ timeout: 30000 })
    await page.waitForTimeout(2500)
    const has3d = await page.evaluate(() => document.querySelector('.path-scene')?.classList.contains('has-3d-scene') ?? false)
    console.log('respaldo sin WebGL (has-3d-scene=false esperado):', !has3d)
    await page.screenshot({ path: `${OUT}/r21-10-respaldo-sin-webgl.png` })
    await ctx0.close()
  }

  console.log('ERRORES DE PÁGINA:', errors.length ? errors : 'ninguno')
  await browser.close()
}

main().catch((e) => { console.error('FALLO:', e); process.exit(1) }).finally(() => process.exit(0))
