// R37 — rig de cámara del diorama (extracción evolutiva desde landscape3d.tsx).
//
// Qué concentra este módulo:
//  · Cámara PERSPECTIVA (R21, intacta) + cámara ORTOGRÁFICA (prototipo R37):
//    comparten pose y ángulo de diorama; el zoom propio (botones +/− y
//    pellizco) se traduce a distancia en perspectiva y a factor de zoom en
//    ortográfica, con encuadre equivalente (misma vista al conmutar).
//  · Dos MODOS: 'follow' (sigue el camino, comportamiento R21 sin cambios) y
//    'world' (vista World Map: encuadre del mundo completo — base del mapa
//    global del PDF maestro; el cableado visible llega con la isla R38).
//  · Transiciones suaves follow ↔ world (interpolación de pose con easing).
//  · UN solo OrbitControls: al conmutar proyección se intercambia la cámara
//    activa conservando pose, límites y damping (nada se rearma a saltos).
//
// Decisiones de diseño R37:
//  · REF_DIST = |CAM_OFF| ≈ 21.67: a esa distancia el frustum ortográfico base
//    reproduce EXACTAMENTE el encuadre perspectiva, y el zoom orto = REF_DIST /
//    distancia deseada mantiene la equivalencia al hacer zoom.
//  · desiredDist sigue siendo la única fuente de verdad de la intención de
//    zoom del usuario; la proyección sólo cambia cómo se materializa.
//  · Los límites de órbita R21 (polar/azimut) no cambian entre modos; sólo los
//    de distancia se adaptan al encuadre del modo world.

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type D3Projection = 'persp' | 'ortho'
export type D3CamMode = 'follow' | 'world'

const FOV = 55
// R40: DOS poses de diorama — la referencia del usuario es un 3/4 con
// R40: el modo WORLD usa su propia pose diagonal (ver CAM_OFF_WORLD).
const CAM_OFF_FOLLOW = new THREE.Vector3(0, 12.6, 18.2) // ≈34.7°
// R40: el shot world YA NO es frontal (el strip vertical de R38 era parte de
// la queja del usuario): acimut 42° + pitch 38.5° = la isla corre en DIAGONAL
// por el cuadro y se ven top + corte lateral a la vez, como las referencias.
const CAM_OFF_WORLD = new THREE.Vector3(13, 15.5, 14.5)
const REF_DIST = CAM_OFF_FOLLOW.length() // ≈22.24 (equivalencia persp↔orto del follow)
const FOLLOW_MIN = 9
const FOLLOW_MAX = 34

// Bounds del mundo jugable (R38: la isla de referencia — silueta rx 28,
// z ≈ 19.5..-112.5 + margen para la roca colgante); la fórmula de fit es
// genérica (semiancho × semiprofundidad proyectada → distancia).
const WORLD_X_HALF = 28
const WORLD_Z_NEAR = 20
const WORLD_Z_FAR = -113

const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
// R41 (transitorio de evidencia, 1 frame): un NaN llega a getPointAt por la
// división de arcLengths y CatmullRom lee points[NaN] = undefined. Todo u del
// rig queda FINITO por construcción, pero se blindan las 3 rutas.
const clampU = (u: number) => (Number.isFinite(u) ? Math.min(0.965, Math.max(0.02, u)) : 0.08)

interface FollowFlight { t0: number; dur: number; u0: number; u1: number }
interface ModeFlight {
  t0: number; dur: number
  p0: THREE.Vector3; g0: THREE.Vector3
  p1: THREE.Vector3; g1: THREE.Vector3
  toMode: D3CamMode; flyU: number
}

export interface CameraRigOpts {
  dom: HTMLElement
  width: number
  height: number
  curve: THREE.CatmullRomCurve3
  hAt: (x: number, z: number) => number
  reduced: boolean
}

export class CameraRig {
  proj: D3Projection = 'persp'
  mode: D3CamMode = 'follow'
  perspCam: THREE.PerspectiveCamera
  orthoCam: THREE.OrthographicCamera
  controls: OrbitControls

  private dom: HTMLElement
  private curve: THREE.CatmullRomCurve3
  private hAt: (x: number, z: number) => number
  private reduced: boolean

  private focusU_ = 0.08
  private distFollow = REF_DIST
  private distWorld = 72
  private worldMin = 40
  private worldMax = 115
  private flight: FollowFlight | null = null
  private modeFlight: ModeFlight | null = null
  private halfH0: number
  private dirV = new THREE.Vector3()

