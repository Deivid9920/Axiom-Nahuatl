// R40 — CAPA GLB DEL PILOTO PRADERA (assets CC0, ver public/assets/world/
// meadow/LICENSES.md): sustituye las primitivas por modelos reales de
// Quaternius — arboleda instanciada, aldea héroe junto al camino, sotobosque
// y fauna animada (ciervo y zorro con clips esqueléticos).
//
// Arquitectura: builder puro ASÍNCRONO que devuelve { group, update(t, dt) }.
// Carga en paralelo, falla SÓLO si un GLB esencial no carga (el caller
// conserva entonces el mundo procedural R38 — degradación elegante). Las
// posiciones de los árboles son EXACTAMENTE las del sampling procedural
// (sampleTreeSpots, seed compartida): las copas registradas para las hojas
// siguen siendo válidas y el bosque no cambia de silueta al hacer el swap.
//
// Rendimiento: 1 InstancedMesh por (especie × material) → la arboleda entera
// cuesta ~8 draw calls; la aldea son 9 piezas estáticas + 3 vallados
// instanciados; fauna = 2 mallas esqueléticas. Sin sombras nuevas más allá
// de castShadow en piezas gruesas (los mismos límites del sol R21).
import * as THREE from 'three'
import { loadGlb, extractParts, applyPalette, type GlbPart } from './assets'
import { sampleTreeSpots } from './flora'
import { rng, pathX } from './util'
import { islandD } from './terrain'
import { addWindSway } from './shaders'
import type { WorldCfg } from '@/lib/world/configs'

const BASE = '/assets/world/meadow'

export interface GlbLayer { group: THREE.Group; update: (t: number, dt: number) => void }

interface Walker { group: THREE.Group; a: THREE.Vector3; b: THREE.Vector3; speed: number; len: number; k: number }

// catálogo del piloto: url + altura objetivo (unidades de mundo) por unidad
// de altura normalizada (extractParts deja los modelos con altura 1)
const CAT = {
  broad: [1, 2, 3, 4, 5].map(i => ({ url: `${BASE}/tree_broad_${i}.glb`, h: 3.3 + (i % 3) * 0.35 })),
  birch: [1, 2].map(i => ({ url: `${BASE}/tree_birch_${i}.glb`, h: 4.0 })),
  willow: [{ url: `${BASE}/tree_willow_1.glb`, h: 4.7 }],
  bush: [1, 2].map(i => ({ url: `${BASE}/bush_${i}.glb`, h: 0.85 })),
  flowers: [{ url: `${BASE}/flowers_1.glb`, h: 0.42 }],
  grass: [{ url: `${BASE}/grass_tuft_1.glb`, h: 0.5 }],
  plant: [{ url: `${BASE}/plant_1.glb`, h: 0.6 }],
  rock: [1, 2].map(i => ({ url: `${BASE}/rock_${i}.glb`, h: 0.4 })),
  rockMoss: [{ url: `${BASE}/rock_moss_1.glb`, h: 0.5 }],
} as const

interface Piece { url: string; x: number; z: number; yaw: number; h: number; sway?: boolean }
const VILLAGE: Piece[] = [
  // plaza de la aldea junto al arranque del camino (z ≈ -4..-24)
  { url: `${BASE}/house_1.glb`, x: pathX(-8) + 6.8, z: -8, yaw: -0.42, h: 4.6 },
  { url: `${BASE}/house_2.glb`, x: pathX(-15) - 7.4, z: -15, yaw: 0.38, h: 4.0 },
  { url: `${BASE}/well_1.glb`, x: pathX(-23) + 4.6, z: -23, yaw: 0.3, h: 1.7 },
  { url: `${BASE}/bell_tower_1.glb`, x: pathX(-33) - 8.8, z: -33, yaw: -0.25, h: 7.2 },
  { url: `${BASE}/bonfire_1.glb`, x: pathX(-18.5) + 3.7, z: -18.5, yaw: 0, h: 1.05 },
  { url: `${BASE}/bench_1.glb`, x: pathX(-11.5) + 3.3, z: -11.5, yaw: -0.6, h: 0.55 },
  { url: `${BASE}/barrel_1.glb`, x: pathX(-6.8) + 5.5, z: -6.8, yaw: 0.4, h: 0.85 },
  { url: `${BASE}/barrel_1.glb`, x: pathX(-7.5) + 6.2, z: -7.5, yaw: 1.1, h: 0.78 },
  { url: `${BASE}/cart_1.glb`, x: pathX(-12.6) - 5.1, z: -12.6, yaw: 0.95, h: 1.45 },
]

// pendiente derivada de pathX para alinear las vallas al rumbo del camino
const pathTangentYaw = (z: number) => {
  const dx = 3.3 * 0.075 * Math.cos(z * 0.075) + 1.1 * 0.031 * Math.cos(z * 0.031 + 2.0)
  return Math.atan2(dx, 1)
}

