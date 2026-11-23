/**
 * R41 — Verificación visual del lemur.glb convertido.
 * Renderiza el GLB con nuestra iluminación (Neutral, Lambert-ish) y captura
 * un frame de cada clip (idle / run / AttackMelee).
 * Salida: download/evidencia-r41/r41-src-{idle,run,attack}.png + informe.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const ROOT = '/home/z/my-project/axiom-v7-extracted'
const OUT = join(ROOT, 'download/evidencia-r41')
const PORT = 4174

const HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script>
<style>body{margin:0;background:#8ec9e8}canvas{display:block}</style>
</head><body>
<script type="module">
import * as THREE from 'three'
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js'
import { clone as skClone } from '/three/examples/jsm/utils/SkeletonUtils.js'

window.__ready = false
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(900, 700)
renderer.toneMapping = THREE.NeutralToneMapping
renderer.setPixelRatio(1)
document.body.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x8ec9e8)
const cam = new THREE.PerspectiveCamera(38, 900 / 700, 0.1, 100)
const sun = new THREE.DirectionalLight(0xfff3dd, 2.6); sun.position.set(4, 7, 5)
scene.add(sun, new THREE.AmbientLight(0xbfd9ff, 0.9))
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshLambertMaterial({ color: 0x79b356 }))
floor.rotation.x = -Math.PI / 2; scene.add(floor)

const gltf = await new GLTFLoader().loadAsync('/assets/world/mascot/lemur.glb')
const model = gltf.scene
model.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; } })
scene.add(model)
// diagnóstico: dónde está realmente la malla
const diag = []
model.updateWorldMatrix(true, true)
model.traverse((o) => {
  if (o.isMesh || o.isSkinnedMesh) {
    const wp = o.getWorldPosition(new THREE.Vector3())
    o.geometry.computeBoundingSphere()
    diag.push({ name: o.name, wp: wp.toArray().map(v => +v.toFixed(2)), bsR: +o.geometry.boundingSphere.radius.toFixed(2), visible: o.visible, mat: Array.isArray(o.material) ? o.material.length : 1 })
  }
})
console.log('DIAG:', JSON.stringify(diag))
const mixer = new THREE.AnimationMixer(model)
const box0 = new THREE.Box3().setFromObject(model)
const hRaw = box0.max.y - box0.min.y
model.scale.setScalar(1.7 / hRaw) // normaliza a 1.7 u de alto
const box = new THREE.Box3().setFromObject(model)
const h = box.max.y - box.min.y
const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2
model.position.set(-cx, -box.min.y, -cz)

const chainDbg = (() => {
  let bone = null
  model.traverse(o => { if (o.isBone && o.name === 'shinR') bone = o })
  if (!bone) return 'sin shinR'
  const rows = []
  let n = bone
  while (n) {
    rows.push({ name: n.name || '(root)', ws: +n.matrixWorld.getMaxScaleOnAxis().toFixed(4) })
    n = n.parent
  }
  return rows
})()
console.log('CHAIN:', JSON.stringify(chainDbg))

// CLONE-TEST: ¿SkeletonUtils.clone rota el modelo?
const cloned = skClone(gltf.scene)
const bc = new THREE.Box3().setFromObject(cloned)
console.log('CLONE-TEST:', JSON.stringify({ minY: +bc.min.y.toFixed(2), maxY: +bc.max.y.toFixed(2), minZ: +bc.min.z.toFixed(2), maxZ: +bc.max.z.toFixed(2) }))

window.__info = {
  clips: gltf.animations.map(a => a.name),
  height: +h.toFixed(3),
  tex: (() => { let t = null; model.traverse(o => { if (o.isMesh && o.material?.map) t = { name: o.material.map.name, flipY: o.material.map.flipY, colorSpace: o.material.map.colorSpace } }); return t })(),
  faces: (() => { let f = 0; model.traverse(o => { if (o.isMesh) f += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 }); return f })(),
}
window.__play = (clipName, t, camYaw, camH, dist) => {
  mixer.stopAllAction()
  const clip = gltf.animations.find(a => a.name.includes(clipName))
  if (clip) {
    const act = mixer.clipAction(clip); act.play(); act.time = t % clip.duration
    mixer.update(0)
  }
  cam.position.set(Math.sin(camYaw) * dist, camH, Math.cos(camYaw) * dist)
  cam.lookAt(0, h * 0.55, 0)
  renderer.render(scene, cam)
  // diagnóstico post-pose
  let rootBone = null
  model.traverse(o => { if (o.isBone && !rootBone) rootBone = o })
  let bsC = null
  model.traverse(o => { if (o.isMesh) bsC = o.geometry.boundingSphere.center.toArray().map(v=>+v.toFixed(1)) })
  const rb = rootBone ? rootBone.getWorldPosition(new THREE.Vector3()).toArray().map(v => +v.toFixed(1)) : null
  return JSON.stringify({ rootBone: rb, bsCenter: bsC })
}
window.__ready = true
</script></body></html>`

function serve(req: IncomingMessage, res: ServerResponse) {
  const url = (req.url || '/').split('?')[0]
  const send = (code: number, body: Buffer | string, type = 'text/html') => { res.writeHead(code, { 'content-type': type }); res.end(body) }
  if (url === '/') return send(200, HTML)
  if (url.startsWith('/assets/')) return readFile(join(ROOT, 'public', url)).then(b => send(200, b, 'application/octet-stream'), () => send(404, 'nf'))
  if (url.startsWith('/three/')) {
    const p = join(ROOT, 'node_modules/three', url.slice('/three/'.length))
    return readFile(p).then(b => send(200, b, 'text/javascript'), () => send(404, 'nf'))
  }
  send(404, 'nf')
}

const server = createServer(serve)
await new Promise<void>(r => server.listen(PORT, r))
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 920, height: 720 } })
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)))
page.on('console', m => { if (m.text().startsWith('DIAG') || m.text().startsWith('CHAIN') || m.text().startsWith('[diag]') || m.text().startsWith('CLONE-TEST')) console.log('[browser]', m.text().slice(0, 400)) })
await page.goto(`http://localhost:${PORT}/`)
await page.waitForFunction('window.__ready === true', null, { timeout: 30_000 })
const info = await page.evaluate('window.__info')
console.log('INFO:', JSON.stringify(info))

// tres tomas: frontal idle, lateral run, 3/4 attack
const shots = [
  ['idle', 'idle', 0.4, 0.0, 1.15, 2.6],
  ['run', 'run', 0.85, 1.1, 1.15, 2.6],
  ['attack', 'AttackMelee', 0.6, -0.6, 1.3, 2.8],
]
for (const [file, clip, t, yaw, ch, dist] of shots) {
  const resPlay = await page.evaluate(`window.__play(${JSON.stringify(clip)}, ${t}, ${yaw}, ${ch}, ${dist})`)
  console.log('play:', file, '->', resPlay)
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(OUT, `r41-src-${file}.png`) })
  console.log('captura:', file)
}
await browser.close()
server.close()
console.log('OK preview')
