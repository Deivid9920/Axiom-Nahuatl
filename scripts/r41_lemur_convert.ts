/**
 * R41 — Conversión del lémur de OpenGameArt (NewDLC, CC0) FBX → GLB.
 * Estrategia: Chromium (playwright) + FBXLoader/GLTFExporter de three 0.180
 * (el DOM/canvas del navegador permite incrustar la textura lemurT.png en el GLB).
 *
 * Uso: bun run scripts/r41_lemur_convert.ts
 * Salida: public/assets/world/mascot/lemur.glb + informe por consola.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const ROOT = '/home/z/my-project/axiom-v7-extracted'
const SRC = '/home/z/my-project/tmp/lemur_src'
const OUT_DIR = join(ROOT, 'public/assets/world/mascot')
const PORT = 4173

const HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">
{"imports":{"three":"/three/build/three.module.js"}}
</script>
</head><body>
<script type="module">
import * as THREE from 'three'
import { FBXLoader } from '/three/examples/jsm/loaders/FBXLoader.js'
import { GLTFExporter } from '/three/examples/jsm/exporters/GLTFExporter.js'

const report = { clips: [], meshes: [], materials: [], vertices: 0, bones: 0, error: null }
window.__done = false

const manager = new THREE.LoadingManager()
manager.setURLModifier((url) => {
  if (url.includes('lemurT') || url.toLowerCase().endsWith('.png')) return '/lemurT.png'
  return url
})

try {
  const loader = new FBXLoader(manager)
  const fbx = await loader.loadAsync('/lemur.fbx')
  await new Promise((res, rej) => { manager.onLoad = res; manager.onError = rej; setTimeout(res, 4000) })

  fbx.traverse((o) => {
    if (o.isMesh || o.isSkinnedMesh) {
      report.meshes.push({ name: o.name, skinned: !!o.isSkinnedMesh, verts: o.geometry?.attributes?.position?.count ?? 0 })
      report.vertices += o.geometry?.attributes?.position?.count ?? 0
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) if (!report.materials.includes(m.name)) report.materials.push(m.name)
    }
    if (o.isBone) report.bones++
  })
  report.clips = fbx.animations.map(c => ({ name: c.name, dur: +c.duration.toFixed(3), tracks: c.tracks.length }))

  // Normalización suave: el FBX suele venir en cm — informamos la escala del nodo raíz
  const box = new THREE.Box3().setFromObject(fbx)
  report.rawBox = { min: box.min.toArray().map(v=>+v.toFixed(2)), max: box.max.toArray().map(v=>+v.toFixed(2)) }

  // SANEAMIENTO de materiales del FBX (hallazgo R41): el FBX de NewDLC exporta
  // baseColorFactor alpha=0 + alphaMode BLEND (invisible) y emissiveFactor [1,1,1].
  // Convención de transparencia del FBX invertida + emisivo espurio.
  fbx.traverse((o) => {
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) {
        m.transparent = false
        m.opacity = 1
        m.alphaTest = 0
        m.side = THREE.FrontSide
        if (m.emissive) m.emissive.setRGB(0, 0, 0)
        if (m.emissiveIntensity != null) m.emissiveIntensity = 0
        m.metalness = 0
        m.roughness = 1
      }
    }
  })

  const exporter = new GLTFExporter()
  const glb = await exporter.parseAsync(fbx, { binary: true, animations: fbx.animations })
  const buf = glb instanceof ArrayBuffer ? glb : null
  if (!buf) throw new Error('exporter no devolvió ArrayBuffer')
  await fetch('/save', { method: 'POST', body: buf })
  report.exportedBytes = buf.byteLength
} catch (e) {
  report.error = String(e && e.stack || e)
}
window.__report = report
window.__done = true
</script></body></html>`

function serve(req: IncomingMessage, res: ServerResponse) {
  const url = req.url || '/'
  const send = (code: number, body: Buffer | string, type = 'text/html') => {
    res.writeHead(code, { 'content-type': type, 'access-control-allow-origin': '*' })
    res.end(body)
  }
  if (url === '/' || url === '/index.html') return send(200, HTML)
  if (url === '/lemur.fbx') return readFile(join(SRC, 'lemur.fbx')).then(b => send(200, b, 'application/octet-stream'), () => send(404, 'no fbx'))
  if (url === '/lemurT.png') return readFile(join(SRC, 'lemurT.png')).then(b => send(200, b, 'image/png'), () => send(404, 'no png'))
  if (url.startsWith('/three/')) {
    const p = join(ROOT, 'node_modules/three', url.slice('/three/'.length).split('?')[0])
    const type = p.endsWith('.js') ? 'text/javascript' : 'application/octet-stream'
    return readFile(p).then(b => send(200, b, type), () => send(404, 'missing ' + p))
  }
  if (url === '/save' && req.method === 'POST') {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', async () => {
      const buf = Buffer.concat(chunks)
      await mkdir(OUT_DIR, { recursive: true })
      await writeFile(join(OUT_DIR, 'lemur.glb'), buf)
      console.log(`GLB guardado: ${(buf.length / 1024).toFixed(1)} KB`)
      res.writeHead(200); res.end('ok')
    })
    return
  }
  send(404, 'nf')
}

const server = createServer(serve)
await new Promise<void>(r => server.listen(PORT, r))
console.log(`servidor de conversión en :${PORT}`)

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage()
page.on('console', m => console.log('[browser]', m.text().slice(0, 300)))
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)))
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction('window.__done === true', null, { timeout: 60_000 })
const report = await page.evaluate('window.__report') as { error?: string | null; exportedBytes?: number } | null
console.log(JSON.stringify(report, null, 2))
await browser.close()
server.close()
if (report && report.error) { console.error('CONVERSIÓN CON ERROR'); process.exit(1) }
console.log('OK conversión')
