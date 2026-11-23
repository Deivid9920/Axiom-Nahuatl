// R36 — terreno y camino: altura por ruido aplanada junto al camino, malla
// low-poly con colores por cara y cinta 3D del camino sobre la curva.
// Extraídos tal cual de landscape3d.tsx (refactor por extracción, sin cambios).
// R38 — ISLA DE REFERENCIA (PDF maestro: diorama flotante): el terreno se
// recorta con una superelipse orgánica, el borde cae como labio de tierra y
// una base de roca colgante cierra la isla por debajo. makeHeightFn NO cambia:
// todos los builders siguen creando sobre el mismo campo de alturas; el corte
// es sólo geometría visible, así el camino, nodos, vuelos y raycaster quedan
// intactos (restricción R36–R44: nada de lógica se mueve).
import * as THREE from 'three'
import { clamp01, smooth, pathX, vnoise2 } from './util'
import type { WorldCfg } from '@/lib/world/configs'

// Silueta de la isla de referencia (cubre árboles hasta |x| ≈ 21 y el camino
// z 12..-100 con margen; el borde orgánico va del corte ±~1.1 unidades)
export const ISLAND = {
  rx: 28,    // semiancho
  rz: 66,    // semiprofundidad (isla ≈ z 19.5 .. -112.5)
  zc: -46.5, // centro de la isla (z del mundo)
  n: 4,      // exponente de superelipse: esquinas llenas, punta orgánica
  dip: 5.2,  // caída del labio de tierra hacia el corte
  rockR: 0.94,   // radio de la roca respecto a la isla (siempre metida bajo el labio)
  rockDepth: 11.5, // largo de la roca colgante
  rockTopY: -5.0,  // y nominal del anillo superior de la roca (luego se sella al labio)
}

// Distancia normalizada a la isla: <1 dentro, >1 fuera (superelipse n=4)
export function islandD(x: number, wz: number): number {
  const dx = Math.abs(x) / ISLAND.rx
  const dz = Math.abs(wz - ISLAND.zc) / ISLAND.rz
  return Math.pow(dx * dx * dx * dx + dz * dz * dz * dz, 0.25)
}

// Semiancho de la isla a una z dada (recorta el agua a la silueta)
export function islandHalfWidth(wz: number): number {
  const q = Math.min(0.999, Math.abs(wz - ISLAND.zc) / ISLAND.rz)
  return ISLAND.rx * Math.pow(1 - q * q * q * q, 0.25)
}

// Altura del terreno con el labio aplicado: = hAt dentro (d < 0.92) y cae
// hacia el corte en la franja del borde. El río NO cae (su cauce llega entero
// al salto de la cascada). La roca colgante sella contra esta misma función.
export function islandDipY(
  x: number, wz: number,
  hAt: (x: number, z: number) => number,
  riv?: { z: number; w: number },
): number {
  const h = hAt(x, wz)
  const d = islandD(x, wz)
  if (d <= 0.92) return h
  const jag = (vnoise2(x * 0.14 + 11, wz * 0.14 + 3) - 0.5) * 0.35
  let dip = ISLAND.dip * smooth(0.92, 0.99, d) * (1 + jag)
  if (riv) dip *= smooth(riv.w + 0.8, riv.w + 2.6, Math.abs(wz - riv.z))
  return h - dip
}

// Altura del terreno: colinas por ruido, aplanadas junto al camino, con
// hondo del río si el mundo tiene agua.
// R38: ribera nivelada — dentro del ancho de la lámina de agua (|Δz| <
// 1.05·w) el terreno queda por debajo de −1.0 en TODO el ancho de la isla
// (antes sólo bajaba el hondo central en z: las colinas de las orillas
// lejanas atravesaban el agua en las vistas a distancia). El hondo central,
// el camino y el resto del campo quedan intactos: todos los builders siguen
// muestreando la MISMA hAt en tiempo de construcción.
export function makeHeightFn(cfg: WorldCfg): (x: number, z: number) => number {
  const riv = cfg.river
  return (x: number, z: number) => {
    const off = Math.abs(x - pathX(z))
    const hills = (vnoise2(x * 0.045 + 7, z * 0.045) - 0.5) * 2 * cfg.amp
      + (vnoise2(x * 0.11 + 40, z * 0.11) - 0.5) * cfg.amp * 0.5
    let h = hills * smooth(2.4, 10.5, off)
    if (riv) {
      h -= 1.25 * Math.exp(-((z - riv.z) * (z - riv.z)) / (riv.w * riv.w))
      const zBand = 1 - smooth(riv.w * 1.05, riv.w * 1.45, Math.abs(z - riv.z))
      h = h * (1 - zBand) + Math.min(h, -1.0) * zBand
    }
    return h
  }
}

