// R17 — Evidencia visual de las 5 mejoras (Playwright)
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'
const OUT = '/home/z/my-project/scripts'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'es-MX' })
  const page = await ctx.newPage()

  // Login
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.axiom-hello', { timeout: 60000 })

  // OnboardingTour: saltar si aparece (contexto de navegador fresco)
  const skip = page.locator('button:has-text("Saltar")')
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(400) }

  // 1) Mascota saludando (burbuja tras ~1.1s)
  await page.waitForTimeout(1600)
  const bubble = await page.locator('.mascota-bubble').count()
  console.log('mascota burbuja visible:', bubble > 0)
  await page.screenshot({ path: `${OUT}/r17_dashboard_mascota.png` })

  // 2) Camino del M1 — escena nocturna (hora local ~22:5x = night)
  await page.click('text=Módulo 1 · Supervivencia lingüística')
  await page.click('text=Repasar módulo 1')
  await page.waitForSelector('.path-scene', { timeout: 60000 })
  await page.waitForTimeout(900)
  const phase = await page.locator('.path-scene').first().getAttribute('data-phase')
  const stars = await page.locator('.scene-stars span').count()
  const fireflies = await page.locator('.scene-fireflies .firefly').count()
  const orb = await page.locator('.scene-orb').count()
  console.log('fase:', phase, '· estrellas:', stars, '· luciérnagas:', fireflies, '· orbe:', orb)
  const btn = page.locator('.scene-sound').first()
  console.log('botón sonido aria-pressed:', await btn.getAttribute('aria-pressed'))
  await btn.click() // activar sonido (crea AudioContext)
  await page.waitForTimeout(600)
  console.log('botón sonido tras clic:', await btn.getAttribute('aria-pressed'))
  await page.screenshot({ path: `${OUT}/r17_m1_noche.png` })

  // 3) Constancia desde el banner (M1 completado)
  const certBtn = page.locator('.cert-inline-btn')
  console.log('botón constancia en banner:', await certBtn.count())
  if (await certBtn.count()) {
    await certBtn.click()
    await page.waitForSelector('.cert-sheet', { timeout: 15000 })
    await page.waitForTimeout(500)
    const folio = await page.locator('.cert-folio').innerText()
    const name = await page.locator('.cert-name').innerText()
    console.log('constancia folio:', folio, '· nombre:', name)
    await page.screenshot({ path: `${OUT}/r17_constancia.png` })
    await page.click('.cert-actions button:has-text("Cerrar")')
    await page.waitForTimeout(300)
  }

  // 4) Avance — mapa del viaje México → York
  await page.click('.sidebar-link:has-text("Avance")')
  await page.waitForSelector('.travel-svg', { timeout: 60000 })
  await page.waitForTimeout(1300)
  const doneStops = await page.locator('.travel-svg circle[fill="#14A085"]').count()
  const summary = await page.locator('.travel-map p.text-xs').first().innerText()
  console.log('paradas completadas (círculos teal):', doneStops, '· resumen:', summary)
  await page.screenshot({ path: `${OUT}/r17_avance_mapa.png` })
  await page.screenshot({ path: `${OUT}/r17_avance_mapa_full.png`, fullPage: true })

  // 5) M2 otoño (disponible) — escena nocturna de otoño
  await page.click('.sidebar-link:has-text("Inicio")')
  await page.waitForTimeout(600)
  await page.click('text=Módulo 2 · Vida cotidiana básica')
  await page.click('text=Empezar módulo 2')
  await page.waitForSelector('.path-scene', { timeout: 60000 })
  await page.waitForTimeout(900)
  const phase2 = await page.locator('.path-scene').first().getAttribute('data-phase')
  console.log('M2 fase:', phase2)
  await page.screenshot({ path: `${OUT}/r17_m2_noche.png` })

  await browser.close()
  console.log('EVIDENCIA R17 COMPLETA')
}

main().catch(e => { console.error('FALLO:', e.message); process.exit(1) })
