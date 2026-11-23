// R36 — nodos de lecciones físicos sobre el camino (R21). Cada lección es un
// punto físico del recorrido: pedestal de piedra sobre el hombro del camino
// con una estructura según su estado — hecho (letrero de madera + bandera
// verde), actual/en curso (estandarte ámbar + gema flotante + aro de
// guijarros), disponible (poste con aro turquesa — desbloqueado en espera,
// R38), bloqueado (mojones grises) y Evaluación final (portal de piedra con
// gema dentro según su estado). Sphere invisible = área de click para el
// Raycaster. Extraído tal cual de landscape3d.tsx (extracción, sin cambios).
import * as THREE from 'three'
import { rng } from './util'
import { glowTexture } from './decor'
import type { WorldCfg } from '@/lib/world/configs'
import type { D3Node } from './types'

// Etiquetas de estado para la ficha flotante del nodo (R38: 5 estados)
export const D3_STATE_LABEL: Record<D3Node['state'], string> = {
  done: 'Completado',
  current: 'En curso',
  available: 'Disponible',
  locked: 'Bloqueado',
}

export interface NodeVisual {
  group: THREE.Group
  anchor: THREE.Vector3
  gem?: THREE.Mesh
  gemBaseY: number
  glow?: THREE.Sprite
  flag?: THREE.Object3D
  ph: number
  scale: number
  targetScale: number
}

export interface NodeWorld {
  group: THREE.Group
  visuals: NodeVisual[]
  hits: THREE.Mesh[]
  dispose: () => void
}