// Terreno low-poly con colores por cara (hierba, tierra junto al camino),
// recortado como isla flotante (R38) con labio de tierra hacia el borde
export function buildTerrain(cfg: WorldCfg, hAt: (x: number, z: number) => number): THREE.Mesh {
  const W = 96, D = 148, SX = 60, SZ = 94 // R38: plano más largo (la isla alcanza z≈-112)
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i) - 40 // el plano se centra luego en z=-40
    pos.setY(i, islandDipY(x, z, hAt, cfg.river))
  }
  // R38: recorte POR CARA según la silueta (con jitter orgánico del borde);
  // descartar caras evita faldones degenerados y ahorra ~4.500 triángulos
  const src = geo.toNonIndexed()
  geo.dispose()
  const sp = src.attributes.position as THREE.BufferAttribute
  const keep: number[] = []
  for (let f = 0; f < sp.count; f += 3) {
    const cx = (sp.getX(f) + sp.getX(f + 1) + sp.getX(f + 2)) / 3
    const cz = (sp.getZ(f) + sp.getZ(f + 1) + sp.getZ(f + 2)) / 3 - 40
    const cut = 1 + (vnoise2(cx * 0.13 + 31, cz * 0.13 + 7) - 0.5) * 0.08
    if (islandD(cx, cz) < cut) { keep.push(f, f + 1, f + 2) }
  }
  const pArr = new Float32Array(keep.length * 3)
  for (let oi = 0; oi < keep.length; oi++) {
    const vi = keep[oi]
    pArr[oi * 3] = sp.getX(vi); pArr[oi * 3 + 1] = sp.getY(vi); pArr[oi * 3 + 2] = sp.getZ(vi)
  }
  src.dispose()
  const flat = new THREE.BufferGeometry()
  flat.setAttribute('position', new THREE.BufferAttribute(pArr, 3))
  flat.computeVertexNormals()
  const p2 = flat.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(p2.count * 3)
  const cA = new THREE.Color(cfg.groundA), cB = new THREE.Color(cfg.groundB)
  const cDirt = new THREE.Color(cfg.dirt), tmp = new THREE.Color()
  // R38: tierra/roca del corte (el labio y el borde leen como sección de suelo)
  const cRock = new THREE.Color(cfg.dirt).lerp(new THREE.Color(0x6e6152), 0.6)
  for (let f = 0; f < p2.count; f += 3) {
    const x = (p2.getX(f) + p2.getX(f + 1) + p2.getX(f + 2)) / 3
    const z = (p2.getZ(f) + p2.getZ(f + 1) + p2.getZ(f + 2)) / 3 - 40
    const y = (p2.getY(f) + p2.getY(f + 1) + p2.getY(f + 2)) / 3
    const t = clamp01((vnoise2(x * 0.09 + 3, z * 0.09) * 0.62 + y * 0.24 + 0.18))
    tmp.copy(cA).lerp(cB, t)
    const off = Math.abs(x - pathX(z))
    tmp.lerp(cDirt, (1 - smooth(1.9, 3.4, off)) * 0.85)
    const dd = islandD(x, z)
    if (dd > 0.85) tmp.lerp(cRock, smooth(0.85, 1.0, dd) * 0.95)
    const j = ((f * 2654435761) % 100) / 100 * 0.06
    colors[f * 3] = tmp.r + j; colors[f * 3 + 1] = tmp.g + j; colors[f * 3 + 2] = tmp.b + j
    for (let k = 1; k < 3; k++) {
      colors[(f + k) * 3] = colors[f * 3]; colors[(f + k) * 3 + 1] = colors[f * 3 + 1]; colors[(f + k) * 3 + 2] = colors[f * 3 + 2]
    }
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))
  mesh.position.z = -40
  mesh.receiveShadow = true
  return mesh
}

