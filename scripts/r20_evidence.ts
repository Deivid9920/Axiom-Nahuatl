/**
 * R20 — Evidencia del Estudio Premium y los Planes nuevos (inglés v7).
 * Captura: planes (mensual/anual/comparativa/FAQ/ventas), premium (redacción con
 * resultado LLM en vivo, entrevista, reunión, biblioteca). Consola sin errores.
 * Uso: dev server arriba en :3000 → bun scripts/r20_evidence.ts
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const OUT = '/home/z/my-project/download/evidencia-r20'
const AUTH = 'tests/e2e/.auth/demo-state.json'
const BASE = 'http://localhost:3000'

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
  if (!fs.existsSync(AUTH)) {
    await page.goto(`${BASE}/`, { timeout: 60000 })
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }

  // 1 — Planes: tarjetas con precios R20 (Pro héroe, Equipo $1,490, Enterprise desde $5,900)
  await page.goto(`${BASE}/`, { timeout: 60000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  await page.locator('.sidebar-link', { hasText: 'Planes' }).click()
  await page.getByText('Planes y Suscripciones').waitFor({ timeout: 20000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/r20-1-planes-mensual.png` })

  // 2 — Toggle anual con 2 meses gratis
  await page.locator('.plan-toggle-btn', { hasText: 'Anual' }).click()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/r20-2-planes-anual.png` })
  await page.locator('.plan-toggle-btn', { hasText: 'Mensual' }).click()

  // 3 — Tabla comparativa
  await page.getByText('Compara los planes').click()
  await page.locator('.compare-table').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  await page.locator('.compare-table').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/r20-3-planes-comparativa.png` })

  // 4 — FAQ + franja de confianza
  await page.getByText('Preguntas frecuentes').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/r20-4-planes-faq-confianza.png` })

  // 5 — Modal Hablar con ventas
  await page.getByRole('button', { name: /Hablar con ventas/ }).first().click()
  await page.locator('.lead-modal').waitFor({ timeout: 8000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/r20-5-ventas-modal.png` })
  await page.locator('.lead-modal .r20-icon-btn').click()

  // 6 — Premium: Estudio de Redacción con galería de plantillas
  await page.locator('.sidebar-link', { hasText: 'Premium' }).click()
  await page.getByText('Estudio Profesional').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/r20-6-premium-redaccion.png` })

  // 7 — Redacción en vivo: borrador → IA → rúbrica + CEFR + correcciones
  await page.locator('textarea').first().fill(
    'Hi Ms. Garcia, i am writing for ask about the status of my internship application. ' +
    'I send my documents last week and i want to know if you received it. Please let me know if you need more information. Thanks for you time.'
  )
  await page.getByRole('button', { name: /Redactar con IA/ }).click()
  console.log('esperando resultado del LLM…')
  await page.locator('.rubric-grid').first().waitFor({ timeout: 150000 })
  await page.waitForTimeout(1200)
  await page.locator('.rubric-grid').first().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${OUT}/r20-7-premium-resultado-rubrica.png` })
  // guarda en biblioteca para P5
  await page.locator('button[title="Guardar en biblioteca"]').click()
  await page.getByText('Guardado en tu biblioteca').waitFor({ timeout: 10000 }).catch(() => console.log('toast de guardado no visto'))

  // 8 — Entrevista: configuración
  await page.locator('.studio-tab', { hasText: 'Entrevista' }).click()
  await page.getByText('Configura tu entrevista').waitFor({ timeout: 10000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/r20-8-premium-entrevista.png` })

  // 9 — Reunión: configuración
  await page.locator('.studio-tab', { hasText: 'Reunión' }).click()
  await page.getByText('Configura tu reunión').waitFor({ timeout: 10000 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/r20-9-premium-reunion.png` })

  // 10 — Biblioteca con el borrador guardado
  await page.getByRole('button', { name: 'Biblioteca' }).click()
  await page.locator('.lib-drawer').waitFor({ timeout: 10000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: `${OUT}/r20-10-premium-biblioteca.png` })

  console.log('errores de consola:', errors.length ? errors : 'ninguno')
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
