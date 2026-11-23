/** R41g — reproducción del NaN con clic en nodo lejano + estado del rig. */
import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage()
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 100), '\n  stack:', (e as Error).stack?.split('\n').slice(1, 5).join('\n  ')))
await page.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})
await page.goto('http://localhost:3000/', { timeout: 90000 })
try { await page.locator('.axiom-hello').waitFor({ timeout: 8000 }) } catch {
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]', { timeout: 20000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 60000 })
}
const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
await card.waitFor({ timeout: 30000 })
await card.click()
await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
await page.waitForTimeout(4000)
const hit = await page.evaluate(() => {
  const d = (window as unknown as {
    __d3d?: {
      nodeWorld?: () => { visuals: { anchor: { x: number; y: number; z: number } }[] }
      camera: { project?: unknown }
      controls: { target: { constructor: new (x: number, y: number, z: number) => { project: (c: unknown) => { x: number; y: number; z: number } } }; domElement: HTMLCanvasElement }
      rigU?: unknown
    }
  }).__d3d
  const w = d?.nodeWorld?.()
  if (!w || !d) return null
  const V = d.controls.target.constructor
  const r = d.controls.domElement.getBoundingClientRect()
  for (let i = w.visuals.length - 1; i >= 0; i--) {
    const v = w.visuals[i]
    const p = new V(v.anchor.x, v.anchor.y - 1.2, v.anchor.z).project(d.camera)
    const x = r.left + (p.x * 0.5 + 0.5) * r.width
    const y = r.top + (-p.y * 0.5 + 0.5) * r.height
    if (x > r.left + 12 && x < r.right - 12 && y > r.top + 12 && y < r.bottom - 12) return { x, y, idx: i }
  }
  return null
})
console.log('hit:', hit)
if (hit) {
  await page.mouse.click(hit.x, hit.y)
  await page.waitForTimeout(900)
  await page.waitForTimeout(3000)
}
console.log('fin')
await browser.close()
