/**
 * R37 — reproducción instrumental del flujo de sesión del E2E:
 * login → storageState → nuevo contexto → goto / → diagnóstico de /api/auth,
 * cookies y vista de la app. Aísla por qué la cookie no autentica.
 * Uso: env -u DATABASE_URL bun scripts/r37_debug_session.ts <BASE>
 */
import { chromium } from '@playwright/test'

const [, , BASE = 'http://localhost:3000'] = process.argv

async function main() {
  const browser = await chromium.launch()
  // 1) contexto limpio + login (igual que beforeAll del E2E)
  const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const p1 = await ctx1.newPage()
  await p1.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  await p1.goto(`${BASE}/`, { timeout: 60000 })
  await p1.fill('input[type="email"]', 'admin@axiom.mx')
  await p1.fill('input[type="password"]', 'axiom12345')
  await p1.click('button[type="submit"]')
  await p1.locator('.axiom-hello').waitFor({ timeout: 30000 })
  console.log('[dbg] login #1 OK (.axiom-hello visible)')
  await p1.waitForTimeout(800)
  const api1 = await p1.evaluate(async () => {
    const r = await fetch('/api/auth', { credentials: 'include' })
    return { status: r.status, body: (await r.text()).slice(0, 160) }
  })
  console.log('[dbg] /api/auth en ctx1:', JSON.stringify(api1))
  await ctx1.storageState({ path: '/tmp/r37-dbg-state.json' })
  const cookies1 = await ctx1.cookies()
  console.log('[dbg] cookies ctx1:', cookies1.map(c => `${c.name}=${c.value.slice(0, 18)}…(${c.expires > 0 ? 'exp' : 'session'})`).join(' | '))

  // 2) nuevo contexto con el storageState guardado (igual que test.use)
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 }, storageState: '/tmp/r37-dbg-state.json' })
  const p2 = await ctx2.newPage()
  await p2.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  const resp = await p2.goto(`${BASE}/`, { timeout: 60000 })
  console.log('[dbg] goto / ->', resp?.status())
  await p2.waitForTimeout(2500)
  const hello = await p2.locator('.axiom-hello').count()
  console.log('[dbg] .axiom-hello count:', hello)
  const api2 = await p2.evaluate(async () => {
    const r = await fetch('/api/auth', { credentials: 'include' })
    return { status: r.status, body: (await r.text()).slice(0, 160) }
  })
  console.log('[dbg] /api/auth en ctx2:', JSON.stringify(api2))
  const cookies2 = await ctx2.cookies()
  console.log('[dbg] cookies ctx2:', cookies2.map(c => `${c.name}=${c.value.slice(0, 18)}…`).join(' | '))
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
