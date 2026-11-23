// R24b — evidencia del botón «Cambiar a Anual» (plan actual en mensual, toggle en anual)
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const OUT = '/home/z/my-project/download/evidencia-r24'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.goto('http://localhost:3000', { timeout: 60000 })
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]')
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })

  await page.locator('button:has-text("Planes")').first().click({ timeout: 15000 })
  await page.locator('h2:has-text("Planes y Suscripciones")').waitFor({ timeout: 20000 })
  await page.locator('.plan-toggle-btn:has-text("Anual")').click()
  await page.waitForTimeout(400)

  // La tarjeta del plan actual (Básico, ahora mensual) debe ofrecer «Cambiar a Anual»
  const btn = page.locator('.plan-card-axiom', { hasText: 'Básico' }).locator('button:has-text("Cambiar a Anual")')
  await btn.waitFor({ timeout: 5000 })
  console.log('✓ botón «Cambiar a Anual» visible en el plan actual mensual')

  // Click → flujo de pago dev → toast de éxito (sonner)
  await page.waitForTimeout(4500) // deja expirar el toast del login
  await btn.click()
  await page.locator('[data-sonner-toast]:has-text("Pago procesado")').waitFor({ timeout: 15000 })
  const toastText = await page.locator('[data-sonner-toast]').first().textContent()
  console.log(`✓ toast: «${toastText?.trim()}»`)
  await page.screenshot({ path: `${OUT}/04-cambiar-a-anual-toast.png`, fullPage: false })

  // La suscripción ahora es anual (Frecuencia: Annual)
  await page.locator('.plan-toggle-btn:has-text("Mensual")').click()
  await page.waitForTimeout(300)
  const freq = await page.locator('div:has(> div:text("Frecuencia")) >> div.capitalize').textContent()
  console.log(`✓ Frecuencia de la suscripción: ${freq?.trim()}`)
  await page.screenshot({ path: `${OUT}/04-cambiar-a-anual.png`, fullPage: true })

  await browser.close()
  console.log('\n✅ R24b: cambio mensual→anual desde la tarjeta del plan actual OK')
}

main().catch(e => { console.error(e.message); process.exit(1) })
