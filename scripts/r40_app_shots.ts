// R40 — evidencia en la APP REAL (no el lab): login demo, mundo Pradera del
// módulo vigente con nodos reales + cuervo mascota nuevo en la esquina.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const OUT = 'download/evidencia-r40'
mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 780 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.goto('http://localhost:3000/', { timeout: 60000 })
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.axiom-hello', { timeout: 30000 })
  await page.waitForTimeout(9000) // mundo GLB cargado + nodos + cuervo posado
  await page.screenshot({ path: `${OUT}/r40-app-follow.png` })
  const hasD3d = await page.evaluate(() => typeof (window as any).__d3d !== 'undefined')
  if (hasD3d) {
    const s = await page.evaluate(() => (window as any).__d3d.stats())
    console.log('app follow stats:', JSON.stringify(s))
    await page.screenshot({ path: `${OUT}/r40-app-follow2.png` })
  }
  // mascota: el cuervo de la esquina (Mascot3D)
  const mascot = await page.evaluate(() => !!document.querySelector('.mascota canvas.mascot-3d, .mascota svg.mascot-svg'))
  console.log('mascota presente (3D o SVG):', mascot)
  await browser.close()
  console.log('OK app shots')
}
main().catch((e) => { console.error(e); process.exit(1) })
