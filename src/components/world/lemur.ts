// R41 — LÉMUR COMPAÑERO «Axi» (modelo NewDLC de OpenGameArt, CC0 1.0):
// sustituye al cuervo R39/R40 como compañero del camino. Mismo papel
// REACTIVO (requestFocus/syncNodes disparan; este módulo es sólo locomoción,
// cero lógica educativa), ahora con el GLB esquelético real:
//   clips: idle (1.67 s) · run (1.7 s) · AttackMelee (1.67 s, usado como
//   celebración/saludo: levanta el brazo) · ADefault (bind pose, sin uso)
// Locomoción TERRESTRE: el lémur corre por la isla junto al camino (no vuela);
// para distancias largas corre sincronizado con el vuelo de cámara vía dur.
//
// Degradación elegante: si el GLB no carga, buildLemurRig devuelve null y el
// mundo queda sin compañero (el resto del mundo procedural R40 intacto).
//
// reduced-motion: perchTo teletransporta, sin auto-look ni saltos; celebrate
// se reduce a la pose de brazo alzado sin rebote.
import * as THREE from 'three'
import { loadGlb } from './assets'

export type LemurState = 'idle' | 'look' | 'walk' | 'run' | 'celebrate'

export interface LemurPerch { pos: THREE.Vector3; yaw: number }

export interface LemurOpts {
  hAt: (x: number, z: number) => number
  reduced: boolean
}

export const LEMUR_URL = '/assets/world/mascot/lemur.glb'

// altura del compañero en unidades de mundo (los nodos miden ~2 u; el cuervo
// R39 lucía ~0.75 u de alto — el lémur bípedo necesita un poco más para leerse)
const LEMUR_H = 0.82
// velocidad base de referencia para el timeScale del clip run
const RUN_BASE = 2.3

const TAU = Math.PI * 2
const smooth01 = (k: number) => { const t = Math.min(1, Math.max(0, k)); return t * t * (3 - 2 * t) }
const angLerp = (a: number, b: number, k: number) => {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return a + d * k
}

export class LemurRig {
  group = new THREE.Group()
  state: LemurState = 'idle'

  private hAt: (x: number, z: number) => number
  private reduced: boolean
  private mixer: THREE.AnimationMixer
  private aIdle: THREE.AnimationAction
  private aRun: THREE.AnimationAction
  private aAtk: THREE.AnimationAction
  private model: THREE.Group

  // estado interno de la máquina
  private st = 0
  private perchPos = new THREE.Vector3()
  private perchYaw = 0
  private runTo: THREE.Vector3 | null = null
  private runDur = 1.2
  private queuedCelebrate = false
  private lookBaseYaw = 0

