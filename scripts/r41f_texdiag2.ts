/** R41-diag v2: ¿el texture del lémur quedó sin image? ¿createImageBitmap decodifica el PNG? */
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })

interface TexLike { image?: unknown; source?: { data?: unknown } }
interface Rigish { model?: { traverse: (f: (o: { material?: { map?: TexLike } }) => void) => void } }
const p = await (await b.newContext()).newPage()
const errs: string[] = []
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 160)) })

await p.addInitScript(() => {
  ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
  window.localStorage.setItem('axiom-onboarding-done', 'true')
})
await p.goto('http://localhost:3000/lab-isla', { timeout: 90000 })
await p.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
await p.waitForFunction(
  () => (window as unknown as { __d3d?: { lemur?: () => unknown } }).__d3d?.lemur?.() != null,
  null, { timeout: 30000 },
).catch(() => {})

const texInfo = await p.evaluate(() => {
  const d = (window as unknown as { __d3d?: { lemur?: () => unknown } }).__d3d
  const rig = d?.lemur?.() as Rigish | null | undefined
  if (!rig?.model) return { found: false }
  let out: Record<string, unknown> = { found: false }
  rig.model.traverse((o) => {
    if (o.material?.map) out = { found: true, hasImage: !!o.material.map.image, hasSourceData: !!o.material.map.source?.data }
  })
  return out
})
console.log('textura en el rig:', JSON.stringify(texInfo))

const pngB64 = fs.readFileSync('/tmp/lemur_tex.png').toString('base64')
const bmp = await p.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  try {
    const img = await createImageBitmap(new Blob([bin], { type: 'image/png' }))
    return { ok: true, w: img.width, h: img.height }
  } catch (e) { return { ok: false, err: String(e).slice(0, 200) } }
}, pngB64)
console.log('createImageBitmap PNG crudo:', JSON.stringify(bmp))

// mismo flujo que GLTFLoader: blob URL → fetch → blob → createImageBitmap
const viaBlobUrl = await p.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bin], { type: 'image/png' }))
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const img = await createImageBitmap(blob)
    URL.revokeObjectURL(url)
    return { ok: true, w: img.width }
  } catch (e) {
    URL.revokeObjectURL(url)
    return { ok: false, err: String(e).slice(0, 200) }
  }
}, pngB64)
console.log('createImageBitmap via blobURL:', JSON.stringify(viaBlobUrl))

console.log('errores de consola:', errs.length ? errs.join(' | ') : 'ninguno')
await b.close()