export async function buildMeadowLayer(
  cfg: WorldCfg,
  seed: number,
  hAt: (x: number, z: number) => number,
): Promise<GlbLayer> {
  const group = new THREE.Group()
  const mixers: { mix: THREE.AnimationMixer; speed: number }[] = []
  const animals: Walker[] = []
  const dummy = new THREE.Object3D()

  // ── carga en paralelo del catálogo + piezas de la aldea ──
  const urls = new Set<string>()
  for (const k of Object.values(CAT)) for (const e of k as readonly { url: string }[]) urls.add(e.url)
  for (const p of VILLAGE) urls.add(p.url)
  urls.add(`${BASE}/deer.glb`)
  urls.add(`${BASE}/fox.glb`)
  const loaded = new Map<string, ReturnType<typeof extractParts>>()
  await Promise.all([...urls].map(async (u) => {
    const glb = await loadGlb(u)
    loaded.set(u, extractParts(glb.scene))
  }))

  // instanciación: una PIEZA base (partes fusionadas por material) repetida
  // en N spots con la MISMA matriz por parte (1 InstancedMesh por parte)
  const instanceAt = (parts: GlbPart[], spots: { x: number; y: number; z: number; yaw: number; h: number }[], sway: boolean) => {
    for (const part of parts) {
      const mat = part.mat
      if (sway && part.matName !== 'Wood') addWindSway(mat, 0.14, 0.08, 1.1, 3.6)
      const inst = new THREE.InstancedMesh(part.geo, mat, spots.length)
      inst.frustumCulled = false
      const thick = part.matName === 'Wood' || /house|well|tower|bell/i.test(part.matName)
      inst.castShadow = thick
      spots.forEach((s, i) => {
        dummy.position.set(s.x, s.y, s.z)
        dummy.rotation.set(0, s.yaw, 0)
        dummy.scale.setScalar(s.h)
        dummy.updateMatrix()
        inst.setMatrixAt(i, dummy.matrix)
      })
      group.add(inst)
    }
  }

  // ── arboleda: mismas posiciones que el mundo procedural (seed compartida) ──
  const spots = sampleTreeSpots(cfg, seed).filter(t => t.kind === 'broad')
  const rand = rng(seed + 41)
  const bySpecies = new Map<string, { url: string; h: number; spots: { x: number; y: number; z: number; yaw: number; h: number }[] }>()
  const addSpot = (key: string, h: number, x: number, z: number, s: number, yaw: number) => {
    const entry = bySpecies.get(key) ?? { url: key, h, spots: [] }
    entry.spots.push({ x, y: hAt(x, z) - 0.06, z, yaw, h: h * s })
    bySpecies.set(key, entry)
  }
  for (const t of spots) {
    const roll = rand()
    const bucket = roll < 0.7 ? CAT.broad : roll < 0.88 ? CAT.birch : CAT.willow
    const e = bucket[Math.floor(rand() * bucket.length)]
    addSpot(e.url, e.h, t.x, t.z, t.s, rand() * Math.PI * 2)
  }
  // R40 (2ª iteración): RELLENO de bosque — las referencias tienen arboleda
  // DENSA; se añade una segunda pasada de árboles menores (2ª capa visual,
  // sin tocar el sampling compartido de las copas de las hojas)
  const fill = rng(seed + 43)
  for (let i = 0; i < 92; i++) {
    let x = 0, z = 0
    for (let t = 0; t < 9; t++) {
      z = 2 - fill() * 106
      const side = fill() < 0.5 ? -1 : 1
      x = pathX(z) + side * (3.2 + fill() * 12)
      if (cfg.river && Math.abs(z - cfg.river.z) < cfg.river.w + 2.2) continue
      if (islandD(x, z) < 0.84) break
    }
    const e = CAT.broad[Math.floor(fill() * CAT.broad.length)]
    addSpot(e.url, e.h, x, z, 0.5 + fill() * 0.6, fill() * Math.PI * 2)
  }
  for (const { url, spots: ss } of bySpecies.values()) {
    const norm = loaded.get(url)
    if (!norm) continue
    instanceAt(norm.parts, ss, true)
  }

  // ── sotobosque: arbustos, flores, hierba, plantas y rocas ──
  const scatter = (entries: readonly { url: string; h: number }[], n: number, minOff: number, maxOff: number, z0: number, z1: number, sway: boolean, ySink = 0.02) => {
    const r = rng(seed + entries[0].url.length * 7 + n)
    const per = entries.map(e => ({ e, spots: [] as { x: number; y: number; z: number; yaw: number; h: number }[] }))
    for (let i = 0; i < n; i++) {
      let x = 0, z = 0
      for (let t = 0; t < 9; t++) {
        z = z0 - r() * (z0 - z1)
        const side = r() < 0.5 ? -1 : 1
        x = pathX(z) + side * (minOff + r() * (maxOff - minOff))
        if (islandD(x, z) < 0.85) break
      }
      const pick = per[Math.floor(r() * per.length)]
      pick.spots.push({ x, y: hAt(x, z) - ySink, z, yaw: r() * Math.PI * 2, h: pick.e.h * (0.75 + r() * 0.6) })
    }
    for (const { e, spots: ss } of per) {
      if (!ss.length) continue
      const norm = loaded.get(e.url)
      if (norm) instanceAt(norm.parts, ss, sway)
    }
  }
  scatter(CAT.bush, 24, 3.0, 13, 6, -96, true)
  scatter(CAT.flowers, 30, 2.6, 7, 8, -60, false)
  scatter(CAT.grass, 26, 2.4, 9, 8, -100, false)
  scatter(CAT.plant, 8, 3.0, 10, 4, -80, true)
  scatter(CAT.rock, 8, 3.2, 13, 6, -100, false)
  scatter(CAT.rockMoss, 4, 5.0, 13, -20, -90, false)

  // ── aldea: piezas estáticas (las altas se hunden 0.22: asientan en pendiente) ──
  for (const p of VILLAGE) {
    const norm = loaded.get(p.url)
    if (!norm || islandD(p.x, p.z) > 0.82) continue
    const sink = /house|tower|bell/i.test(p.url) ? 0.22 : 0.05
    instanceAt(norm.parts, [{ x: p.x, y: hAt(p.x, p.z) - sink, z: p.z, yaw: p.yaw, h: p.h }], false)
  }
  const fenceNorm = loaded.get(`${BASE}/fence_1.glb`)
  if (fenceNorm) {
    const rows: { x: number; y: number; z: number; yaw: number; h: number }[] = []
    for (let z = -3.5; z > -13; z -= 1.35) {
      const x = pathX(z) + 3.1
      if (islandD(x, z) < 0.8) rows.push({ x, y: hAt(x, z) - 0.03, z, yaw: pathTangentYaw(z) + Math.PI / 2, h: 0.85 })
    }
    for (let z = -16.5; z > -25; z -= 1.35) {
      const x = pathX(z) - 3.4
      if (islandD(x, z) < 0.8) rows.push({ x, y: hAt(x, z) - 0.03, z, yaw: pathTangentYaw(z) + Math.PI / 2, h: 0.85 })
    }
    instanceAt(fenceNorm.parts, rows, false)
  }

  // ── fauna (clips esqueléticos): necesitan la jerarquía de huesos del GLB —
  // se usa la escena VIVA (no extractParts, que hornea la geometría y rompe
  // el skinning). Ciervo en idle junto al linde del bosque; zorro paseando
  // la aldea de ida y vuelta con su clip de caminata.
  const animalLive = async (url: string, h: number, clipRe: RegExp, walk: { a: [number, number]; b: [number, number]; speed: number } | null) => {
    const glb = await loadGlb(url)
    const clip = glb.animations.find(c => clipRe.test(c.name)) ?? glb.animations[0]
    const inner = glb.scene
    inner.scale.setScalar(h)
    inner.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.frustumCulled = false
      const m = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
      if (m) { applyPalette(m.name || '', m as unknown as THREE.Material) }
    })
    const wrapG = new THREE.Group()
    wrapG.add(inner)
    const ax = walk ? walk.a : [0, 0]
    const bx = walk ? walk.b : [0, 0]
    const A = new THREE.Vector3(ax[0], 0, ax[1])
    const B = new THREE.Vector3(bx[0], 0, bx[1])
    wrapG.position.set(A.x, hAt(A.x, A.z) - 0.04, A.z)
    group.add(wrapG)
    if (clip) {
      const mix = new THREE.AnimationMixer(inner)
      const action = mix.clipAction(clip)
      action.play()
      mixers.push({ mix, speed: walk ? 1 : 0.85 })
    }
    if (walk) animals.push({ group: wrapG, a: A, b: B, speed: walk.speed, len: Math.max(0.001, A.distanceTo(B)), k: 0 })
  }
  await animalLive(`${BASE}/deer.glb`, 1.55, /idle/i, null)
  await animalLive(`${BASE}/fox.glb`, 0.95, /walk/i, { a: [pathX(-26) - 4.2, -26], b: [pathX(-16) - 4.8, -16], speed: 0.85 })

  // ── vida por frame: mezcladores + paseo del zorro ──
  const update = (t: number, dt: number) => {
    for (const m of mixers) m.mix.update(dt * m.speed)
    for (const w of animals) {
      w.k += (dt * w.speed) / w.len
      if (w.k > 2) w.k -= 2
      const kk = w.k > 1 ? 2 - w.k : w.k
      const p = w.a.clone().lerp(w.b, kk)
      const dir = w.b.clone().sub(w.a).multiplyScalar(w.k > 1 ? -1 : 1)
      w.group.position.set(p.x, hAt(p.x, p.z) - 0.04, p.z)
      w.group.rotation.y = Math.atan2(dir.x, dir.z)
    }
    void t
  }
  return { group, update }
}