  constructor(glb: { scene: THREE.Group; animations: THREE.AnimationClip[] }, opts: LemurOpts) {
    this.hAt = opts.hAt
    this.reduced = opts.reduced

    // normaliza: altura LEMUR_H, base en y=0, centrado en x/z (el GLB trae
    // escala cm y la cola desplaza el centro)
    const model = glb.scene
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.frustumCulled = false // skinned: el bbox de bind pose no sigue a los huesos (patrón fauna R40)
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (m && 'metalness' in m) { m.metalness = 0; m.roughness = 1 }
      }
    })
    // clips (nombres reales: «cat5newrig|idle», «|run», «|AttackMelee»);
    // sin los tracks del nodo raíz que deshacen la normalización (ver abajo)
    const cleanAnims = stripRootTracks(glb.animations)
    this.mixer = new THREE.AnimationMixer(model)
    const pick = (frag: string) => {
      const clip = cleanAnims.find(a => a.name.toLowerCase().includes(frag))
      if (!clip) throw new Error(`lemur.glb sin clip «${frag}»`)
      return this.mixer.clipAction(clip)
    }
    this.aIdle = pick('idle')
    this.aRun = pick('run')
    this.aAtk = pick('attackmelee')
    this.aIdle.play()
    // R41 (hallazgo de evidencia): el box de un SkinnedMesh es la POSE ACTUAL
    // de los huesos (SkinnedMesh.computeBoundingBox), NO la bind pose — el
    // esqueleto debe poser (idle + update(0)) ANTES de medir o la
    // normalización sale con la dimensión equivocada (lémur gigante/tumbado).
    this.mixer.update(0)

    // R41 (bug de evidencia, VERIFICADO por sondeo de esquinas): Box3.
    // setFromObject miente con este GLB — usa geometry.boundingBox (bind pose
    // local) por la matrixWorld de la cadena, y la cadena trae la rotación
    // FBX Z→Y: el lemur normalizaba a un alto/fondo equivocado (render real:
    // 1.41 u y flotando +0.58 u). La medida honesta es la POSE ACTUAL de los
    // huesos transformada a mundo (SkinnedMesh.computeBoundingBox de r180
    // devuelve el bbox posado en espacio local del mesh).
    model.scale.setScalar(1)
    model.position.set(0, 0, 0)
    model.rotation.set(0, 0, 0)
    model.updateMatrixWorld(true)
    const p0 = posedBoxOf(model)
    const s = LEMUR_H / (p0.max.y - p0.min.y)
    model.scale.setScalar(s)
    model.updateMatrixWorld(true)
    const p1 = posedBoxOf(model)
    model.position.set(
      -(p1.min.x + p1.max.x) / 2,
      -p1.min.y, // pies al suelo del grupo (la percha ya suma +0.1)
      -(p1.min.z + p1.max.z) / 2,
    )
    this.model = model
    this.group.add(model)
  }

  /* ===== API (análoga a RavenRig para minimizar el diff en landscape3d) ===== */

  setState(s: LemurState) {
    if (s === this.state) return
    this.state = s
    this.st = 0
    if (s === 'look') this.lookBaseYaw = this.perchYaw
  }

  // mueve al lémur junto a un nodo: camina (paso corto) o corre sincronizado
  // con el vuelo de cámara vía dur
  perchTo(perch: LemurPerch, o: { instant?: boolean; dur?: number } = {}) {
    this.perchPos.copy(perch.pos)
    this.perchYaw = perch.yaw
    if (this.reduced || o.instant) {
      this.runTo = null
      this.group.position.copy(perch.pos)
      this.group.position.y = this.hAt(perch.pos.x, perch.pos.z)
      this.group.rotation.y = perch.yaw
      this.setState('idle')
      return
    }
    if (this.state === 'run') {
      // re-plan en carrera: retoma desde la posición actual
      this.startRun(this.group.position.clone(), perch.pos, o.dur)
      return
    }
    const d = Math.hypot(perch.pos.x - this.group.position.x, perch.pos.z - this.group.position.z)
    if (d < 0.45) { // ya está en casa
      this.runTo = null
      this.group.rotation.y = perch.yaw
      this.setState('idle')
      return
    }
    this.startRun(this.group.position.clone(), perch.pos, o.dur)
  }

  // celebra (lección completada); si corre, lo hace al llegar
  celebrate() {
    if (this.state === 'run') {
      this.queuedCelebrate = true
      return
    }
    this.queuedCelebrate = false
    this.setState('celebrate')
  }

  private startRun(from: THREE.Vector3, to: THREE.Vector3, dur?: number) {
    this.runTo = new THREE.Vector3(to.x, to.y, to.z)
    this.runDur = Math.min(2.4, Math.max(0.9, dur ?? Math.max(0.7, 0.5 + Math.hypot(to.x - from.x, to.z - from.z) / RUN_BASE)))
    this.setState('run')
  }

  /* ===== actualización por frame ===== */

  update(t: number, dt: number) {
    this.st += dt
    switch (this.state) {
      case 'idle': this.updIdle(t); break
      case 'look': this.updLook(); break
      case 'run': this.updRun(dt); break
      case 'walk': this.updRun(dt); break
      case 'celebrate': this.updCelebrate(); break
    }
    this.mixer.update(dt)
  }

  // posado: clip idle (ya respira solo) + giro de curiosidad cada 8 s
  private updIdle(t: number) {
    this.crossTo(this.aIdle, 0.28, 1)
    this.group.rotation.y = angLerp(this.group.rotation.y, this.perchYaw, 0.12)
    if (!this.reduced && this.st > 8) this.setState('look')
  }

  // LookAround: barrido de cuerpo izq→der→centro (2.6 s) sobre el idle
  private updLook() {
    this.crossTo(this.aIdle, 0.28, 1)
    const p = this.st / 2.6
    const sway = p < 1 / 3 ? smooth01(p * 3) * 0.45
      : p < 2 / 3 ? (0.45 - smooth01((p - 1 / 3) * 3) * 0.85)
      : (-0.4 + smooth01((p - 2 / 3) * 3) * 0.4)
    this.group.rotation.y = angLerp(this.group.rotation.y, this.lookBaseYaw + sway, 1 - Math.exp(-0.1))
    if (p >= 1) this.setState('idle')
  }

  // Run/Walk: corre por el terreno siguiendo hAt, rumbo suavizado;
  // clip run con timeScale acorde a la velocidad real
  private updRun(dt: number) {
    const to = this.runTo
    if (!to) { this.setState('idle'); return }
    const dx = to.x - this.group.position.x
    const dz = to.z - this.group.position.z
    const d = Math.hypot(dx, dz)
    const speed = Math.min(4.6, Math.max(1.4, Math.hypot(dx, dz) / this.runDur * 1.06))
    const step = Math.min(d, speed * dt)
    this.group.position.x += (dx / (d || 1)) * step
    this.group.position.z += (dz / (d || 1)) * step
    this.group.position.y = this.hAt(this.group.position.x, this.group.position.z)
    this.group.rotation.y = angLerp(this.group.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-dt * 9))
    this.crossTo(this.aRun, 0.18, this.state === 'walk' ? 0.55 : Math.max(0.75, speed / RUN_BASE))
    if (d < 0.06) {
      this.runTo = null
      this.group.position.copy(to)
      this.group.position.y = this.hAt(to.x, to.z)
      this.group.rotation.y = this.perchYaw
      if (this.queuedCelebrate) {
        this.queuedCelebrate = false
        this.setState('celebrate')
      } else this.setState('idle')
    }
  }

  // Celebrate: clip AttackMelee (levanta el brazo) + dos saltitos de júbilo
  private updCelebrate() {
    const amp = this.reduced ? 0 : 1
    this.crossTo(this.aAtk, 0.16, 1)
    this.aAtk.setLoop(THREE.LoopOnce, 1)
    this.aAtk.clampWhenFinished = true
    const p = this.st / 1.7
    // saltitos: dos botes verticales al ritmo del brazo alzado
    const hop = Math.abs(Math.sin(p * TAU)) * 0.14 * amp
    this.group.position.y = this.hAt(this.group.position.x, this.group.position.z) + hop
    this.group.rotation.y = angLerp(this.group.rotation.y, this.perchYaw + Math.sin(p * TAU * 2) * 0.16 * amp, 0.14)
    if (p >= 1) {
      this.aAtk.stop()
      this.setState('idle')
    }
  }

  // crossfade suave hacia una acción (evita el salto brusco entre clips)
  private crossTo(a: THREE.AnimationAction, fade: number, timeScale: number) {
    if (a.timeScale !== timeScale) a.timeScale = timeScale
    if (!a.isRunning()) {
      a.reset().fadeIn(fade).play()
      const others = [this.aIdle, this.aRun, this.aAtk].filter(x => x !== a)
      for (const o of others) if (o.isRunning()) o.fadeOut(fade)
    }
  }

  dispose() {
    this.mixer.stopAllAction()
    this.model.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry.dispose()
        const mm = mesh.material
        if (Array.isArray(mm)) mm.forEach(x => x.dispose())
        else mm.dispose()
      }
    })
  }
}