export function buildLessonNodes(
  cfg: WorldCfg,
  seed: number,
  curve: THREE.CatmullRomCurve3,
  hAt: (x: number, z: number) => number,
  nodes: D3Node[],
): NodeWorld {
  const group = new THREE.Group()
  const visuals: NodeVisual[] = []
  const hits: THREE.Mesh[] = []
  const geos: THREE.BufferGeometry[] = []
  const mats: THREE.Material[] = []
  const rand = rng(seed + 131)

  const mkMat = (hex: number, extra: Partial<THREE.MeshLambertMaterialParameters> = {}) => {
    const m = new THREE.MeshLambertMaterial({ color: hex, flatShading: true, ...extra })
    mats.push(m)
    return m
  }
  const stoneMat = mkMat(0xa8a094)
  const stoneDarkMat = mkMat(0x8f8878)
  const woodMat = mkMat(0x8a6a44)
  const woodDarkMat = mkMat(0x6e5234)
  const greenMat = mkMat(0x3f8a52)
  const amberMat = mkMat(0xe9a23b)
  const tealMat = mkMat(0x14a085)          // R38: disponible (teal Axiom)
  const grayMat = mkMat(0xb5ad9e)
  const gemMat = mkMat(0xf5b942, { emissive: 0x8a5a10 })
  const gemTealMat = mkMat(0x14a085, { emissive: 0x0a5a4a }) // R38: final disponible
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  mats.push(hitMat)

  const mkGeo = <T extends THREE.BufferGeometry>(g: T): T => { geos.push(g); return g }
  const platGeo = mkGeo(new THREE.CylinderGeometry(0.92, 1.08, 0.26, 7))
  const postGeo = mkGeo(new THREE.CylinderGeometry(0.07, 0.09, 1.15, 5).translate(0, 0.575, 0))
  const poleGeo = mkGeo(new THREE.CylinderGeometry(0.05, 0.06, 1.9, 5).translate(0, 0.95, 0))
  const tipGeo = mkGeo(new THREE.CylinderGeometry(0.032, 0.032, 0.56, 4).translate(0, 0.28, 0))
  const boardGeo = mkGeo(new THREE.BoxGeometry(0.8, 0.5, 0.08))
  const boardSmGeo = mkGeo(new THREE.BoxGeometry(0.6, 0.4, 0.07))
  const flagGeo = mkGeo(new THREE.BoxGeometry(0.46, 0.32, 0.05))
  const gemGeo = mkGeo(new THREE.OctahedronGeometry(0.34, 0))
  const pebbleGeo = mkGeo(new THREE.DodecahedronGeometry(0.16, 0))
  const cairnGeo = mkGeo(new THREE.DodecahedronGeometry(0.3, 0))
  const cairnTopGeo = mkGeo(new THREE.DodecahedronGeometry(0.2, 0))
  const pillarGeo = mkGeo(new THREE.BoxGeometry(0.32, 1.6, 0.32).translate(0, 0.8, 0))
  const lintelGeo = mkGeo(new THREE.BoxGeometry(1.15, 0.26, 0.36))
  const ringGeo = mkGeo(new THREE.TorusGeometry(0.34, 0.075, 6, 16).translate(0, 1.24, 0)) // R38: disponible
  const hitGeo = mkGeo(new THREE.SphereGeometry(1.55, 8, 6))

  const n = nodes.length
  nodes.forEach((node, i) => {
    let u = n === 1 ? 0.5 : 0.05 + (0.9 * i) / (n - 1)
    const p = new THREE.Vector3()
    curve.getPointAt(u, p)
    // nunca dentro del río: se desliza a la orilla del tramo siguiente
    for (let guard = 0; guard < 70 && cfg.river && Math.abs(p.z - cfg.river.z) < cfg.river.w + 1.7; guard++) {
      u = Math.min(0.985, u + 0.004)
      curve.getPointAt(u, p)
    }
    const tan = curve.getTangentAt(u)
    const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
    const side = node.final ? 0.3 : i % 2 === 0 ? 1.28 : -1.28
    const base = new THREE.Vector3(p.x + perp.x * side, 0, p.z + perp.z * side)
    base.y = hAt(base.x, base.z) + 0.02

    const g = new THREE.Group()
    g.position.copy(base)
    g.lookAt(p.x + tan.x, base.y, p.z + tan.z) // mira hacia el sentido de la marcha

    const plat = new THREE.Mesh(platGeo, node.state === 'locked' ? stoneDarkMat : stoneMat)
    plat.position.y = 0.13
    plat.castShadow = true
    plat.receiveShadow = true
    g.add(plat)

    let gem: THREE.Mesh | undefined
    let glow: THREE.Sprite | undefined
    let flag: THREE.Object3D | undefined
    let gemBaseY = 1.55

    if (node.final) {
      // portal de piedra que cierra el camino
      for (const sx of [-0.62, 0.62]) {
        const pil = new THREE.Mesh(pillarGeo, stoneMat)
        pil.position.set(sx, 0.26, 0)
        pil.castShadow = true
        g.add(pil)
      }
      const lin = new THREE.Mesh(lintelGeo, stoneMat)
      lin.position.set(0, 1.86, 0)
      lin.castShadow = true
      g.add(lin)
      if (node.state !== 'locked') {
        const avail = node.state === 'available'
        gem = new THREE.Mesh(gemGeo, avail ? gemTealMat : gemMat)
        gem.position.set(0, 1.1, 0)
        gemBaseY = 1.1
        g.add(gem)
        glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTexture(), color: node.state === 'current' ? 0xffd27a : avail ? 0x8fe8d0 : 0xbfe8c8,
          transparent: true, opacity: 0.5, depthWrite: false,
        }))
        glow.scale.setScalar(1.7)
        glow.position.set(0, 1.1, 0)
        g.add(glow)
      } else {
        const f = new THREE.Mesh(flagGeo, grayMat)
        f.position.set(0, 2.12, 0)
        g.add(f)
      }
    } else if (node.state === 'done') {
      const post = new THREE.Mesh(postGeo, woodDarkMat)
      post.position.y = 0.26
      post.castShadow = true
      g.add(post)
      const board = new THREE.Mesh(boardGeo, woodMat)
      board.position.set(0, 1.1, 0.07)
      board.castShadow = true
      g.add(board)
      const tip = new THREE.Mesh(tipGeo, woodDarkMat)
      tip.position.y = 1.4
      g.add(tip)
      flag = new THREE.Mesh(flagGeo, greenMat)
      flag.position.set(0.3, 1.72, 0)
      flag.castShadow = true
      g.add(flag)
    } else if (node.state === 'available') {
      // R38 — disponible: desbloqueado en espera; aro turquesa sobre el poste,
      // sin gema ni estandarte (el «aquí y ahora» ámbar queda para el actual)
      const post = new THREE.Mesh(postGeo, woodDarkMat)
      post.position.y = 0.26
      post.castShadow = true
      g.add(post)
      const ring = new THREE.Mesh(ringGeo, tealMat)
      ring.castShadow = true
      g.add(ring)
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + rand() * 0.8
        const pb = new THREE.Mesh(pebbleGeo, stoneDarkMat)
        pb.position.set(Math.cos(a) * 0.55, 0.3, Math.sin(a) * 0.55)
        pb.rotation.set(rand() * 3, rand() * 3, rand() * 3)
        pb.castShadow = true
        g.add(pb)
      }
    } else if (node.state === 'current') {
      const pole = new THREE.Mesh(poleGeo, woodDarkMat)
      pole.position.y = 0.26
      pole.castShadow = true
      g.add(pole)
      flag = new THREE.Mesh(flagGeo, amberMat)
      flag.position.set(0.3, 2.02, 0)
      flag.castShadow = true
      g.add(flag)
      gem = new THREE.Mesh(gemGeo, gemMat)
      gem.position.set(0, 1.55, 0)
      gem.castShadow = true
      g.add(gem)
      glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture(), color: 0xffd27a, transparent: true, opacity: 0.55, depthWrite: false,
      }))
      glow.scale.setScalar(1.6)
      glow.position.set(0, 1.55, 0)
      g.add(glow)
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + rand() * 0.8
        const pb = new THREE.Mesh(pebbleGeo, stoneDarkMat)
        pb.position.set(Math.cos(a) * 0.55, 0.3, Math.sin(a) * 0.55)
        pb.rotation.set(rand() * 3, rand() * 3, rand() * 3)
        pb.castShadow = true
        g.add(pb)
      }
    } else {
      // bloqueado: mojones de piedra y letrero vacío
      const c1 = new THREE.Mesh(cairnGeo, stoneDarkMat)
      c1.position.set(0.14, 0.5, 0.08)
      c1.rotation.set(rand(), rand(), 0)
      c1.castShadow = true
      g.add(c1)
      const c2 = new THREE.Mesh(cairnTopGeo, stoneDarkMat)
      c2.position.set(0.1, 0.86, 0.05)
      c2.rotation.set(rand() * 0.6, rand(), rand() * 0.5)
      c2.castShadow = true
      g.add(c2)
      const post = new THREE.Mesh(postGeo, woodDarkMat)
      post.position.y = 0.26
      post.castShadow = true
      g.add(post)
      const board = new THREE.Mesh(boardSmGeo, grayMat)
      board.position.set(0, 1.02, 0.07)
      board.castShadow = true
      g.add(board)
    }

    const hit = new THREE.Mesh(hitGeo, hitMat)
    hit.position.y = 0.9
    hit.userData.d3dId = node.id
    g.add(hit)
    hits.push(hit)

    visuals.push({
      group: g,
      anchor: base.clone().add(new THREE.Vector3(0, node.final ? 2.55 : 2.4, 0)),
      gem, gemBaseY, glow, flag,
      ph: rand() * Math.PI * 2,
      scale: 1, targetScale: 1,
    })
    group.add(g)
  })

  return {
    group,
    visuals,
    hits,
    dispose: () => {
      geos.forEach(g => g.dispose())
      mats.forEach(m => m.dispose())
    },
  }
}