// R38 — base de roca colgante: cono invertido con ruido, del color de la
// tierra a roca gris profunda; su anillo superior se SELLA al labio del terreno
// (misma función islandDipY) para que nunca quede rendija visible de lado.
export function buildIslandRock(cfg: WorldCfg, hAt: (x: number, z: number) => number): THREE.Mesh {
  const geo = new THREE.ConeGeometry(1, 1, 46, 6, false)
  geo.rotateX(Math.PI) // ápice hacia abajo
  geo.scale(ISLAND.rx * ISLAND.rockR, ISLAND.rockDepth, ISLAND.rz * ISLAND.rockR)
  geo.translate(0, ISLAND.rockTopY - ISLAND.rockDepth / 2, ISLAND.zc)
  const flat = geo.toNonIndexed()
  geo.dispose()
  const pos = flat.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i)
    if (y > ISLAND.rockTopY - 0.5) {
      // anillo de sello: sigue el labio del terreno (0.35 de solape)
      pos.setY(i, islandDipY(x, z, hAt, cfg.river) - 0.35)
      continue
    }
    // ruido rocoso radial/y hacia el interior (escala sobre el eje de la isla)
    const s = 1 + (vnoise2(x * 0.16 + 5, (z - ISLAND.zc) * 0.16 + y * 0.11) - 0.5) * 0.22
    pos.setX(i, x * s)
    pos.setZ(i, ISLAND.zc + (z - ISLAND.zc) * s)
    const deep = clamp01((-y - 5.5) / (ISLAND.rockDepth - 1))
    pos.setY(i, y + (vnoise2(x * 0.21 + 9, z * 0.21) - 0.5) * 1.6 * deep)
  }
  // color por cara: tierra arriba → roca gris profundo abajo, con vetas
  const p2 = flat.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(p2.count * 3)
  const cDeep = new THREE.Color(0x4a4136), cUp = new THREE.Color(0x77685a)
  const cDirt = new THREE.Color(cfg.dirt).multiplyScalar(0.85), tmp = new THREE.Color()
  for (let f = 0; f < p2.count; f += 3) {
    const cy = (p2.getY(f) + p2.getY(f + 1) + p2.getY(f + 2)) / 3
    const cx = (p2.getX(f) + p2.getX(f + 1) + p2.getX(f + 2)) / 3
    const cz = (p2.getZ(f) + p2.getZ(f + 1) + p2.getZ(f + 2)) / 3
    const frac = clamp01((cy - (ISLAND.rockTopY - ISLAND.rockDepth)) / ISLAND.rockDepth)
    tmp.copy(cDeep).lerp(cUp, frac)
    if (frac > 0.72) tmp.lerp(cDirt, (frac - 0.72) / 0.28 * 0.8)
    const j = (vnoise2(cx * 0.5 + 17, cz * 0.5 + 2) - 0.5) * 0.1
    for (let k = 0; k < 3; k++) {
      colors[(f + k) * 3] = tmp.r + j; colors[(f + k) * 3 + 1] = tmp.g + j; colors[(f + k) * 3 + 2] = tmp.b + j
    }
  }
  flat.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  flat.computeVertexNormals()
  const mesh = new THREE.Mesh(flat, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))
  return mesh
}

// Cinta del camino (R21): geometría 3D real generada alrededor de la curva
// CatmullRom, con anchura física y altura conformada al terreno; recibe sombras
export function buildRoad(cfg: WorldCfg, hAt: (x: number, z: number) => number, curve: THREE.CatmullRomCurve3): THREE.Mesh {
  const verts: number[] = [], cols: number[] = []
  const cDirt = new THREE.Color(cfg.dirt).lerp(new THREE.Color(0xffffff), 0.14)
  const cDark = new THREE.Color(cfg.dirt).lerp(new THREE.Color(0x000000), 0.12)
  const tmp = new THREE.Color()
  const pts = curve.getSpacedPoints(110)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)]
    const dx = next.x - prev.x, dz = next.z - prev.z
    const len = Math.hypot(dx, dz) || 1
    const px = -dz / len, pz = dx / len // perpendicular al avance
    const w = 2.05 + Math.sin(i * 0.35) * 0.16
    const centerH = hAt(p.x, p.z)
    for (const side of [-1, 1]) {
      const x = p.x + px * side * w
      const z = p.z + pz * side * w
      // la cinta sigue el terreno y nunca queda por debajo del centro
      verts.push(x, Math.max(hAt(x, z), centerH) + 0.055, z)
      tmp.copy(cDirt).lerp(cDark, 0.5 + 0.5 * Math.sin(i * 1.7 + side))
      cols.push(tmp.r, tmp.g, tmp.b)
    }
  }
  const idx: number[] = []
  const n = verts.length / 3
  for (let i = 0; i < n - 2; i += 2) {
    idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))
  mesh.receiveShadow = true
  return mesh
}
