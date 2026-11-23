// R18 — Evidencia visual v7: hojas 3D con viento, agua 3D con olas, globo del viaje, mascota 3D y A lenta
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'
const OUT = '/home/z/my-project/scripts'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-MX' })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  // 0) La «A» más lenta (drawLine 5.4s) y botones más fluidos
  console.log('A duración:', await page.evaluate(() => {
    const el = document.querySelector('.logo-svg .l-line') as HTMLElement | null
    return el ? getComputedStyle(el).animationDuration : 'no-logo'
  }))
  console.log('transición botón login:', await page.evaluate(() => {
    const el = document.querySelector('button[type="submit"]') as HTMLElement | null
    return el ? getComputedStyle(el).transitionDuration : 'no-btn'
  }))

  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.axiom-hello', { timeout: 60000 })
  const skip = page.locator('button:has-text("Saltar")')
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(400) }
  console.log('transición CTA módulo:', await page.evaluate(() => {
    const el = document.querySelector('.module-cta') as HTMLElement | null
    return el ? getComputedStyle(el).transitionDuration : 'aún sin CTA'
  }))

  // 1) Mascota 3D (tecolote low-poly con canvas WebGL)
  await page.waitForTimeout(1800)
  console.log('mascota 3D canvas:', await page.locator('canvas.mascot-3d').count(),
    '· burbuja:', await page.locator('.mascota-bubble').count() > 0)
  await page.screenshot({ path: `${OUT}/r18-1-mascota3d.png` })

  // 2) Hojas 3D con viento en el camino del M1 (pradera)
  const card1 = page.locator('.axiom-card', { hasText: 'Módulo 1 ·' }).first()
  await card1.click()
  await card1.locator('.module-cta').click()
  await page.waitForSelector('.path-scene', { timeout: 60000 })
  await page.waitForSelector('.scene3d-leaves canvas', { timeout: 15000 })
  await page.waitForTimeout(1400)
  const scene1 = page.locator('.path-scene').first()
  console.log('M1 fase:', await scene1.getAttribute('data-phase'),
    '· hojas3D:', await page.locator('.scene3d-leaves canvas').count(),
    '· has-3d-leaves:', (await scene1.getAttribute('class'))?.includes('has-3d-leaves'),
    '· partículas CSS retiradas:', await page.locator('.scene-particles').count() === 0)
  await page.screenshot({ path: `${OUT}/r18-2-m1-hojas3d.png` })

  // 3) Agua 3D con olas en el camino del M3 (río)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.axiom-hello', { timeout: 60000 })
  const card3 = page.locator('.axiom-card', { hasText: 'Módulo 3 ·' }).first()
  await card3.click()
  await card3.locator('.module-cta').click()
  await page.waitForSelector('.path-scene', { timeout: 60000 })
  await page.waitForSelector('.scene3d-water canvas', { timeout: 15000 })
  await page.locator('.scene3d-water').first().scrollIntoViewIfNeeded()
  await page.waitForTimeout(1600)
  const scene3 = page.locator('.path-scene').first()
  const waveHidden = await page.evaluate(() => {
    const w = document.querySelector('.river-wave') as HTMLElement | null
    return w ? getComputedStyle(w).display === 'none' : 'sin-wave-svg'
  })
  console.log('M3 fase:', await scene3.getAttribute('data-phase'),
    '· agua3D:', await page.locator('.scene3d-water canvas').count(),
    '· has-3d-water:', (await scene3.getAttribute('class'))?.includes('has-3d-water'),
    '· olas SVG ocultas:', waveHidden)
  await page.screenshot({ path: `${OUT}/r18-3-m3-agua3d.png` })
  // 4) Globo 3D del viaje en Avance (arrastrable)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.axiom-hello', { timeout: 60000 })
  await page.locator('.sidebar-link', { hasText: 'Avance' }).click()
  await page.waitForSelector('.globe3d-wrap canvas', { timeout: 30000 })
  await page.waitForTimeout(1800)
  const gl = page.locator('.globe3d-wrap canvas').first()
  const bb = await gl.boundingBox()
  if (bb) {
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2)
    await page.mouse.down()
    await page.mouse.move(bb.x + bb.width / 2 - 150, bb.y + bb.height / 2 + 40, { steps: 10 })
    await page.mouse.up()
  }
  await page.waitForTimeout(500)
  console.log('hint globo:', await page.locator('.globe3d-hint').innerText().catch(() => 'NO'),
    '· chips:', await page.locator('.tm-chip').count())
  await page.screenshot({ path: `${OUT}/r18-4-globo-viaje.png` })

  // 5) M2 otoño: hojas ámbar en 3D
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.axiom-hello', { timeout: 60000 })
  const card2 = page.locator('.axiom-card', { hasText: 'Módulo 2 ·' }).first()
  await card2.click()
  await card2.locator('.module-cta').click()
  await page.waitForSelector('.path-scene', { timeout: 60000 })
  await page.waitForSelector('.scene3d-leaves canvas', { timeout: 15000 })
  await page.waitForTimeout(1400)
  console.log('M2 hojas3D:', await page.locator('.scene3d-leaves canvas').count())
  await page.screenshot({ path: `${OUT}/r18-5-m2-otono3d.png` })

  console.log('errores de página:', errors.length ? errors.slice(0, 5) : 'ninguno')
  await browser.close()
}

main().catch(e => { console.error('FALLO EVIDENCIA:', e); process.exit(1) })
