// R36 — decorado y ambiente: brillo procedural (canvas), flores y piedras,
// puente, nubes, estrellas, luciérnagas y pájaros. Extraído tal cual de
// landscape3d.tsx (refactor por extracción, sin cambios).
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { rng, pathX } from './util'
import { islandD } from './terrain'
import type { WorldCfg } from '@/lib/world/configs'

/* ── texturas procedurales (canvas, sin archivos) ───────────────────── */

export function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const rad = g.createRadialGradient(32, 32, 2, 32, 32, 30)
  rad.addColorStop(0, 'rgba(255,255,255,1)')
  rad.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  rad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = rad
  g.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Flores (pradera/otoño dorado) y piedras grises
export function buildDetails(cfg: WorldCfg, seed: number, hAt: (x: number, z: number) => number, group: THREE.Group): void {
  const rand = rng(seed + 37)
  const dummy = new THREE.Object3D()
  if (cfg.flowers) {
    const geo = new THREE.IcosahedronGeometry(0.09, 0)
    const mat = new THREE.MeshLambertMaterial({ flatShading: true })
    const N = 42
    const fl = new THREE.InstancedMesh(geo, mat, N)
    fl.frustumCulled = false
    const col = new THREE.Color()
    for (let i = 0; i < N; i++) {
      // R38: muestreo con reintento — las flores viven dentro de la isla
      let x = 0, z = 0
      for (let t = 0; t < 9; t++) {
        z = 6 - rand() * 108
        const side = rand() < 0.5 ? -1 : 1
        x = pathX(z) + side * (2.4 + rand() * 5)
        if (islandD(x, z) < 0.87) break
      }
      dummy.position.set(x, hAt(x, z) + 0.1, z)
      dummy.scale.setScalar(0.7 + rand() * 0.9)
      dummy.rotation.set(0, rand() * Math.PI, 0)
      dummy.updateMatrix()
      fl.setMatrixAt(i, dummy.matrix)
      col.setHex(cfg.flowers[i % cfg.flowers.length])
      fl.setColorAt(i, col)
    }
    if (fl.instanceColor) fl.instanceColor.needsUpdate = true
    group.add(fl)
  }
  const sGeo = new THREE.DodecahedronGeometry(0.42, 0)
  const sMat = new THREE.MeshLambertMaterial({ color: 0x9b9484, flatShading: true })
  const stones = new THREE.InstancedMesh(sGeo, sMat, cfg.stoneCount)
  stones.frustumCulled = false
  stones.castShadow = true
  stones.receiveShadow = true
  for (let i = 0; i < cfg.stoneCount; i++) {
    // R38: muestreo con reintento — las piedras viven dentro de la isla
    let x = 0, zz = 0
    for (let t = 0; t < 9; t++) {
      const z = 4 - rand() * 108
      const nearRiver = cfg.river && rand() < 0.55
      const side = rand() < 0.5 ? -1 : 1
      x = nearRiver ? pathX(cfg.river!.z) + side * (cfg.river!.w + rand() * 3) : pathX(z) + side * (2.6 + rand() * 4.5)
      zz = nearRiver ? cfg.river!.z + (rand() - 0.5) * cfg.river!.w * 2.2 : z
      if (islandD(x, zz) < 0.87) break
    }
    dummy.position.set(x, hAt(x, zz) + 0.05, zz)
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
    dummy.scale.set(0.5 + rand() * 1.1, 0.4 + rand() * 0.6, 0.5 + rand() * 1.1)
    dummy.updateMatrix()
    stones.setMatrixAt(i, dummy.matrix)
  }
  group.add(stones)
}

// Puente de madera donde el camino cruza el río
export function buildBridge(riv: NonNullable<WorldCfg['river']>, group: THREE.Group): void {
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a6a44, flatShading: true })
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x6e5234, flatShading: true })
  const cx = pathX(riv.z)
  const len = riv.w * 2 + 3.4
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.13, len), wood)
  deck.position.set(cx, 0.36, riv.z)
  deck.castShadow = true
  deck.receiveShadow = true
  const railGeo = new THREE.BoxGeometry(0.09, 0.08, len)
  for (const side of [-1, 1]) {
    const rail = new THREE.Mesh(railGeo, woodDark)
    rail.position.set(cx + side * 1.2, 0.78, riv.z)
    group.add(rail)
  }
  const postGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.55, 5)
  for (const [sx, sz] of [[-1.2, -1], [1.2, -1], [-1.2, 1], [1.2, 1]] as const) {
    const post = new THREE.Mesh(postGeo, woodDark)
    post.position.set(cx + sx, 0.56, riv.z + sz * (len / 2 - 0.4))
    group.add(post)
  }
  group.add(deck)
}

