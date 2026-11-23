// R24 — evidencia visual: tarjeta Enterprise anual («Desde $59,000/año») + anclas anuales
// Ejecutar:  bunx bun scripts/r24_evidence.ts   (dev server en :3000)
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const DEMO_EMAIL = 'admin@axiom.mx'
const DEMO_PASSWORD = 'axiom12345'
const BASE = process.env.BASE_URL || 'http://localhost:3000'
const OUT = '/home/z/my-project/download/evidencia-r24'

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))

  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await page.goto(BASE, { timeout: 60000 })
  await page.fill('input[type="email"]', DEMO_EMAIL)
  await page.fill('input[type="password"]', DEMO_PASSWORD)
  await page.click('button[type="submit"]')
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  console.log('✓ login demo')

  // Tab Planes
  await page.locator('button:has-text("Planes")').first().click({ timeout: 15000 })
  await page.locator('h2:has-text("Planes y Suscripciones")').waitFor({ timeout: 20000 })
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/01-planes-mensual.png`, fullPage: true })

  // Toggle Anual
  await page.locator('.plan-toggle-btn:has-text("Anual")').click()
  await page.waitForTimeout(400)
  const notes = await page.locator('.plan-annual-note').count()
  if (notes !== 4) throw new Error(`❌ notas anuales=${notes} (esperadas 4: Básico/Pro/Equipo/Enterprise)`)

  for (const anchor of ['$59,000/año', '$14,900/año', '$1,990/año', '$3,990/año']) {
    const visible = await page.locator(`text=${anchor}`).first().isVisible()
    if (!visible) throw new Error(`❌ ancla no visible: ${anchor}`)
    console.log(`✓ ancla visible: ${anchor}`)
  }
  const badge = await page.locator('.pill-badge:has-text("Facturación anual única")').count()
  if (badge !== 1) throw new Error(`❌ badge Facturación anual única = ${badge}`)
  console.log('✓ Enterprise anual: «Desde $59,000/año» + badge Facturación anual única')

  await page.screenshot({ path: `${OUT}/02-planes-anual-enterprise.png`, fullPage: true })

  // FAQ con anclas
  await page.locator('button:has-text("¿Qué incluye el modo anual?")').click()
  await page.waitForTimeout(300)
  const faq = await page.locator('text=Anclas anuales: Básico $1,990/año').first().isVisible()
  if (!faq) throw new Error('❌ FAQ sin anclas anuales')
  console.log('✓ FAQ con anclas anuales')
  await page.screenshot({ path: `${OUT}/03-faq-anual.png` })

  if (errors.length) throw new Error(`❌ errores de consola: ${errors.join(' | ')}`)
  console.log('✓ consola sin errores')
  await browser.close()
  console.log('\n✅ R24 evidencia visual OK → ' + OUT)
}

main().catch(e => { console.error(e.message); process.exit(1) })
