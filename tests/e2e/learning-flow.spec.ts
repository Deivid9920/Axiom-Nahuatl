import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'

// E2E de Axiom (inglés): autenticación, camino de módulos CEFR, perfil y RBAC.
// Sin dependencias de servicios externos (LLM/TTS): sólo interfaz y sesión.
// La autenticación se realiza UNA sola vez y se reutiliza vía storageState:
// el rate limiter de login permite 5 intentos/15 min por IP.

const DEMO_EMAIL = 'admin@axiom.mx'
const DEMO_PASSWORD = 'axiom12345'
const AUTH_DIR = 'tests/e2e/.auth'
const AUTH_FILE = `${AUTH_DIR}/demo-state.json`

// El tour de onboarding aparece en la primera sesión; se marca como visto
// para que las pruebas evalúen el flujo principal de forma determinista.
async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('axiom-onboarding-done', 'true')
  })
}

async function login(page: Page, email: string, password: string) {
  // Timeout holgado: la primera compilación de la página en `next dev` es lenta
  await page.goto('/', { timeout: 60000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // El saludo de la maqueta muestra el nombre de usuario gigante (.axiom-hello)
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
}

test.beforeAll(async ({ browser }, testInfo) => {
  // La primera compilación en `next dev` puede tardar más que el hook por defecto
  testInfo.setTimeout(120000)
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  // Contexto limpio: el storageState de test.use aún no existe en beforeAll
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await ctx.newPage()
  await skipOnboarding(page)
  await login(page, DEMO_EMAIL, DEMO_PASSWORD)
  await ctx.storageState({ path: AUTH_FILE })
  await ctx.close()
})

// Todas las pruebas heredan la sesión demo; el registro usa su propio bloque
// con sesión limpia (test.use a nivel de describe).
test.use({ storageState: AUTH_FILE })

test('la sesión demo conservada entra al panel con permisos de administración', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  await expect(page.locator('.sidebar-link', { hasText: 'Panel' })).toBeVisible()
})

test.describe('registro con sesión limpia', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('registro de cuenta nueva entra al panel sin permisos de administración', async ({ page }) => {
    await skipOnboarding(page)
    // Timeout holgado: la primera compilación de la página en `next dev` es lenta
    await page.goto('/', { timeout: 60000 })
    await page.getByRole('tab', { name: 'Registrarse' }).click()
    await page.fill('input#name', 'Persona E2E')
    await page.fill('input[type="email"]', `e2e-${Date.now()}@test.com`)
    // La política exige mayúscula, minúscula, número y carácter especial
    await page.fill('input[type="password"]', 'Axiom!Test42')
    await page.click('button[type="submit"]')
    await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
    // Una cuenta recién creada no administra
    await expect(page.locator('.sidebar-link', { hasText: 'Panel' })).toHaveCount(0)
  })
})

test('el barside no muestra las habilidades: sólo módulos vía Inicio', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  // Las entradas de habilidades desaparecieron del barside (viven en los nodos)
  await expect(page.locator('.sidebar-link', { hasText: 'Conversación' })).toHaveCount(0)
  await expect(page.locator('.sidebar-link', { hasText: 'Lectura' })).toHaveCount(0)
  await expect(page.locator('.sidebar-link', { hasText: 'Escritura' })).toHaveCount(0)
  await expect(page.locator('.sidebar-link', { hasText: 'Voz' })).toHaveCount(0)
  // Y quedan Inicio, Avance, Premium y Planes
  await expect(page.locator('.sidebar-link', { hasText: 'Inicio' })).toBeVisible()
  await expect(page.locator('.sidebar-link', { hasText: 'Avance' })).toBeVisible()
})

test('la tarjeta del Módulo 1 abre su menú de temas y el camino', async ({ page }) => {
  await skipOnboarding(page)
  // Registro de respuestas del plan para depurar fallos intermitentes
  page.on('response', res => {
    if (res.url().includes('/api/adaptive/plan') && !res.ok()) {
      console.log(`[plan ${res.status()}]`, res.request().method())
    }
  })
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  // R36: la tarjeta abre el camino del módulo con un clic (sin menú de temas)
  const card = page.locator('.axiom-card', { hasText: 'Módulo 1 ·' }).first()
  await expect(card).toBeVisible({ timeout: 20000 })
  await card.click()
  await expect(page.getByText(/Nivel A1/).first()).toBeVisible({ timeout: 30000 })
})

test('navegación a Avance y al Perfil', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  await page.locator('.sidebar-link', { hasText: 'Avance' }).click()
  await expect(page.getByText('Tus Métricas').first()).toBeVisible({ timeout: 30000 })
  // El bloque del usuario conectado (sidebar expandida) redirige al perfil
  await page.locator('button[aria-label="Alternar menú lateral"]').click()
  await page.locator('button[aria-label="Abrir mi perfil"]').click()
  await expect(page.getByText('Modificador de plan').first()).toBeVisible({ timeout: 30000 })
})