// fábrica asíncrona: null si el GLB no está disponible (degradación elegante)
export async function buildLemurRig(opts: LemurOpts): Promise<LemurRig | null> {
  try {
    // clone:true — el GLB esquelético se comparte con la mascota UI (URL única)
    const glb = await loadGlb(LEMUR_URL, { clone: true })
    return new LemurRig(glb, opts)
  } catch {
    return null
  }
}

// R41 (bug de evidencia): los clips traen 3 tracks extra dirigidos al NODO
// RAÍZ del GLB (node0 sin nombre → PropertyBinding con nodeName vacío =
// root del mixer). Cada frame sobrescriben position/quaternion/scale del
// modelo con valores crudos del FBX (cm) y DESHACEN la normalización de
// escala (los huesos quedan a tamaño cm y el lémur se vuelve microscópico).
// Se eliminan: los 30 tracks × 3 de los huesos reales quedan intactos.
// (Exportada: la mascota UI de scene3d.tsx comparte el MISMO GLB y el mismo
// fix — sin filtrar, el mixer desplaza el modelo fuera del encuadre.)
export function stripRootTracks(animations: THREE.AnimationClip[]): THREE.AnimationClip[] {
  return animations.map((clip) => {
    const keep = clip.tracks.filter((tr) => {
      const dot = tr.name.indexOf('.')
      const nodeName = dot <= 0 ? '' : tr.name.slice(0, dot)
      return nodeName !== ''
    })
    return keep.length === clip.tracks.length
      ? clip
      : new THREE.AnimationClip(clip.name, clip.duration, keep)
  })
}

// R41: bbox MUNDIAL de la pose actual del esqueleto (no de la bind pose).
// setFromObject usa geometry.boundingBox (bind pose, espacio local del mesh)
// y este GLB trae la rotación FBX Z→Y en la cadena de nodos: para medir la
// verdad renderizada se toma el bbox posado de r180 (SkinnedMesh.
// computeBoundingBox → mesh.boundingBox local) y se transforman sus 8
// esquinas por matrixWorld. Exportada: la mascota UI comparte el mismo GLB.
export function posedBoxOf(root: THREE.Object3D): { min: THREE.Vector3; max: THREE.Vector3 } {
  root.updateMatrixWorld(true)
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  const corners: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3())
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh
    if (!m.isSkinnedMesh) return
    m.computeBoundingBox() // r180: recalcula DESDE LA POSE ACTUAL en m.boundingBox
    const bb = m.boundingBox
    if (!bb) return
    let k = 0
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) {
        for (const z of [bb.min.z, bb.max.z]) {
          corners[k++].set(x, y, z)
        }
      }
    }
    for (const c of corners) {
      c.applyMatrix4(m.matrixWorld)
      min.min(c)
      max.max(c)
    }
  })
  return { min, max }
}
