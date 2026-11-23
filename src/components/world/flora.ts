// R36 — flora: árboles instanciados (frondosos y pinos), hierba que se mece y
// sistema de hojas que caen. Extraído tal cual de landscape3d.tsx (refactor
// por extracción, sin cambios).
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { rng, pathX } from './util'
import { islandD } from './terrain'
import { addWindSway } from './shaders'
import type { WorldCfg } from '@/lib/world/configs'
import type { CrownPoint, WorldParts } from './types'

// R40: el muestreo de arboleda es DETERMINISTA y compartido — el mundo
// procedural y la capa GLB (piloto Pradera) colocan los árboles en las
// MISMAS posiciones, de modo que las copas/hojas registradas siguen
// coincidiendo cuando la capa GLB sustituye a las primitivas.
export interface TreeSpot { x: number; z: number; s: number; kind: 'broad' | 'pine' }
export function sampleTreeSpots(cfg: WorldCfg, seed: number): TreeSpot[] {
  const rand = rng(seed + 11)
  const spots: TreeSpot[] = []
  for (let z = -2; z >= -104; z -= 6.2) {
    for (const side of [-1, 1]) {
      if (rand() < 0.2) continue
      const x = pathX(z) + side * (5.2 + rand() * 9.5) + (rand() - 0.5) * 2.5
      const zz = z + (rand() - 0.5) * 3.4
      // fuera del agua
      if (cfg.river && Math.abs(zz - cfg.river.z) < cfg.river.w + 2.2) continue
      // R38: dentro de la isla (nada plantado sobre el labio del corte)
      if (islandD(x, zz) > 0.86) continue
      const giant = rand() < 0.16
      const s = giant ? 1.5 + rand() * 0.75 : 0.8 + rand() * 0.75
      const kind = cfg.treeKind === 'mix' ? (rand() < 0.55 ? 'broad' : 'pine') : cfg.treeKind
      spots.push({ x, z: zz, s, kind })
    }
  }
  return spots
}

