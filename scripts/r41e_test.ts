/** R41e — test: ¿el mixer deshace la normalización? Re-imponer scale y capturar. */
import { chromium } from '@playwright/test'
import path from 'node:path'
const [, , BASE = 'http://localhost:3000'] = process.argv
const OUT = path.join(process.cwd(), 'download/evidencia-r41')
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage()
await page.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})
await page.goto(`${BASE}/lab-isla`, { timeout: 90000 })
await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
await page.waitForFunction(
  () => (window as unknown as { __d3d?: { getLemurState?: () => string | null } }).__d3d?.getLemurState?.() != null,
  null, { timeout: 30000 },
).catch(() => {})
await page.waitForTimeout(1000)
await page.evaluate(() => {
  const rig = (window as unknown as { __d3d?: { lemur?: () => { group: { position: { x: number; y: number; z: number }; children: { scale: { x: number; y: number; z: number }; position: { x: number; y: number; z: number }; name: string; scaleMode: unknown }[] } } | null } }).__d3d?.lemur?.()
  if (!rig) return
  const model = rig.group.children[0] as unknown as { scale: { setScalar: (s: number) => void }; name: string }
  model.scale.setScalar(0.0048)
})
// captura INMEDIATA (antes de que el mixer pueda volver a sobreescribir)
await page.screenshot({ path: path.join(OUT, 'r41e-forced.png') })
console.log('captura forzada lista')
await page.waitForTimeout(2500)
await page.screenshot({ path: path.join(OUT, 'r41e-after2s.png') })
console.log('captura tras 2.5s lista')
await browser.close()
