/** R41-diag — atrapa el getPointAt con u inválido que crasheó en lab-celebrate */
import { chromium } from '@playwright/test'

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage()
const errors: string[] = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)))
page.on('console', (m) => { if (m.text().includes('R41-diag')) console.log('[diag]', m.text().slice(0, 500)) })

await page.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})
await page.goto('http://localhost:3000/lab-isla', { timeout: 90000 })
await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
await page.waitForFunction(
  () => (window as unknown as { __d3d?: { getLemurState?: () => string | null } }).__d3d?.getLemurState?.() != null,
  null, { timeout: 30000 },
).catch(() => {})

// instrumenta TODAS las curvas accesibles: envuelve getPointAt de la curva del rig
await page.evaluate(() => {
  const d3d = (window as unknown as {
    __d3d?: { curve?: { getPointAt: (u: number) => unknown } }
  }).__d3d
  const c = d3d?.curve
  if (!c) return
  const orig = c.getPointAt.bind(c)
  c.getPointAt = (u: number) => {
    if (typeof u !== 'number' || !Number.isFinite(u) || u < 0 || u > 1) {
      console.log('R41-diag getPointAt BAD u =', u, '| stack:', (new Error().stack ?? '').split('\n').slice(1, 4).join(' <- '))
    }
    return orig(u)
  }
})

// repite la secuencia del shots: carrera lejana + celebrate en carrera
const fp = await page.evaluate(() => {
  const d = (window as unknown as {
    __d3d?: { curve?: { getPointAt: (u: number) => { x: number; y: number; z: number }; getTangentAt: (u: number) => { x: number; z: number } } }
  }).__d3d
  const c = d?.curve
  if (!c) return null
  const p = c.getPointAt(0.85)
  const tan = c.getTangentAt(0.85)
  const pl = Math.hypot(tan.x, tan.z) || 1
  return { pos: { x: p.x - (tan.z / pl) * -0.95, y: 0.1, z: p.z + (tan.x / pl) * -0.95 }, yaw: Math.atan2(tan.x, tan.z) }
})
await page.evaluate((p) => {
  const d = (window as unknown as {
    __d3d?: { lemur?: () => { perchTo: (p: { pos: { x: number; y: number; z: number }; yaw: number }, o?: object) => void } | null }
  }).__d3d
  if (!p) return
  d?.lemur?.()?.perchTo(p, { dur: 2.6 })
}, fp)
await page.waitForTimeout(4000)
await page.evaluate(() => {
  const d = (window as unknown as { __d3d?: { lemur?: () => { celebrate: () => void } | null } }).__d3d
  d?.lemur?.()?.celebrate()
})
await page.waitForTimeout(8000)
console.log('pageerrors:', errors.length ? errors : 'ninguno')
await browser.close()
