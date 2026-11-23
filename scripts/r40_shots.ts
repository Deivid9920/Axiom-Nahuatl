// R40 — evidencia visual del piloto Pradera: capturas del mundo con la capa
// GLB (árboles/aldea/fauna) + stats de rendimiento. Correr DENTRO del proyecto
// (regla de Playwright documentada en worklog R38).
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'

const OUT = 'download/evidencia-r40'
mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1360, height: 760 } })

  // ── /lab-isla variant 1 (Pradera) — follow y world ──
  await page.goto('http://localhost:3000/lab-isla', { waitUntil: 'load' })
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: '1 · Pradera' }).click()
  await page.waitForTimeout(4000) // carga GLB + settle

  const hasD3d = await page.evaluate(() => typeof (window as any).__d3d !== 'undefined')
  console.log('d3d:', hasD3d)
  if (hasD3d) {
    const s = await page.evaluate(() => (window as any).__d3d.stats())
    console.log('stats follow:', JSON.stringify(s))
    await page.screenshot({ path: `${OUT}/r40-pradera-follow.png` })
    await page.evaluate(() => (window as any).__d3d.setMode('world'))
    await page.waitForTimeout(3500)
    const s2 = await page.evaluate(() => (window as any).__d3d.stats())
    console.log('stats world:', JSON.stringify(s2))
    await page.screenshot({ path: `${OUT}/r40-pradera-world.png` })
    await page.evaluate(() => (window as any).__d3d.setMode('follow'))
    await page.waitForTimeout(2500)
    // aldea: volar al arranque del camino (u bajo)
    await page.evaluate(() => {
      const d3d = (window as any).__d3d
      const cam = d3d.camera
      const curve = d3d.curve
      const p = curve.getPointAt(0.16)
      d3d.controls.target.set(p.x, p.y + 1.2, p.z)
      cam.position.set(p.x, p.y + 11, p.z + 14)
    })
    await page.waitForTimeout(2200)
    await page.screenshot({ path: `${OUT}/r40-pradera-aldea.png` })
  }

  await browser.close()
  console.log('OK evidencia r40')
}
main().catch((e) => { console.error(e); process.exit(1) })
