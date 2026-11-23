/** R41-diag: sondeo completo de la escena de la mascota en render */
import { chromium } from '@playwright/test'

const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const p = await (await b.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 })).newPage()
await p.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})
await p.goto('http://localhost:3000/', { timeout: 90000 })
const hello = p.locator('.axiom-hello')
try { await hello.waitFor({ timeout: 8000 }) } catch {
  await p.fill('input[type="email"]', 'admin@axiom.mx')
  await p.fill('input[type="password"]', 'axiom12345')
  await p.click('button[type="submit"]', { timeout: 20000 }).catch(() => {})
  await hello.waitFor({ timeout: 60000 }).catch(() => console.log('hello no llegó'))
}
await p.waitForTimeout(3000)

const probe = await p.evaluate(() => {
  const d = (window as unknown as { __mascotDbg?: Record<string, unknown> }).__mascotDbg as unknown as {
    scene?: { updateMatrixWorld: () => void; traverse: (f: (o: unknown) => void) => void }
    camera?: { position: { x: number; y: number; z: number }; projectionMatrix: unknown }
    root?: { position: { y: number }; rotation: { y: number }; children: unknown[] }
    model?: { position: { y: number }; scale: { x: number }; rotation: { y: number }; getWorldPosition: (v: { x: number; y: number; z: number }) => unknown }
    mixer?: { time: number }
  }
  if (!d?.model) return { err: 'sin asa' }
  d.scene?.updateMatrixWorld()
  // posición mundial del modelo: columnas 12-14 de matrixWorld
  const mw = (d.model as unknown as { matrixWorld: number[] }).matrixWorld
  const wp = [mw[12], mw[13], mw[14]]
  const modelScale = (d.model as unknown as { matrixWorld: number[] }).matrixWorld
  void modelScale
  // bbox world del modelo en render
  const THREElike = (d.model as unknown as { constructor: { name: string } }).constructor.name
  const mins: number[] = [1e9, 1e9, 1e9]
  const maxs: number[] = [-1e9, -1e9, -1e9]
  d.scene?.traverse((o) => {
    const m = o as { isMesh?: boolean; geometry?: { boundingBox?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } }; matrixWorld?: number[]; getWorldPosition?: (v: { x: number; y: number; z: number }) => unknown }
    if (!m.isMesh || !m.geometry?.boundingBox || !m.matrixWorld) return
    const bb = m.geometry.boundingBox
    const M = m.matrixWorld
    const pts = [
      [bb.min.x, bb.min.y, bb.min.z], [bb.min.x, bb.min.y, bb.max.z],
      [bb.min.x, bb.max.y, bb.min.z], [bb.min.x, bb.max.y, bb.max.z],
      [bb.max.x, bb.min.y, bb.min.z], [bb.max.x, bb.min.y, bb.max.z],
      [bb.max.x, bb.max.y, bb.min.z], [bb.max.x, bb.max.y, bb.max.z],
    ]
    for (const v of pts) {
      const w = [
        M[0] * v[0] + M[4] * v[1] + M[8] * v[2] + M[12],
        M[1] * v[0] + M[5] * v[1] + M[9] * v[2] + M[13],
        M[2] * v[0] + M[6] * v[1] + M[10] * v[2] + M[14],
      ]
      for (let k = 0; k < 3; k++) {
        mins[k] = Math.min(mins[k], w[k]); maxs[k] = Math.max(maxs[k], w[k])
      }
    }
  })
  return {
    ctor: THREElike,
    camY: d.camera?.position.y,
    rootY: d.root?.position.y,
    rootKids: d.root?.children.length,
    modelPosY: d.model?.position.y,
    modelScale: d.model?.scale.x,
    modelRotY: d.model?.rotation.y,
    worldPos: wp,
    sceneBBox: { mins, maxs },
    mixerTime: d.mixer?.time,
  }
})
console.log(JSON.stringify(probe, null, 1))
await b.close()
