/**
 * R37 — Capturas comparativas de cámara: follow/world × perspectiva/ortográfica
 * (variante 1, fase día fijada). Base de la decisión orto/persp con datos:
 * 4 combinaciones, stats() de cada una y capturas del mismo encuadre.
 * La fase se fija a «day» (12:00) anulando getHours/getMinutes — sin tocar
 * timers (no se usa page.clock para no congelar el bucle rAF del 3D).
 * Uso: env -u DATABASE_URL bun scripts/r37_shots.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r37', TAG = 'r37'] = process.argv

interface Combo { name: string; stats: unknown }

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.addInitScript(() => {
    ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
    ;(Date.prototype as unknown as { getMinutes: () => number }).getMinutes = () => 0
    window.localStorage.setItem('axiom-onboarding-done', 'true')
  })

  await page.goto(`${BASE}/`, { timeout: 90000 })
  const hello = page.locator('.axiom-hello')
  try {
    await hello.waitFor({ timeout: 8000 })
  } catch {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]', { timeout: 20000 })
    await hello.waitFor({ timeout: 60000 })
  }
  console.log(`[${TAG}] login ok`)

  const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
  await card.waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)
  await card.click()
  const cta = card.locator('.module-cta')
  try {
    await cta.waitFor({ timeout: 4000 })
    await cta.click()
  } catch {
    // R36+: la tarjeta abre el camino directamente
  }
  const { expect } = await import('@playwright/test')
  await expect(page.getByText(/Nivel A1/).first()).toBeVisible({ timeout: 30000 })
  console.log(`[${TAG}] camino abierto`)

  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
  // el barrido inicial de cámara (syncNodes → followU) termina antes de 2.4 s
  await page.waitForTimeout(2600)

  const d3dShape = await page.evaluate(() => {
    const d = (window as unknown as { __d3d?: Record<string, unknown> }).__d3d
    return d ? Object.keys(d) : null
  })
  console.log(`[${TAG}] __d3d:`, JSON.stringify(d3dShape))

  const combos: Combo[] = []
  const shot = async (name: string, settleMs: number) => {
    await page.waitForTimeout(settleMs)
    const stats = await page.evaluate(() => {
      const d3d = (window as unknown as {
        __d3d?: { stats?: () => unknown; getProjection?: () => string; getMode?: () => string }
      }).__d3d
      if (!d3d?.stats) return null
      return { ...(d3d.stats() as object), projection: d3d.getProjection?.(), mode: d3d.getMode?.() }
    })
    combos.push({ name, stats })
    await page.screenshot({ path: path.join(OUT, `${TAG}-${name}.png`) })
    console.log(`[${TAG}] ${name}:`, JSON.stringify(stats))
  }
  const call = (expr: string) => page.evaluate((src) => {
    const d = (window as unknown as { __d3d?: Record<string, (a: string) => void> }).__d3d
    const [fn, arg] = src.split(':')
    d?.[fn]?.(arg)
  }, expr)

  // 1) follow + perspectiva (comportamiento por defecto R21/R36 intacto)
  await shot('follow-persp', 1200)
  // 2) follow + ortográfica (zoom equivalente, misma pose)
  await call('setProjection:ortho')
  await shot('follow-ortho', 1200)
  // 3) world + perspectiva (vista World Map con la cámara por defecto)
  await call('setProjection:persp')
  await call('setMode:world')
  await shot('world-persp', 2000)
  // 4) world + ortográfica
  await call('setProjection:ortho')
  await shot('world-ortho', 1200)
  // dejar la escena como estaba
  await call('setProjection:persp')
  await call('setMode:follow')
  await page.waitForTimeout(1600)

  fs.writeFileSync(
    path.join(OUT, `${TAG}-stats.json`),
    JSON.stringify(combos, null, 2),
  )
  console.log(`[${TAG}] combos capturados: ${combos.length}`)

  if (errors.length) {
    console.error(`[${TAG}] PAGEERROR:`, errors)
    process.exitCode = 1
  }
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
