/**
 * R36 — Sonda de rendimiento: deja la escena correr 10 s y muestrea stats()
 * (fps, draw calls, triángulos, memoria) cada 2 s. El sandbox renderiza por
 * software (SwiftShader), así que el fps ABSOLUTO no es representativo de un
 * navegador con GPU; lo que importa es la estabilidad y la comparación
 * relativa antes/después de cada cambio visual.
 * Uso: env -u DATABASE_URL bun scripts/r36_fps.ts <BASE> <SEGUNDOS>
 */
import { chromium } from '@playwright/test'

const [, , BASE = 'http://localhost:3000', SECS = '10'] = process.argv

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
    window.localStorage.setItem('axiom-onboarding-done', 'true')
  })
  await page.goto(`${BASE}/`, { timeout: 90000 })
  const hello = page.locator('.axiom-hello')
  try { await hello.waitFor({ timeout: 8000 }) } catch {
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
  } catch { /* R36: clic directo */ }
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })

  const n = parseInt(SECS, 10)
  for (let i = 0; i < Math.max(1, Math.floor(n / 2)); i++) {
    await page.waitForTimeout(2000)
    const s = await page.evaluate(() => {
      const d3d = (window as unknown as { __d3d?: { stats?: () => Record<string, number> } }).__d3d
      return d3d?.stats ? d3d.stats() : null
    })
    console.log(`[t+${(i + 1) * 2}s]`, JSON.stringify(s))
  }
  // fps por conteo de rAF (funciona con el código viejo y el nuevo): cuenta
  // callbacks de requestAnimationFrame durante 4 s en la página viva
  const rafFps = await page.evaluate(() => new Promise<number>(resolve => {
    let c = 0
    const t0 = performance.now()
    const tick = () => {
      c++
      if (performance.now() - t0 < 4000) requestAnimationFrame(tick)
      else resolve(Math.round((c / 4) * 10) / 10)
    }
    requestAnimationFrame(tick)
  }))
  console.log(`[raf 4s] fps≈${rafFps}`)
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
