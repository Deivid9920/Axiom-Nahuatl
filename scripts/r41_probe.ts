/**
 * R41 — sonda de diagnóstico del lémur en la página real (/lab-isla):
 *  1. ¿El SkinnedMesh existe en la escena? ¿visible, culled, escala?
 *  2. ¿Dónde apuntan sus huesos (mundo)? ¿boundingSphere efectivo?
 *  3. Fuerza frustumCulled=false + opacidad, apunta la cámara al lémur y captura.
 * Uso: bun scripts/r41_probe.ts <BASE>
 */
import { chromium } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const [, , BASE = 'http://localhost:3000'] = process.argv
const OUT = path.join(process.cwd(), 'download/evidencia-r41')
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
page.on('console', m => console.log('[browser]', m.text().slice(0, 400)))
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)))
await page.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})

await page.goto(`${BASE}/lab-isla`, { timeout: 90000 })
await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
await page.waitForFunction(
  () => (window as unknown as { __d3d?: { getLemurState?: () => string | null } }).__d3d?.getLemurState?.() != null,
  null, { timeout: 30000 },
).catch(() => console.log('lémur no cargó'))

const diag = await page.evaluate(() => {
  const d = (window as unknown as {
    __d3d?: { world?: () => unknown; scene?: () => unknown; lemur?: () => { group: { position: { x: number; y: number; z: number } } } | null }
  }).__d3d
  const out: unknown[] = []
  const root = (d?.world?.() ?? d?.scene?.()) as { traverse?: (f: (o: never) => void) => void } | undefined
  // recorre buscando SkinnedMesh
  let skinned = 0
  const walk = (o: { isSkinnedMesh?: boolean; isMesh?: boolean; name?: string; visible?: boolean; frustumCulled?: boolean; count?: number; geometry?: { boundingSphere?: { center: { x: number; y: number; z: number }; radius: number } | null }; material?: { opacity?: number; transparent?: boolean; color?: { getHexString: () => string }; map?: unknown }; matrixWorld?: { elements: number[]; getMaxScaleOnAxis: () => number }; getWorldPosition?: (v: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }) => void }) => {
    if (o.isSkinnedMesh) {
      skinned++
      out.push({
        name: o.name,
        visible: o.visible,
        frustumCulled: o.frustumCulled,
        worldScale: o.matrixWorld?.getMaxScaleOnAxis(),
        geoBS: o.geometry?.boundingSphere ? { c: o.geometry.boundingSphere.center, r: +o.geometry.boundingSphere.radius.toFixed(1) } : null,
        opacity: o.material && !Array.isArray(o.material) ? o.material.opacity : 'multi',
        transparent: o.material && !Array.isArray(o.material) ? o.material.transparent : 'multi',
        hasMap: !!(o.material && !Array.isArray(o.material) && o.material.map),
      })
    }
  }
  root?.traverse?.(walk as never)
  const lemur = d?.lemur?.()
  return { skinned, info: out, lemurPos: lemur ? { ...lemur.group.position } : null }
})
console.log('DIAG:', JSON.stringify(diag, null, 2))

// fuerza visibilidad + apunta cámara al lémur y captura
await page.evaluate(() => {
  const d = (window as unknown as {
    __d3d?: {
      world?: () => { traverse?: (f: (o: {
        isMesh?: boolean; isSkinnedMesh?: boolean; frustumCulled?: boolean
        material?: { opacity: number; transparent: boolean; needsUpdate?: boolean }
        matrixWorld?: { getMaxScaleOnAxis: () => number }
      }) => void) => void }
      lemur?: () => { group: { position: { x: number; y: number; z: number } } } | null
      controls: { target: { set: (x: number, y: number, z: number) => void } }
      camera: { position: { set: (x: number, y: number, z: number) => void }; lookAt: (t: unknown) => void }
    }
  }).__d3d
  const w = d?.world?.()
  w?.traverse?.((o) => {
    if (o.isMesh) {
      o.frustumCulled = false
      if (o.material && !Array.isArray(o.material)) { o.material.opacity = 1; o.material.transparent = false; o.material.needsUpdate = true }
    }
  })
  const l = d?.lemur?.()
  if (l && d) {
    const p = l.group.position
    d.controls.target.set(p.x, p.y + 0.4, p.z)
    d.camera.position.set(p.x + 1.4, p.y + 1.1, p.z + 2.4)
    d.camera.lookAt(d.controls.target)
  }
})
await page.waitForTimeout(1200)
await page.screenshot({ path: path.join(OUT, 'r41-probe-lemur.png') })
console.log('captura probe lista')
await browser.close()