  constructor(opts: CameraRigOpts) {
    this.dom = opts.dom
    this.curve = opts.curve
    this.hAt = opts.hAt
    this.reduced = opts.reduced
    const aspect = Math.max(0.2, (opts.width || 4) / (opts.height || 3))

    this.perspCam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 520)
    // frustum orto base: el que reproduce la perspectiva a REF_DIST
    this.halfH0 = REF_DIST * Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    this.orthoCam = new THREE.OrthographicCamera(
      -this.halfH0 * aspect, this.halfH0 * aspect, this.halfH0, -this.halfH0, 0.1, 520,
    )

    this.controls = new OrbitControls(this.perspCam, opts.dom)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.07
    this.controls.enablePan = false
    this.controls.enableZoom = false        // la rueda queda para el scroll de la página
    this.controls.rotateSpeed = 0.5
    this.controls.minPolarAngle = Math.PI * 0.22
    this.controls.maxPolarAngle = Math.PI * 0.47
    this.controls.minAzimuthAngle = -1.05
    this.controls.maxAzimuthAngle = 1.05
    this.controls.minDistance = FOLLOW_MIN
    this.controls.maxDistance = FOLLOW_MAX

    this.refitWorld(aspect)
    this.placeFollow(this.focusU_)
    this.syncOrtho(true)
  }

  /* ===== estado expuesto ===== */

  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.proj === 'ortho' ? this.orthoCam : this.perspCam
  }
  get target(): THREE.Vector3 { return this.controls.target }
  get focusU(): number { return this.focusU_ }
  get busy(): boolean { return this.flight !== null || this.modeFlight !== null }
  get desiredDist(): number { return this.mode === 'world' ? this.distWorld : this.distFollow }

  /* ===== colocación de poses ===== */

  // pose R21 (R40: offset follow a 34.7°): target sobre el camino (+1.15)
  private placeFollow(u: number) {
    const p = this.curve.getPointAt(u)
    const gy = this.hAt(p.x, p.z)
    this.controls.target.set(p.x, gy + 1.15, p.z)
    this.camera.position.set(p.x + CAM_OFF_FOLLOW.x, gy + CAM_OFF_FOLLOW.y, p.z + CAM_OFF_FOLLOW.z)
    this.camera.lookAt(this.controls.target)
  }

  private worldCenter(out: THREE.Vector3): THREE.Vector3 {
    const cz = (WORLD_Z_NEAR + WORLD_Z_FAR) / 2
    // R40: desplazado hacia el extremo CERCANO — la perspectiva agranda el
    // half cercano y sin este offset la isla se ve caída hacia el borde inferior
    return out.set(3, this.hAt(0, cz) + 1.2, cz + 20)
  }

  // distancia que encuadra la isla completa según el aspecto del viewport.
  // R38 (corrección geométrica): el borde CERCANO del eje z está
  // zHalf·cos(pitch) más cerca de la cámara que el target — si sólo se
  // compensa el semiancho proyectado (zHalf·sin/t), el near-tip sale del
  // cuadro (ángulo real ≈ atan(zHalf·sin / (d − zHalf·cos)) > FOV/2).
  private fitWorldDist(aspect: number): number {
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    const pitch = Math.atan2(CAM_OFF_WORLD.y, CAM_OFF_WORLD.z)
    // R40: con acimut diagonal, la profundidad eficaz de la isla se proyecta
    // sobre el eje de vista (la longitud Z ya no va alineada con la cámara)
    const az = Math.atan2(CAM_OFF_WORLD.x, CAM_OFF_WORLD.z)
    const eff = (WORLD_Z_NEAR - WORLD_Z_FAR) / 2 * Math.abs(Math.cos(az)) + WORLD_X_HALF * Math.abs(Math.sin(az))
    const dV = (eff * Math.sin(pitch)) / t + eff * Math.cos(pitch) + 7
    const dH = WORLD_X_HALF / (t * Math.max(0.35, aspect))
    // R40 (ajuste empírico por captura): la fórmula analítica sobreestima para
    // un OBB tan alargado (133×56) visto en diagonal; el tope 132 mantiene la
    // isla LLENANDO el cuadro (verificado en evidencia r40)
    return Math.min(132, Math.max(30, Math.max(dV, dH) * 1.04))
  }

  private refitWorld(aspect: number) {
    const fit = this.fitWorldDist(aspect)
    this.distWorld = fit
    this.worldMin = fit * 0.55
    this.worldMax = fit * 1.6
    this.applyControlsBounds()
  }

  private placeWorld() {
    this.worldCenter(this.controls.target)
    this.dirV.copy(CAM_OFF_WORLD).normalize()
    this.camera.position.copy(this.controls.target).addScaledVector(this.dirV, this.distWorld)
    this.camera.lookAt(this.controls.target)
  }

  private poseFor(m: D3CamMode, flyU: number, outP: THREE.Vector3, outG: THREE.Vector3) {
    if (m === 'follow') {
      const p = this.curve.getPointAt(clampU(flyU))
      const gy = this.hAt(p.x, p.z)
      outG.set(p.x, gy + 1.15, p.z)
      outP.set(p.x + CAM_OFF_FOLLOW.x, gy + CAM_OFF_FOLLOW.y, p.z + CAM_OFF_FOLLOW.z)
    } else {
      this.worldCenter(outG)
      this.dirV.copy(CAM_OFF_WORLD).normalize()
      outP.copy(outG).addScaledVector(this.dirV, this.distWorld)
    }
  }

  private applyControlsBounds() {
    if (this.mode === 'world' || this.modeFlight?.toMode === 'world') {
      this.controls.minDistance = this.worldMin
      this.controls.maxDistance = this.worldMax
    } else {
      this.controls.minDistance = FOLLOW_MIN
      this.controls.maxDistance = FOLLOW_MAX
    }
  }

  // sincroniza el zoom orto con la intención de zoom (distancia deseada)
  private syncOrtho(snap = false) {
    const want = REF_DIST / this.desiredDist
    if (snap || this.reduced || Math.abs(want - this.orthoCam.zoom) < 1e-4) {
      this.orthoCam.zoom = want
    } else {
      this.orthoCam.zoom += (want - this.orthoCam.zoom) * 0.14
    }
    this.orthoCam.updateProjectionMatrix()
  }

  /* ===== API pública (misma semántica que las funciones R21 que sustituye) ===== */

  // coloca la cámara en un punto del camino SIN vuelo (primer montaje)
  jumpTo(u: number) {
    this.focusU_ = clampU(u)
    if (this.mode === 'follow' && !this.modeFlight) {
      this.placeFollow(this.focusU_)
      this.syncOrtho(true)
    }
  }

  // vuelo por el camino (flyToU de R21); si estamos en 'world' vuelve a 'follow'
  followU(u1: number, instant = false) {
    const target = clampU(u1)
    if (this.mode !== 'follow' || this.modeFlight) {
      this.setMode('follow', { flyU: target })
      return
    }
    const dist = Math.abs(target - this.focusU_) * this.curve.getLength()
    if (instant || this.reduced || dist < 0.6) {
      this.focusU_ = target
      this.flight = null
      this.controls.enabled = true
      this.placeFollow(this.focusU_)
      this.syncOrtho(true)
      return
    }
    this.flight = { t0: performance.now(), dur: Math.min(2400, 750 + dist * 16), u0: this.focusU_, u1: target }
    this.focusU_ = target
    this.controls.enabled = false
  }

  // conmuta follow ↔ world con transición suave (o instantánea si procede)
  setMode(m: D3CamMode, opts: { instant?: boolean; flyU?: number } = {}) {
    if (m === this.mode && !this.modeFlight) return
    const flyU = opts.flyU != null ? clampU(opts.flyU) : this.focusU_
    this.flight = null
    if (opts.instant || this.reduced) {
      this.modeFlight = null
      this.mode = m
      this.applyControlsBounds()
      if (m === 'follow') { this.placeFollow(flyU); this.focusU_ = flyU }
      else this.placeWorld()
      this.syncOrtho(true)
      this.controls.enabled = true
      return
    }
    const p0 = this.camera.position.clone()
    const g0 = this.controls.target.clone()
    const p1 = new THREE.Vector3()
    const g1 = new THREE.Vector3()
    this.poseFor(m, flyU, p1, g1)
    this.modeFlight = { t0: performance.now(), dur: 1050, p0, g0, p1, g1, toMode: m, flyU }
    this.applyControlsBounds()
    this.controls.enabled = false
  }

  // conmuta perspectiva ↔ ortográfica conservando pose y encuadre
  setProjection(p: D3Projection) {
    if (p === this.proj) return
    const from = this.camera
    const to = p === 'ortho' ? this.orthoCam : this.perspCam
    to.position.copy(from.position)
    to.quaternion.copy(from.quaternion)
    if (p === 'ortho') {
      this.orthoCam.zoom = REF_DIST / this.desiredDist
      this.orthoCam.updateProjectionMatrix()
    }
    this.proj = p
    this.controls.object = to
    this.controls.update()
  }

  zoomStep(dir: number) {
    if (this.mode === 'world') {
      this.distWorld = Math.min(this.worldMax, Math.max(this.worldMin, this.distWorld - dir * 4.6))
    } else {
      this.distFollow = Math.min(FOLLOW_MAX, Math.max(FOLLOW_MIN, this.distFollow - dir * 4.6))
    }
  }

  /* pellizco táctil: la misma intención de zoom que R21 (pinchDist0 × factor) */
  private pinchDist0 = 0
  pinchStart() {
    this.pinchDist0 = this.desiredDist
    this.controls.enabled = false
  }
  pinchMove(factor: number) {
    if (this.pinchDist0 <= 0) return
    if (this.mode === 'world') {
      this.distWorld = Math.min(this.worldMax, Math.max(this.worldMin, this.pinchDist0 * factor))
    } else {
      this.distFollow = Math.min(FOLLOW_MAX, Math.max(FOLLOW_MIN, this.pinchDist0 * factor))
    }
  }
  pinchEnd() {
    this.pinchDist0 = 0
    if (!this.busy) this.controls.enabled = true
  }

  /* actualización por frame: transición de modo, vuelo de camino u órbita+zoom */
  update(now: number) {
    if (this.modeFlight) {
      const mf = this.modeFlight
      const k = Math.min(1, (now - mf.t0) / mf.dur)
      const e = easeInOut(k)
      this.camera.position.lerpVectors(mf.p0, mf.p1, e)
      this.controls.target.lerpVectors(mf.g0, mf.g1, e)
      this.camera.lookAt(this.controls.target)
      if (k >= 1) {
        this.mode = mf.toMode
        this.focusU_ = mf.flyU
        this.modeFlight = null
        this.applyControlsBounds()
        this.controls.enabled = true
        this.syncOrtho(true)
      }
      return
    }
    if (this.flight) {
      const fl = this.flight
      const k = Math.min(1, (now - fl.t0) / fl.dur)
      const e = easeInOut(k)
      const rawU = fl.u0 + (fl.u1 - fl.u0) * e
      const u = Number.isFinite(rawU) ? Math.min(1, Math.max(0, rawU)) : fl.u1
      const p = this.curve.getPointAt(u)
      const gy = this.hAt(p.x, p.z)
      this.controls.target.set(p.x, gy + 1.15, p.z)
      this.camera.position.set(p.x + CAM_OFF_FOLLOW.x, gy + CAM_OFF_FOLLOW.y, p.z + CAM_OFF_FOLLOW.z)
      this.camera.lookAt(this.controls.target)
      if (k >= 1) { this.flight = null; this.controls.enabled = true }
      return
    }
    this.controls.update()
    if (this.proj === 'ortho') {
      this.syncOrtho()
    } else {
      // zoom propio (botones +/− y pellizco): ajusta la distancia al foco
      const curDist = this.camera.position.distanceTo(this.controls.target)
      if (Math.abs(curDist - this.desiredDist) > 0.05) {
        const nd = curDist + (this.desiredDist - curDist) * (this.reduced ? 1 : 0.14)
        this.dirV.copy(this.camera.position).sub(this.controls.target).normalize()
        this.camera.position.copy(this.controls.target).addScaledVector(this.dirV, nd)
      }
    }
  }

  resize(w: number, h: number) {
    if (!w || !h) return
    const aspect = w / h
    this.perspCam.aspect = aspect
    this.perspCam.updateProjectionMatrix()
    this.orthoCam.left = -this.halfH0 * aspect
    this.orthoCam.right = this.halfH0 * aspect
    this.orthoCam.top = this.halfH0
    this.orthoCam.bottom = -this.halfH0
    this.orthoCam.updateProjectionMatrix()
    this.refitWorld(aspect)
    if (this.mode === 'world' && !this.modeFlight) { this.placeWorld(); this.syncOrtho(true) }
  }

  dispose() {
    this.controls.dispose()
  }
}
