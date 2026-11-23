/**
 * R38 — humo visual: capturas de la isla (follow día, world día, cascada en
 * variante 3). Fase fijada a día; sin page.clock (no congelar rAF).
 * Uso: bun scripts/r38_smoke.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3001', OUT = '/tmp/r38smoke', TAG = 'smoke'] = process.argv

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })
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
  const { expect } = await import('@playwright/test')
  await expect(page.getByText(/Nivel A1/).first()).toBeVisible({ timeout: 30000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
  await page.waitForTimeout(2600)

  const call = (expr: string) => page.evaluate((src) => {
    const d = (window as unknown as { __d3d?: Record<string, (a: string) => void> }).__d3d
    const [fn, arg] = src.split(':')
    d?.[fn]?.(arg)
  }, expr)
  const stats = () => page.evaluate(() => {
    const d3d = (window as unknown as { __d3d?: { stats?: () => Record<string, unknown>; getMode?: () => string } }).__d3d
    return d3d?.stats ? { ...d3d.stats(), mode: d3d.getMode?.() } : null
  })

  await page.screenshot({ path: path.join(OUT, `${TAG}-island-follow.png`) })
  console.log(`[${TAG}] follow:`, JSON.stringify(await stats()))

  await call('setMode:world')
  await page.waitForTimeout(2600)
  await page.screenshot({ path: path.join(OUT, `${TAG}-island-world.png`) })
  console.log(`[${TAG}] world:`, JSON.stringify(await stats()))

  await call('setMode:follow')
  await page.waitForTimeout(1800)
  if (errors.length) { console.error(`[${TAG}] PAGEERROR:`, errors); process.exitCode = 1 }
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
