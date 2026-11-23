/**
 * R41c — sonda forense del skinning: cadena grupo→hueso (escalas por nodo) y
 * tracks de ESCALA de los clips (¿el mixer deshace la normalización?).
 * Uso: bun scripts/r41c_probe.ts <BASE>
 */
import { chromium } from '@playwright/test'

const [, , BASE = 'http://localhost:3000'] = process.argv

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await (await browser.newContext({ viewport: { width: 1360, height: 860 } })).newPage()
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)))
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
await page.waitForTimeout(1200)

const diag = await page.evaluate(() => {
  const rig = (window as unknown as {
    __d3d?: { lemur?: () => {
      group: {
        traverse: (f: (o: BONE) => void) => void
        children: NODE[]
      }
    } | null }
  }).__d3d?.lemur?.()
  if (!rig) return { error: 'sin rig' }
  interface NODE {
    name?: string; type?: string
    scale?: { x: number; y: number; z: number }
    matrixWorld?: { getMaxScaleOnAxis: () => number; elements: number[] }
    parent?: NODE | null
    children?: NODE[]
    isBone?: boolean; isSkinnedMesh?: boolean
  }
  interface BONE extends NODE { isBone?: boolean }
  // 1) cadena de un hueso: nombres + escala local + escala mundo
  let chain: unknown = null
  const findBone = (n: NODE, depth = 0): NODE | null => {
    if (n.isBone && n.name === 'shinR') return n
    if (depth > 12 || !n.children) return null
    for (const c of n.children) { const r = findBone(c, depth + 1); if (r) return r }
    return null
  }
  const bone = findBone(rig.group.children[0] as NODE) ?? findBone(rig.group as NODE)
  if (bone) {
    const rows: unknown[] = []
    let n: NODE | undefined | null = bone
    while (n) {
      rows.push({
        name: n.name ?? '(root)',
        localScale: n.scale ? [+n.scale.x.toFixed(3), +n.scale.y.toFixed(3), +n.scale.z.toFixed(3)] : null,
        worldScale: n.matrixWorld ? +n.matrixWorld.getMaxScaleOnAxis().toFixed(4) : null,
      })
      n = n.parent
    }
    chain = rows
  }
  // 2) tracks de escala de los clips (via mixer actions — reusamos el mixer del rig)
  //    el rig no expone el mixer; inferimos desde el GLB cargado vía fetch
  return { chain, note: 'tracks via segundo fetch abajo' }
})
console.log('CADENA:', JSON.stringify(diag, null, 2))

// 3) tracks de escala directamente del GLB (parse local en el navegador)
const tracks = await page.evaluate(async () => {
  const buf = await fetch('/assets/world/mascot/lemur.glb').then(r => r.arrayBuffer())
  const dv = new DataView(buf)
  const jsonLen = dv.getUint32(12, true)
  const j = JSON.parse(new TextDecoder().decode(new Uint8Array(buf.slice(20, 20 + jsonLen))))
  const report: Record<string, unknown>[] = []
  for (const a of j.animations) {
    const scaleTracks: unknown[] = []
    for (const s of a.samplers) { void s }
    // channels con path scale
    for (const ch of a.channels) {
      if (ch.sampler !== undefined && ch.target.path === 'scale') {
        const node = j.nodes[ch.target.node]?.name ?? ch.target.node
        // valores del sampler (accessor): leemos min/max si existen
        const acc = j.accessors[j.samplers[ch.sampler].output]
        scaleTracks.push({ node, count: acc?.count, max: acc?.max, min: acc?.min })
      }
    }
    report.push({ clip: a.name, scaleTracks: scaleTracks.slice(0, 4), nScale: scaleTracks.length })
  }
  return report
})
console.log('TRACKS ESCALA:', JSON.stringify(tracks, null, 2))
await browser.close()
