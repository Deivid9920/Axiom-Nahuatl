/** R39 — sonda del clic al nodo final en la app real (stack de pageerror) */
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage()
page.on('pageerror', e => console.log('PAGEERROR STACK:\n', e.stack ?? String(e)))
await page.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  ;(Date.prototype as unknown as { getMinutes: () => number }).getMinutes = () => 0
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})
await page.goto(`${BASE}/`, { timeout: 90000 })
try {
  await page.locator('.axiom-hello').waitFor({ timeout: 8000 })
} catch {
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]', { timeout: 20000 })
  await page.locator('.axiom-hello').waitFor({ timeout: 60000 })
}
const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
await card.waitFor({ timeout: 30000 })
await card.click()
await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
await page.waitForTimeout(3400)

const hit = await page.evaluate(() => {
  const d = (window as unknown as {
    __d3d?: {
      nodeWorld?: () => { visuals: { anchor: { x: number; y: number; z: number } }[]; hits: { userData: { d3dId: string } }[] }
      camera: unknown
      controls: { target: { constructor: new (x: number, y: number, z: number) => { project: (c: unknown) => { x: number; y: number; z: number } } }; domElement: HTMLCanvasElement }
    }
  }).__d3d
  const w = d?.nodeWorld?.()
  if (!w || !d) return null
  const V = d.controls.target.constructor
  const r = d.controls.domElement.getBoundingClientRect()
  // el nodo más lejano cuyo hit-sphere proyecte DENTRO del canvas (el final
  // puede quedar fuera de cuadro tras el banner)
  for (let i = w.visuals.length - 1; i >= 0; i--) {
    const v = w.visuals[i]
    const p = new V(v.anchor.x, v.anchor.y - 1.2, v.anchor.z).project(d.camera)
    const x = r.left + (p.x * 0.5 + 0.5) * r.width
    const y = r.top + (-p.y * 0.5 + 0.5) * r.height
    if (x > r.left + 12 && x < r.right - 12 && y > r.top + 12 && y < r.bottom - 12) {
      console.log('picked visual', i, 'id=', w.hits[i]?.userData.d3dId, 'at', x.toFixed(0), y.toFixed(0))
      return { x, y }
    }
  }
  return null
})
console.log('hit coords:', JSON.stringify(hit))
if (hit) {
  const topEl = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    return el ? `${el.tagName}.${(el.className && typeof el.className === 'string') ? el.className.slice(0, 60) : ''}` : 'none'
  }, [hit.x, hit.y])
  console.log('elementFromPoint:', topEl)
  await page.mouse.move(hit.x, hit.y)
  await page.waitForTimeout(700)
  const hover = await page.evaluate(() => ({
    tip: !!document.querySelector('.d3d-tip.on'),
    cursor: (document.querySelector('.landscape3d canvas') as HTMLCanvasElement | null)?.style.cursor ?? '',
  }))
  console.log('hover:', JSON.stringify(hover))
  await page.mouse.click(hit.x, hit.y)
  await page.waitForTimeout(900)
  const st = await page.evaluate(() => {
    const d3d = (window as unknown as { __d3d?: { getRavenState?: () => string; getMode?: () => string } }).__d3d
    return { raven: d3d?.getRavenState?.(), mode: d3d?.getMode?.() }
  })
  console.log('after click:', JSON.stringify(st))
}
await page.waitForTimeout(2500)
await browser.close()
