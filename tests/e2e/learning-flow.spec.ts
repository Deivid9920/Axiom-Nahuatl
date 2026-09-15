import { test, expect, type Page } from '@playwright/test'

// E2E de Axiom (náhuatl): autenticación, navegación de módulos y RBAC.
// Sin dependencias de servicios externos (LLM/TTS): sólo interfaz y sesión.

const DEMO_EMAIL = 'admin@axiom.mx'
const DEMO_PASSWORD = 'axiom12345'

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
  await expect(page.getByText(/Hola,/).first()).toBeVisible({ timeout: 30000 })
}

test('inicio de sesión con credenciales demo', async ({ page }) => {
  await skipOnboarding(page)
  await login(page, DEMO_EMAIL, DEMO_PASSWORD)
})

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
  await expect(page.getByText(/Hola,/).first()).toBeVisible({ timeout: 30000 })
  // Una cuenta recién creada no administra
  await expect(page.locator('.sidebar-link', { hasText: 'Panel Admin' })).toHaveCount(0)
})

test('el panel Admin sólo es visible para administradores', async ({ page }) => {
  await skipOnboarding(page)
  await login(page, DEMO_EMAIL, DEMO_PASSWORD)
  await expect(page.locator('.sidebar-link', { hasText: 'Panel Admin' })).toBeVisible()
})

test('navegación al módulo de Escucha', async ({ page }) => {
  await skipOnboarding(page)
  await login(page, DEMO_EMAIL, DEMO_PASSWORD)
  await page.locator('.sidebar-link', { hasText: 'Escucha' }).click()
  await expect(page.getByText('Comprensión').first()).toBeVisible({ timeout: 15000 })
})

test('navegación a Métricas', async ({ page }) => {
  await skipOnboarding(page)
  await login(page, DEMO_EMAIL, DEMO_PASSWORD)
  await page.locator('.sidebar-link', { hasText: 'Métricas' }).click()
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })
})