// Árboles: frondosos (tronco + 3 copas icosaédricas) y pinos (3 conos),
// instanciados; las copas registran puntos para el nacimiento de las hojas.
// R40: devuelve el grupo propio (el caller puede sustituirlo por la capa GLB).
export function buildTrees(cfg: WorldCfg, seed: number, hAt: (x: number, z: number) => number, parts: WorldParts): THREE.Group {
  const rand = rng(seed + 11)
  const spots = sampleTreeSpots(cfg, seed)
  const treeGroup = new THREE.Group()
  const broad = spots.filter(t => t.kind === 'broad')
  const pine = spots.filter(t => t.kind === 'pine')
  const dummy = new THREE.Object3D()

  // Troncos frondosos
  if (broad.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.22, 1.8, 6)
    trunkGeo.translate(0, 0.9, 0)
    const trunkMat = new THREE.MeshLambertMaterial({ color: cfg.trunkCol, flatShading: true })
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, broad.length)
    trunks.frustumCulled = false
    trunks.castShadow = true
    broad.forEach((t, i) => {
      dummy.position.set(t.x, hAt(t.x, t.z) - 0.1, t.z)
      dummy.rotation.set(0, rand() * Math.PI * 2, 0)
      dummy.scale.setScalar(t.s)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)
    })
    parts.group.add(trunks)

    // Copas: 3 blobs por árbol, color por instancia, viento por shader
    const blobGeo = new THREE.IcosahedronGeometry(1, 0)
    const folMat = new THREE.MeshLambertMaterial({ flatShading: true })
    addWindSway(folMat, 0.24, 0.13, 1.6, 5.4)
    const fol = new THREE.InstancedMesh(blobGeo, folMat, broad.length * 3)
    fol.frustumCulled = false
    fol.castShadow = true
    const col = new THREE.Color()
    let fi = 0
    broad.forEach((t) => {
      const baseY = hAt(t.x, t.z) - 0.1
      const blobs: [number, number, number, number][] = [
        [0, 2.75, 0, 1.5], [0.62, 2.2, 0.3, 1.0], [-0.55, 3.3, -0.25, 0.85],
      ]
      blobs.forEach(([ox, oy, oz, r], bi) => {
        dummy.position.set(t.x + ox * t.s, baseY + oy * t.s, t.z + oz * t.s)
        dummy.rotation.set(rand() * 0.7, rand() * Math.PI * 2, rand() * 0.5)
        dummy.scale.set(r * t.s, r * 0.92 * t.s, r * t.s)
        dummy.updateMatrix()
        fol.setMatrixAt(fi, dummy.matrix)
        col.setHex(cfg.treeCols[(bi + Math.floor(rand() * 3)) % cfg.treeCols.length])
        col.offsetHSL(0, 0, (rand() - 0.5) * 0.05)
        fol.setColorAt(fi, col)
        parts.crowns.push({ x: dummy.position.x, y: dummy.position.y, z: dummy.position.z, r: r * t.s })
        fi++
      })
    })
    if (fol.instanceColor) fol.instanceColor.needsUpdate = true
    treeGroup.add(trunks, fol)
  }

  // Pinos: tronco corto + 3 conos apilados
  if (pine.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.17, 1.4, 6)
    trunkGeo.translate(0, 0.7, 0)
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4030, flatShading: true })
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pine.length)
    trunks.frustumCulled = false
    trunks.castShadow = true
    const coneGeo = mergeGeometries([
      new THREE.ConeGeometry(1.25, 1.9, 7).translate(0, 1.9, 0),
      new THREE.ConeGeometry(0.95, 1.7, 7).translate(0, 2.9, 0),
      new THREE.ConeGeometry(0.6, 1.5, 7).translate(0, 3.85, 0),
    ])!
    const coneMat = new THREE.MeshLambertMaterial({ flatShading: true })
    addWindSway(coneMat, 0.12, 0.07, 1.4, 5.0)
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, pine.length)
    cones.frustumCulled = false
    cones.castShadow = true
    const col = new THREE.Color()
    pine.forEach((t, i) => {
      dummy.position.set(t.x, hAt(t.x, t.z) - 0.1, t.z)
      dummy.rotation.set(0, rand() * Math.PI * 2, 0)
      dummy.scale.setScalar(t.s)
      dummy.updateMatrix()
      trunks.setMatrixAt(i, dummy.matrix)
      cones.setMatrixAt(i, dummy.matrix)
      col.setHex(cfg.treeCols[i % cfg.treeCols.length]).offsetHSL(0, 0, (rand() - 0.5) * 0.05)
      cones.setColorAt(i, col)
      parts.crowns.push({ x: t.x, y: hAt(t.x, t.z) + 3.2 * t.s, z: t.z, r: 1.1 * t.s })
    })
    if (cones.instanceColor) cones.instanceColor.needsUpdate = true
    treeGroup.add(trunks, cones)
  }
  return treeGroup
}

// Hierba meciéndose: matas de 3 briznas cónicas junto al camino
export function buildGrass(cfg: WorldCfg, seed: number, hAt: (x: number, z: number) => number, group: THREE.Group): void {
  const rand = rng(seed + 23)
  const blades: THREE.BufferGeometry[] = []
  for (const [ox, tilt] of [[0, 0], [0.09, 0.5], [-0.09, -0.55]] as const) {
    const b = new THREE.ConeGeometry(0.05, 0.85, 3)
    b.translate(ox, 0.38, 0)
    b.rotateZ(tilt)
    blades.push(b)
  }
  const geo = mergeGeometries(blades)!
  const mat = new THREE.MeshLambertMaterial({ flatShading: true })
  addWindSway(mat, 0.3, 0.12, 0.05, 0.8)
  const N = 260
  const grass = new THREE.InstancedMesh(geo, mat, N)
  grass.frustumCulled = false
  grass.receiveShadow = true
  const dummy = new THREE.Object3D()
  const col = new THREE.Color()
  for (let i = 0; i < N; i++) {
    // R38: muestreo con reintento — la hierba vive dentro de la isla y fuera del río
    let x = 0, z = 0
    for (let t = 0; t < 9; t++) {
      z = 8 - rand() * 112
      const side = rand() < 0.5 ? -1 : 1
      x = pathX(z) + side * (2.1 + rand() * 6.2)
      if (cfg.river && Math.abs(z - cfg.river.z) < cfg.river.w + 2.4) continue
      if (islandD(x, z) < 0.87) break
    }
    dummy.position.set(x, hAt(x, z) - 0.03, z)
    dummy.rotation.set(0, rand() * Math.PI * 2, 0)
    dummy.scale.setScalar(0.55 + rand() * 0.75)
    dummy.updateMatrix()
    grass.setMatrixAt(i, dummy.matrix)
    col.setHex(cfg.grassCol).lerp(new THREE.Color(cfg.grassFar), rand() * 0.5)
    grass.setColorAt(i, col)
  }
  if (grass.instanceColor) grass.instanceColor.needsUpdate = true
  group.add(grass)
}

