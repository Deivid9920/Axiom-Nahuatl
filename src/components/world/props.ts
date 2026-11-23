// R38 — decoración por bioma: piezas pequeñas instanciadas según los DATOS de
// configs (WorldProp). Cada bioma recibe 2 piezas características (setas,
// tocones, juncos, piedras apiladas, rocas) colocadas junto al camino y, en
// el caso de los juncos, a la orilla del río. Todas dentro de la isla
// (islandD < 0.86) y fuera del cauce salvo los juncos. Sin texturas.
// Cada pieza se muestrea UNA vez y todas sus partes comparten la misma pose.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { rng, pathX } from './util'
import { islandD } from './terrain'
import type { WorldCfg, WorldProp } from '@/lib/world/configs'

interface PropSpot { x: number; z: number; y: number; s: number; rotY: number; tilt: number }

export function buildProps(cfg: WorldCfg, seed: number, hAt: (x: number, z: number) => number, group: THREE.Group): void {
  const props = cfg.props ?? []
  if (!props.length) return
  const rand = rng(seed + 143)
  const col = new THREE.Color()

  for (const prop of props) {
    const N = Math.max(0, prop.count)
    if (!N) continue
    // muestreo único: todas las partes de una pieza comparten pose
    const spots: PropSpot[] = []
    for (let i = 0; i < N; i++) {
      let x = 0, z = 0, ok = false
      for (let t = 0; t < 9 && !ok; t++) {
        if (prop.kind === 'reed' && cfg.river) {
          const side = rand() < 0.5 ? -1 : 1
          z = cfg.river.z + side * (cfg.river.w + 0.35 + rand() * 2.1)
          x = (rand() - 0.5) * 50
        } else {
          z = 6 - rand() * 108
          const side = rand() < 0.5 ? -1 : 1
          x = pathX(z) + side * (2.6 + rand() * 7.5)
          if (cfg.river && Math.abs(z - cfg.river.z) < cfg.river.w + 1.7) continue
        }
        ok = islandD(x, z) < 0.86
      }
      if (!ok) continue
      spots.push({
        x, z, y: hAt(x, z) - 0.03,
        s: 0.75 + rand() * 0.85,
        rotY: rand() * Math.PI * 2,
        tilt: (rand() - 0.5) * 0.16,
      })
    }
    if (!spots.length) continue
    const dummy = new THREE.Object3D()
    const fill = (inst: THREE.InstancedMesh, pose: (sp: PropSpot) => void, colorAt?: (sp: PropSpot, i: number) => number) => {
      inst.frustumCulled = false
      spots.forEach((sp, i) => {
        pose(sp)
        dummy.updateMatrix()
        inst.setMatrixAt(i, dummy.matrix)
        if (colorAt) {
          col.setHex(colorAt(sp, i)).offsetHSL(0, 0, (rand() - 0.5) * 0.06)
          inst.setColorAt(i, col)
        }
      })
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true
      group.add(inst)
    }
    const poseLand = (sp: PropSpot) => {
      dummy.position.set(sp.x, sp.y, sp.z)
      dummy.rotation.set(sp.tilt, sp.rotY, sp.tilt)
      dummy.scale.setScalar(sp.s)
    }

    switch (prop.kind) {
      case 'mushroom': {
        // tallo crema + sombrero cónico con la paleta del bioma (misma pose)
        const stemGeo = new THREE.CylinderGeometry(0.05, 0.075, 0.34, 5).translate(0, 0.17, 0)
        const capGeo = new THREE.ConeGeometry(0.17, 0.16, 7).translate(0, 0.4, 0)
        const palette = prop.colors ?? [0xc4573d]
        fill(new THREE.InstancedMesh(stemGeo, new THREE.MeshLambertMaterial({ color: 0xe8dcc0, flatShading: true }), spots.length), poseLand)
        fill(new THREE.InstancedMesh(capGeo, new THREE.MeshLambertMaterial({ flatShading: true }), spots.length), poseLand,
          (_sp, i) => palette[i % palette.length])
        break
      }
      case 'stump': {
        const geo = new THREE.CylinderGeometry(0.3, 0.4, 0.55, 7).translate(0, 0.27, 0)
        const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(cfg.trunkCol).multiplyScalar(0.92), flatShading: true })
        const inst = new THREE.InstancedMesh(geo, mat, spots.length)
        inst.castShadow = true
        fill(inst, poseLand)
        break
      }
      case 'reed': {
        // matas de 3 varillas altas a la orilla del río
        const blades: THREE.BufferGeometry[] = []
        for (const [ox, tilt] of [[0, 0], [0.07, 0.32], [-0.07, -0.35]] as const) {
          const b = new THREE.ConeGeometry(0.045, 1.05, 3)
          b.translate(ox, 0.5, 0)
          b.rotateZ(tilt)
          blades.push(b)
        }
        const geo = mergeGeometries(blades)!
        const palette = prop.colors ?? [cfg.grassCol]
        fill(new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ flatShading: true }), spots.length),
          (sp) => {
            dummy.position.set(sp.x, sp.y + 0.01, sp.z)
            dummy.rotation.set(0, sp.rotY, 0)
            dummy.scale.setScalar(sp.s * 1.05)
          },
          (_sp, i) => palette[i % palette.length])
        break
      }
      case 'rockpile': {
        const geo = mergeGeometries([
          new THREE.DodecahedronGeometry(0.38, 0).translate(0, 0.2, 0),
          new THREE.DodecahedronGeometry(0.26, 0).translate(0.3, 0.16, 0.12),
          new THREE.DodecahedronGeometry(0.2, 0).translate(-0.24, 0.14, -0.18),
        ])!
        const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0x968e7e, flatShading: true }), spots.length)
        inst.castShadow = true
        inst.receiveShadow = true
        fill(inst, poseLand)
        break
      }
      case 'boulder': {
        const geo = new THREE.DodecahedronGeometry(0.95, 0)
        const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(0x968e7e).lerp(new THREE.Color(cfg.groundB), 0.25), flatShading: true })
        const inst = new THREE.InstancedMesh(geo, mat, spots.length)
        inst.castShadow = true
        inst.receiveShadow = true
        fill(inst, (sp) => {
          dummy.position.set(sp.x, hAt(sp.x, sp.z) + 0.1, sp.z)
          dummy.rotation.set(sp.rotY * 0.6, sp.rotY, sp.tilt * 2)
          dummy.scale.set(sp.s * 1.25, sp.s * 0.95, sp.s * 1.25)
        })
        break
      }
    }
  }
}
