/**
 * R22 — Evidencia del corrector corregido (inglés v7).
 * Recorre la sesión del nodo 5 (m1-v2 «Sonidos básicos del inglés»), responde
 * un ejercicio de TRADUCCIÓN con la traducción literal completa (con artículo,
 * el caso «the family» del usuario) leyendo la respuesta del banco, y captura:
 *   01 → respuesta literal tecleada en el input
 *   02 → feedback «Correcto» (antes se rechazaba por el bug invertido)
 *   03 → sesión registrada («Sesión 2 registrada»)
 * Uso: bun scripts/r22_evidence.ts  (requiere dev server en :3000)
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import { COURSE_MODULES, bankForLesson } from '../src/lib/books/index'

const OUT = '/home/z/my-project/download/evidencia-r22'
const AUTH = 'tests/e2e/.auth/demo-state.json'
const BASE = 'http://localhost:3000'

// pares es->en del nodo 5 (m1-v2): para teclear la traducción EXACTA del banco
const mod = COURSE_MODULES.find(m => m.code === 'm1')!
const lesson5 = mod.lessons.find(l => l.key === 'm1-v2')!
const bank = bankForLesson(`m1-v2`)!
const pairMap = new Map((bank.content.pairs || []).map(p => [p.es.toLowerCase().trim(), p.en]))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    storageState: fs.existsSync(AUTH) ? AUTH : { cookies: [], origins: [] },
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  if (!fs.existsSync(AUTH)) {
    await page.goto(`${BASE}/`, { timeout: 60000 })
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
    await ctx.storageState({ path: AUTH })
  }

  // Camino del Módulo 1: el nodo 5 debe estar en «Sesión 2 de 3»
  await page.goto(`${BASE}/`, { timeout: 60000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 30000 })
  const card = page.locator('.axiom-card', { hasText: 'Módulo 1 ·' }).first()
  await card.waitFor({ timeout: 20000 })
  await card.click()
  await card.locator('.module-cta:not([disabled])').waitFor({ timeout: 15000 })
  await card.locator('.module-cta:not([disabled])').click()
  await page.locator('.node-sub', { hasText: 'Sesión 2 de 3' }).waitFor({ timeout: 30000 })
  await page.locator('.axiom-node.current').first().click()

  // Warm-up (3 ítems SRS)
  await page.getByRole('button', { name: 'Mostrar respuesta' }).first().waitFor({ timeout: 30000 })
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Mostrar respuesta' }).click({ timeout: 15000 })
    await page.locator('.srs-grade').first().click({ timeout: 10000 })
    await page.waitForTimeout(250)
  }

  // Historia → Continuar
  await page.locator('.audio-player').waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: /Continuar/ }).click({ timeout: 10000 })

  // Descubre (2 preguntas, autoavance)
  await page.locator('.notice-quote').first().waitFor({ timeout: 20000 })
  for (let i = 0; i < 2; i++) {
    await page.locator('.option-btn').first().click({ timeout: 10000 })
    await page.waitForTimeout(1200)
  }

  // Práctica: 6 ejercicios; en translate, teclear la traducción literal del banco
  await page.locator('.stage-chip.current', { hasText: 'Práctica' }).waitFor({ timeout: 20000 })
  let captured = 0
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(450)
    const translateLabel = page.getByText('Traduce al inglés').first()
    if ((await translateLabel.count()) && captured < 2) {
      const es = (await page.locator('p.text-base').first().textContent())?.trim() || ''
      const en = pairMap.get(es.toLowerCase().trim()) || es
      const box = page.locator('textarea').first()
      await box.fill(en)
      await page.screenshot({ path: `${OUT}/r22-0${++captured}-translate-tecleado.png` })
      await page.getByRole('button', { name: 'Verificar' }).click({ timeout: 5000 })
      await page.locator('.attempt-feedback.ok').waitFor({ timeout: 5000 })
      await page.screenshot({ path: `${OUT}/r22-0${++captured}-translate-correcto.png` })
      await page.locator('.attempt-feedback .btn-tactile').click({ timeout: 5000 })
    } else {
      const option = page.locator('.option-btn:not([disabled])').first()
      if (await option.count()) {
        await option.click({ timeout: 10000 })
      } else {
        const target = page.locator('input:not([disabled]), textarea:not([disabled])').last()
        await target.fill('answer', { timeout: 5000 }).catch(() => {})
        await page.getByRole('button', { name: /Verificar|Responder/ }).click({ timeout: 5000 }).catch(() => {})
      }
      await page.locator('.attempt-feedback').waitFor({ timeout: 10000 })
      await page.locator('.attempt-feedback .btn-tactile').click({ timeout: 5000 })
    }
  }

  // Producción → terminar sesión
  const writing = page.locator('textarea').first()
  await writing.waitFor({ timeout: 20000 })
  await writing.fill('My name is Ana. I am a student and I live with my family.')
  await page.getByRole('button', { name: 'Lo dije sin micrófono' }).click()
  await page.getByRole('button', { name: /Terminar sesión/ }).click({ timeout: 10000 })
  await page.getByText('Sesión 2 registrada').waitFor({ timeout: 20000 })
  await page.screenshot({ path: `${OUT}/r22-05-sesion-registrada.png` })

  await browser.close()
  console.log(`✓ Evidencia R22 lista (${captured} translates capturados) en ${OUT}`)
}

main().catch(e => { console.error('✗', e); process.exit(1) })
