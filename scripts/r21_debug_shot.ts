/**
 * R21 — Depuración visual del diorama 3D (inglés v7).
 * Captura por pasos: vista inicial (nodo actual), giro por arrastre,
 * zoom con botones, tooltip por hover, click en ficha (vuelo + lección),
 * M2 otoño, M3 río, y noche. Uso: dev arriba → bun scripts/r21_debug_shot.ts
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const OUT = '/home/z/my-project/download/evidencia-r21'
const AUTH = 'tests/e2e/.auth/demo-state.json'
const BASE = 'http://localhost:3000'
const STEP = process.env.STEP ?? 'all'

async function openModule(page: import('@playwright/test').Page, n: number) {
  await page.goto(`${BASE}/`, { timeout: 60000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  const card = page.locator('.axiom-card', { hasText: `Módulo ${n} ·` }).first()
  await card.waitFor({ timeout: 20000 })
  await card.click()
  await card.locator('.module-cta').waitFor({ timeout: 15000 })
  await card.locator('.module-cta').click()
  await page.locator('.path-scene.has-3d-scene').waitFor({ timeout: 30000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 30000 })
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
  await page.clock.install({ time: new Date('2026-10-06T12:00:00') })

  if (!fs.existsSync(AUTH)) {
    await page.goto(`${BASE}/`, { timeout: 60000 })
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }

  // 01 — M1 pradera: vista inicial del diorama (barrido de entrada terminado)
  await openModule(page, 1)
  await page.waitForTimeout(3200) // barrido de entrada + asentamiento
  await page.screenshot({ path: `${OUT}/dbg-01-m1-inicial.png` })

  // 02 — giro por arrastre (OrbitControls)
  const canvas = page.locator('.landscape3d canvas').first()
  const box = await canvas.boundingBox()
  if (box) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await page.mouse.move(cx + 150, cy - 30, { steps: 12 })
    await page.mouse.move(cx + 240, cy + 10, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(900)
  }
  await page.screenshot({ path: `${OUT}/dbg-02-m1-girado.png` })

  // 03 — zoom con los botones +/−
  await page.locator('.d3d-zoom[aria-label="Acercar la cámara"]').click()
  await page.waitForTimeout(700)
  await page.locator('.d3d-zoom[aria-label="Acercar la cámara"]').click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/dbg-03-m1-zoom.png` })

  // 04 — hover sobre el nodo actual (ficha flotante)
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 6 })
    await page.waitForTimeout(600)
  }
  await page.screenshot({ path: `${OUT}/dbg-04-m1-hover.png` })

  // 05 — click en la ficha del nodo actual → vuelo → lección abre
  await page.locator('.axiom-node.current').first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/dbg-05-m1-vuelo.png` })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: `${OUT}/dbg-06-m1-leccion.png` })

  // 07 — M2 otoño
  await openModule(page, 2)
  await page.waitForTimeout(3200)
  await page.screenshot({ path: `${OUT}/dbg-07-m2-otono.png` })

  // 08 — M3 río con puente
  await openModule(page, 3)
  await page.waitForTimeout(3200)
  await page.screenshot({ path: `${OUT}/dbg-08-m3-rio.png` })

  // 09 — noche en M3 (luciérnagas + gema brillando)
  await page.clock.setFixedTime(new Date('2026-10-06T21:30:00'))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${OUT}/dbg-09-m3-noche.png` })

  console.log('ERRORES DE PÁGINA:', errors.length ? errors : 'ninguno')
  await browser.close()
}

main().catch((e) => { console.error('FALLO:', e); process.exit(1) }).finally(() => process.exit(0))
