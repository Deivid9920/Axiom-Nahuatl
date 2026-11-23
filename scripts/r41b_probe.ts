/**
 * R41b — sonda del rig del lémur vía el asa __d3d.lemur():
 * matriz del mesh, escala mundo, huesos, textura y estado del material.
 * Uso: bun scripts/r41b_probe.ts <BASE>
 */
import { chromium } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'

const [, , BASE = 'http://localhost:3000'] = process.argv
const OUT = path.join(process.cwd(), 'download/evidencia-r41')
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage()
page.on('console', m => { if (!m.text().startsWith('%c')) console.log('[browser]', m.text().slice(0, 300)) })
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
await page.waitForTimeout(1500)

const diag = await page.evaluate(() => {
  const d = (window as unknown as {
    __d3d?: {
      lemur?: () => {
        group: THREElike
      } | null
    }
  }).__d3d
  interface THREElike {
    position: { x: number; y: number; z: number }
    scale: { x: number; y: number; z: number }
    traverse: (f: (o: OBJ) => void) => void
  }
  interface OBJ {
    isSkinnedMesh?: boolean; isMesh?: boolean; isBone?: boolean; name?: string
    visible?: boolean; frustumCulled?: boolean
    scale?: { x: number; y: number; z: number }
    matrixWorld?: { getMaxScaleOnAxis: () => number }
    geometry?: { boundingSphere: { center: { x: number; y: number; z: number }; radius: number } }
    material?: { map?: { image?: { width: number; height: number }; source?: { data?: { width: number; height: number } }; colorSpace?: string } | null; opacity?: number; transparent?: boolean; color?: { getHexString: () => string } }
    skeleton?: { bones: OBJ[] }
    getWorldPosition?: (v: { x: number; y: number; z: number; copy?: (v: unknown) => void; setFromMatrixPosition?: (m: unknown) => void }) => void
  }
  const rig = d?.lemur?.()
  if (!rig) return { error: 'sin rig' }
  const out: Record<string, unknown>[] = []
  let boneCount = 0
  let boneWorldSample: unknown = null
  rig.group.traverse((o) => {
    if (o.isBone) {
      boneCount++
      if (boneCount === 3 && o.getWorldPosition) {
        const v = { x: 0, y: 0, z: 0, setFromMatrixPosition(m: { elements: number[] }) { this.x = m.elements[12]; this.y = m.elements[13]; this.z = m.elements[14]; return this } }
        o.getWorldPosition(v as never)
        boneWorldSample = { name: o.name, wp: { x: v.x, y: v.y, z: v.z } }
      }
    }
    if (o.isSkinnedMesh) {
      out.push({
        name: o.name,
        visible: o.visible,
        culled: o.frustumCulled,
        localScale: o.scale ? { ...o.scale } : null,
        worldScale: o.matrixWorld ? +o.matrixWorld.getMaxScaleOnAxis().toFixed(4) : null,
        geoBS: o.geometry?.boundingSphere ? { c: { ...o.geometry.boundingSphere.center }, r: +o.geometry.boundingSphere.radius.toFixed(1) } : null,
        map: o.material?.map ? {
          img: o.material.map.image ? `${o.material.map.image.width}x${o.material.map.image.height}` : (o.material.map.source?.data ? `${o.material.map.source.data.width}x${o.material.map.source.data.height}` : 'SIN imagen'),
          colorSpace: o.material.map.colorSpace,
        } : 'sin map',
        opacity: o.material?.opacity,
        color: o.material?.color?.getHexString?.(),
      })
    }
  })
  // árbol del grupo (4 niveles): nombre, tipo, escala local
  interface TN { name?: string; type?: string; scale?: { x: number; y: number; z: number }; children?: TN[]; isBone?: boolean; isSkinnedMesh?: boolean }
  const tree: Record<string, unknown>[] = []
  const walk2 = (n: TN, d: number, path: string) => {
    tree.push({ d, path, name: n.name || '(sin nombre)', type: n.type, sx: n.scale ? +n.scale.x.toPrecision(3) : null, bones: !!n.isBone, skin: !!n.isSkinnedMesh })
    if (d < 3 && n.children) n.children.forEach((c, i) => walk2(c, d + 1, path + '/' + i))
  }
  walk2(rig.group as unknown as TN, 0, 'g')
  return { groupPos: { ...rig.group.position }, groupScale: { ...rig.group.scale }, boneCount, boneWorldSample, meshes: out, tree }
})
console.log('DIAG:', JSON.stringify(diag, null, 2))
await browser.close()