test('el botón de modo día/noche alterna el tema', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  const toggle = page.locator('.theme-toggle-axiom')
  await expect(toggle).toBeVisible()
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'))
  await toggle.click()
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).not.toBe(before)
})

// ===== R15: sesión inmersiva completa (warmup SRS → historia → descubre →
// práctica → produce) + gating de dominio visible en el camino =====

// Responde un ejercicio del banco: cubre MCQ (opciones), hueco/traducción/
// diálogo/dictado (texto) y ordenar (chips). El avance vive en .attempt-feedback.
async function answerOneExercise(page: Page) {
  await page.waitForTimeout(400)

  const option = page.locator('.option-btn:not([disabled])').first()
  const wordChip = page.locator('.word-chip:not([disabled])').first()
  // Sólo los botones que validan (el «Escuchar» del dictado no valida)
  const verify = page.getByRole('button', { name: /Verificar|Responder/ }).first()

  if (await option.count()) {
    await option.click({ timeout: 10000 })
  } else if (await wordChip.count()) {
    // Ordenar: coloca todas las palabras disponibles
    for (let i = 0; i < 8; i++) {
      if (!(await wordChip.count())) break
      await wordChip.click({ timeout: 3000 })
    }
    if (await verify.count()) await verify.click({ timeout: 5000 })
  } else if (await verify.count()) {
    // Hueco / dictado / traducción: escribe algo plausible y verifica
    const target = page.locator('input:not([disabled]), textarea:not([disabled])').last()
    await target.fill('answer', { timeout: 5000 }).catch(() => {})
    await verify.click({ timeout: 5000 })
  }

  // Avanzar desde el feedback
  const next = page.locator('.attempt-feedback .btn-tactile')
  await expect(next).toBeVisible({ timeout: 10000 })
  await next.click({ timeout: 5000 })
}

test('una sesión inmersiva completa registra el gating del nodo', async ({ page }) => {
  // Flujo largo (5 etapas + compilaciones de dev): timeout propio holgado
  test.setTimeout(180000)
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })

  // El demo viene colocado: el overlay de colocación no debe aparecer
  await expect(page.locator('.placement-overlay')).toHaveCount(0)

  // Tarjeta del Módulo 1 → camino (R36: clic directo, sin menú de temas)
  const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
  await expect(card).toBeVisible({ timeout: 20000 })
  await card.click()
  await expect(page.locator('.axiom-node.current').first()).toBeVisible({ timeout: 30000 })

  // El nodo en curso muestra la sesión que toca (el demo trae 1 de 3 hecha)
  await expect(page.locator('.node-sub', { hasText: 'Sesión 2 de 3' })).toBeVisible({ timeout: 10000 })
  await page.locator('.axiom-node.current').first().click()

  // Etapa 1 — warm-up SRS (3 ítems vencidos del seed)
  const showAnswer = page.getByRole('button', { name: 'Mostrar respuesta' })
  await expect(showAnswer.first()).toBeVisible({ timeout: 30000 })
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Mostrar respuesta' }).click({ timeout: 15000 })
    await page.locator('.srs-grade').first().click({ timeout: 10000 })
    await page.waitForTimeout(250)
  }

  // Etapa 2 — historia con reproductor de audio
  await expect(page.locator('.audio-player')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.story-card')).toBeVisible()
  await page.getByRole('button', { name: /Continuar/ }).click({ timeout: 10000 })

  // Etapa 3 — descubrimiento en contexto (2 preguntas, autoavance)
  await expect(page.locator('.notice-quote').first()).toBeVisible({ timeout: 20000 })
  for (let i = 0; i < 2; i++) {
    await page.locator('.option-btn').first().click({ timeout: 10000 })
    await page.waitForTimeout(1200)
  }

  // Etapa 4 — práctica del banco (6 ejercicios)
  await expect(page.locator('.stage-chip.current', { hasText: 'Práctica' })).toBeVisible({ timeout: 20000 })
  for (let i = 0; i < 6; i++) await answerOneExercise(page)

  // Etapa 5 — producción: escritura + marcado sin micrófono
  const writing = page.locator('textarea').first()
  await expect(writing).toBeVisible({ timeout: 20000 })
  await writing.fill('My name is Lupita. I am an engineer and I live in York with my friend.')
  await page.getByRole('button', { name: 'Lo dije sin micrófono' }).click()
  await page.getByRole('button', { name: /Terminar sesión/ }).click({ timeout: 10000 })

  // Resumen: sesión 2 registrada, aún sin checkpoint (va en la 3.ª)
  await expect(page.getByText('Sesión 2 registrada')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText(/Te faltan 1 sesión/)).toBeVisible()
  await page.getByRole('button', { name: /Volver al camino/ }).click()

  // Gating visible: el nodo sigue sin completar y anuncia la última sesión
  await expect(page.locator('.node-sub', { hasText: 'Sesión 3 de 3' })).toBeVisible({ timeout: 20000 })
})
