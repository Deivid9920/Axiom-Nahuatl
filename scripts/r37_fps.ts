/**
 * R37 — Sonda de rendimiento por combinación de cámara (follow/world ×
 * persp/ortho). En cada combo: 2 s de asentamiento + conteo rAF durante 4 s
 * (válido con cualquier estado del código) + stats() del último frame.
 * El render de este sandbox es por software (SwiftShader): el valor absoluto
 * no es representativo de GPU; lo que decide es la COMPARACIÓN entre combos.
 * Uso: env -u DATABASE_URL bun scripts/r37_fps.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r37', TAG = 'r37'] = process.argv

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
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

  const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
  await card.waitFor({ timeout: 30000 })
  await card.click()
  try {
    const cta = card.locator('.module-cta')
    await cta.waitFor({ timeout: 4000 })
    await cta.click()
  } catch { /* apertura directa */ }
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
  await page.waitForTimeout(2600)
  console.log(`[${TAG}] camino abierto; midiendo combos…`)

  const call = (expr: string) => page.evaluate((src) => {
    const d = (window as unknown as { __d3d?: Record<string, (a: string) => void> }).__d3d
    const [fn, arg] = src.split(':')
    d?.[fn]?.(arg)
  }, expr)

  const probe = async () => page.evaluate(() => new Promise<{ rafFps: number; stats: unknown }>((resolve) => {
    let frames = 0
    const t0 = performance.now()
    const tick = () => {
      frames++
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick)
      else {
        const d3d = (window as unknown as {
          __d3d?: { stats?: () => unknown; getProjection?: () => string; getMode?: () => string }
        }).__d3d
        resolve({
          rafFps: Math.round(frames * 1000 / (performance.now() - t0)),
          stats: d3d?.stats ? { ...(d3d.stats() as object), projection: d3d.getProjection?.(), mode: d3d.getMode?.() } : null,
        })
      }
    }
    requestAnimationFrame(tick)
  }))

  const lines: string[] = []
  const combos: Array<{ label: string; setup: string[] }> = [
    { label: 'follow-persp (default R21)', setup: [] },
    { label: 'follow-ortho', setup: ['setProjection:ortho'] },
    { label: 'world-persp', setup: ['setProjection:persp', 'setMode:world'] },
    { label: 'world-ortho', setup: ['setProjection:ortho'] },
  ]
  for (const c of combos) {
    for (const s of c.setup) await call(s)
    await page.waitForTimeout(2200)
    const r = await probe()
    const line = `${c.label}: rAF ${r.rafFps} fps · stats ${JSON.stringify(r.stats)}`
    lines.push(line)
    console.log(`[${TAG}] ${line}`)
  }
  // dejar limpio
  await call('setProjection:persp')
  await call('setMode:follow')

  fs.writeFileSync(path.join(OUT, `${TAG}-rendimiento.txt`), lines.join('\n') + '\n')
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