// Hojas instanciadas: nacen en las copas, caen con vaivén empujadas por el
// viento hacia el camino, reposan planas sobre el suelo y vuelven a nacer
export interface LeafSystem { update: (dt: number, t: number, wind: number, slow: number) => void; mesh: THREE.InstancedMesh }

export function buildLeaves(cfg: WorldCfg, seed: number, crowns: CrownPoint[], hAt: (x: number, z: number) => number, group: THREE.Group): LeafSystem {
  const rand = rng(seed + 91)
  const N = Math.max(24, cfg.leafCount)
  const geo = new THREE.PlaneGeometry(0.17, 0.21)
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.96 })
  const mesh = new THREE.InstancedMesh(geo, mat, N)
  mesh.frustumCulled = false
  const col = new THREE.Color()
  for (let i = 0; i < N; i++) {
    col.setHex(cfg.leafCols[i % cfg.leafCols.length])
    mesh.setColorAt(i, col)
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

  // estado por hoja
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N)
  const ph = new Float32Array(N), spin = new Float32Array(N), rest = new Float32Array(N)
  const dummy = new THREE.Object3D()
  const respawn = (i: number) => {
    if (crowns.length) {
      const c = crowns[Math.floor(rand() * crowns.length)]
      px[i] = c.x + (rand() - 0.5) * c.r * 1.6
      py[i] = c.y + (rand() - 0.3) * c.r
      pz[i] = c.z + (rand() - 0.5) * c.r * 1.6
    } else {
      px[i] = pathX(0) + (rand() - 0.5) * 16; py[i] = 3 + rand() * 3; pz[i] = -rand() * 90
    }
    ph[i] = rand() * Math.PI * 2
    spin[i] = 1.4 + rand() * 2.4
    rest[i] = 0
  }
  for (let i = 0; i < N; i++) { respawn(i); py[i] = rand() * 4 } // arranque escalonado

  const update = (dt: number, t: number, wind: number, slow: number) => {
    const spd = slow ? 0.4 : 1
    for (let i = 0; i < N; i++) {
      if (rest[i] > 0) {
        rest[i] -= dt
        if (rest[i] <= 0) respawn(i)
      } else {
        py[i] -= 0.55 * dt * spd
        // empuje del viento + deriva suave hacia la banda del camino
        px[i] += (wind * 0.75 + Math.sin(t * 2.1 + ph[i]) * 0.45) * dt * spd
        pz[i] += Math.cos(t * 1.6 + ph[i]) * 0.22 * dt * spd
        px[i] += (pathX(pz[i]) + (ph[i] > Math.PI ? 1.6 : -1.6) - px[i]) * dt * 0.16 * (0.4 + wind)
        const floor = hAt(px[i], pz[i]) + 0.062
        if (py[i] <= floor) {
          py[i] = floor
          rest[i] = 2.5 + rand() * 6 // reposa plana un rato, como en la referencia
        }
      }
      const resting = rest[i] > 0
      dummy.position.set(px[i], py[i], pz[i])
      if (resting) {
        dummy.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 0.2, ph[i], 0)
      } else {
        dummy.rotation.set(t * spin[i] + ph[i], Math.sin(t * 0.9 + ph[i]) * 0.8, Math.cos(t * 1.3 + ph[i]) * 0.6)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  group.add(mesh)
  return { update, mesh }
}