// Nubes low-poly a la deriva
export function buildClouds(cfg: WorldCfg, seed: number, group: THREE.Group): { meshes: THREE.Mesh[]; speed: number } | null {
  if (!cfg.clouds) return null
  const rand = rng(seed + 51)
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 })
  const meshes: THREE.Mesh[] = []
  for (let c = 0; c < cfg.clouds; c++) {
    const blobs: THREE.BufferGeometry[] = []
    const n = 3 + Math.floor(rand() * 3)
    for (let b = 0; b < n; b++) {
      const r = 1.4 + rand() * 1.6
      const g = new THREE.IcosahedronGeometry(r, 0)
      g.scale(1.25, 0.62, 1)
      g.translate((b - n / 2) * 1.7, (rand() - 0.5) * 0.6, (rand() - 0.5) * 1.4)
      blobs.push(g)
    }
    const mesh = new THREE.Mesh(mergeGeometries(blobs)!, mat)
    mesh.position.set(-70 + rand() * 140, 31 + rand() * 10, -20 - rand() * 90)
    meshes.push(mesh)
    group.add(mesh)
  }
  return { meshes, speed: 0.55 }
}

// Estrellas nocturnas (puntos sobre la cúpula)
export function buildStars(group: THREE.Group): { mat: THREE.PointsMaterial } {
  const rand = rng(907)
  const N = 340
  const pos = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const az = rand() * Math.PI * 2
    const el = Math.asin(rand() * 0.92 + 0.06)
    const r = 265
    pos[i * 3] = Math.cos(el) * Math.cos(az) * r
    pos[i * 3 + 1] = Math.sin(el) * r
    pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })
  const pts = new THREE.Points(geo, mat)
  pts.renderOrder = -9
  group.add(pts)
  return { mat }
}

// Luciérnagas: destellos aditivos que flotan junto al camino
export function buildFireflies(seed: number, group: THREE.Group): { pts: THREE.Points; base: Float32Array; mat: THREE.PointsMaterial } {
  const rand = rng(seed + 77)
  const N = 34
  const pos = new Float32Array(N * 3)
  const base = new Float32Array(N * 3)
  for (let i = 0; i < N; i++) {
    const z = 2 - rand() * 95
    const x = pathX(z) + (rand() < 0.5 ? -1 : 1) * (1.8 + rand() * 6)
    base[i * 3] = x; base[i * 3 + 1] = 0.7 + rand() * 1.9; base[i * 3 + 2] = z
  }
  pos.set(base)
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    map: glowTexture(), color: 0xd9f07c, size: 0.55, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  })
  const pts = new THREE.Points(geo, mat)
  group.add(pts)
  return { pts, base, mat }
}

// Pájaros lejanos: alas triangulares batiendo en círculos amplios
export function buildBirds(group: THREE.Group): { birds: THREE.Group[]; update: (t: number) => void } {
  const mat = new THREE.MeshBasicMaterial({ color: 0x3a4152, side: THREE.DoubleSide, fog: false })
  const wingGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.95, 0.12, 0.28), new THREE.Vector3(0.9, 0.05, -0.3)]).setIndex([0, 1, 2])
  wingGeo.computeVertexNormals()
  const birds: THREE.Group[] = []
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group()
    const wl = new THREE.Mesh(wingGeo, mat)
    const wr = new THREE.Mesh(wingGeo, mat)
    wr.scale.x = -1
    b.add(wl, wr)
    b.userData = { wl, wr, ph: i * 1.7, r: 20 + i * 3.5, h: 15 + i * 2.2, sp: 0.1 + i * 0.015 }
    birds.push(b)
    group.add(b)
  }
  const update = (t: number) => {
    for (const b of birds) {
      const u = b.userData as { ph: number; r: number; h: number; sp: number; wl: THREE.Mesh; wr: THREE.Mesh }
      const a = t * u.sp + u.ph
      b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.5 + u.ph) * 1.2, -46 + Math.sin(a) * u.r * 0.7)
      b.rotation.y = -a + Math.PI / 2
      const flap = Math.sin(t * 7.5 + u.ph) * 0.6
      u.wl.rotation.x = flap
      u.wr.rotation.x = -flap
    }
  }
  return { birds, update }
}
