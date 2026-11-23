'use client'

/*
 * ===================== R18 — CAPAS 3D (three.js) =====================
 * Objetos 3D reales para los escenarios del camino, la mascota Axi y el
 * mapa del viaje. Todo procedural: sin texturas, modelos ni peticiones
 * externas. Degradación elegante: si no hay WebGL o se pidió «menos
 * movimiento», la capa 3D no se monta y quedan los adornos SVG/CSS de
 * R16/R17. El módulo se carga con next/dynamic (ssr:false): three.js no
 * viaja en el bundle inicial ni interviene en el SSR.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { loadGlb } from './world/assets'
import { posedBoxOf, stripRootTracks } from './world/lemur'

export type ScenePhase = 'dawn' | 'day' | 'dusk' | 'night'

/* ── utilidades compartidas ─────────────────────────────────────────── */

function makeRenderer(canvas: HTMLCanvasElement, dprCap = 1.75): THREE.WebGLRenderer | null {
  try {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))
    // R36: gestión de color coherente con el diorama — Neutral comprime
    // brillos con desplazamiento de tono mínimo; los ShaderMaterial propios
    // no incluyen el chunk y mantienen sus colores exactos
    r.toneMapping = THREE.NeutralToneMapping
    r.toneMappingExposure = 1.0
    return r
  } catch {
    return null
  }
}

const PHASE_LIGHT: Record<ScenePhase, { sun: number; amb: number; sunColor: number }> = {
  dawn: { sun: 0.95, amb: 0.72, sunColor: 0xffd9a8 },
  day: { sun: 1.15, amb: 0.82, sunColor: 0xfff4e0 },
  dusk: { sun: 0.8, amb: 0.55, sunColor: 0xffb27c },
  night: { sun: 0.42, amb: 0.3, sunColor: 0x9fb2e8 },
}

// Ruido de valor 3D determinista (para el relieve del planeta)
function vnoise(x: number, y: number, z: number): number {
  const h = (a: number, b: number, c: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}

/* ── HOJAS 3D — pradera y otoño: caen cerca del camino, con viento ──── */

const LEAF_PALETTES: Record<number, number[]> = {
  1: [0x6faf62, 0x4e8a4a, 0x9bc46a, 0xd9c36a],
  2: [0xe0a044, 0xc97b2d, 0xb85c22, 0xd9822b, 0xe3b25a],
}

type LeafState = {
  x: number; y: number; z: number; fall: number; swayA: number; swayF: number
  rotX: number; rotZ: number; spin: number; gust: number; landed: number; scale: number
}

export function Leaves3D({ variant, phase, onReady }: {
  variant: number
  phase: ScenePhase
  onReady?: () => void
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const phaseRef = useRef<ScenePhase>(phase)
  const inViewRef = useRef(false)
  const readyRef = useRef(onReady)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { readyRef.current = onReady }, [onReady])
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { inViewRef.current = true; return }
    const io = new IntersectionObserver((es) => { inViewRef.current = es[0]?.isIntersecting ?? true }, { threshold: 0.04 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = boxRef.current
    if (!box) return
    const canvas = document.createElement('canvas')
    box.appendChild(canvas)
    const renderer = makeRenderer(canvas)
    if (!renderer) { canvas.remove(); return }

    const scene = new THREE.Scene()
    const w = Math.max(box.clientWidth, 120)
    const h = Math.max(box.clientHeight, 90)
    renderer.setSize(w, h, false)
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 40)
    camera.position.set(0, 6.6, 7.8)
    camera.lookAt(0, 0.4, -0.6)

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.15)
    sun.position.set(3, 8, 4)
    const amb = new THREE.AmbientLight(0xffffff, 0.82)
    scene.add(sun, amb)

    const COUNT = 64
    const geo = new THREE.PlaneGeometry(0.15, 0.19)
    const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const palette = LEAF_PALETTES[variant] || LEAF_PALETTES[1]
    const tint = new THREE.Color()
    const leaves: LeafState[] = []
    for (let i = 0; i < COUNT; i++) {
      const near = Math.random() < 0.62 // la mayoría cae cerca del camino
      leaves.push({
        x: (Math.random() * 2 - 1) * (near ? 2.6 : 5),
        y: Math.random() * 7 + 0.2,
        z: (Math.random() * 2 - 1) * 2.2,
        fall: 0.45 + Math.random() * 0.55,
        swayA: 0.25 + Math.random() * 0.5,
        swayF: 0.5 + Math.random() * 0.8,
        rotX: Math.random() * Math.PI,
        rotZ: Math.random() * Math.PI,
        spin: (Math.random() * 1.6 - 0.8) * 1.4,
        gust: 0.6 + Math.random() * 0.8,
        landed: 0,
        scale: 0.7 + Math.random() * 0.7,
      })
      mesh.setColorAt(i, tint.setHex(palette[i % palette.length]))
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    scene.add(mesh)

    const dummy = new THREE.Object3D()
    let raf = 0
    let last = performance.now()
    let t = 0
    let readySent = false

    const resize = () => {
      const bw = Math.max(box.clientWidth, 120)
      const bh = Math.max(box.clientHeight, 90)
      renderer.setSize(bw, bh, false)
      camera.aspect = bw / bh
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(box)

    const respawn = (L: LeafState) => {
      L.y = 6.5 + Math.random() * 2
      L.x = (Math.random() * 2 - 1) * 4.6
      L.z = (Math.random() * 2 - 1) * 2.2
      L.rotX = Math.random() * Math.PI
      L.landed = 0
    }

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!inViewRef.current) { last = performance.now(); return }
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      t += dt
      // viento global: ráfagas lentas que empujan las hojas hacia el camino
      const wind = Math.sin(t * 0.32) * 0.5 + Math.sin(t * 0.13) * 0.35 + 0.25
      for (let i = 0; i < COUNT; i++) {
        const L = leaves[i]
        if (L.landed > 0) {
          L.landed -= dt
          if (L.landed <= 0) { respawn(L) }
          else {
            dummy.position.set(L.x, 0.03, L.z)
            dummy.rotation.set(-Math.PI / 2 + 0.12, L.rotX, L.rotZ)
            dummy.scale.setScalar(L.scale)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)
            continue
          }
        } else {
          L.y -= L.fall * dt
          L.x += (wind * L.gust + Math.sin(t * L.swayF + i) * L.swayA * 0.4) * dt
          L.rotX += dt * (0.45 + L.spin * 0.55)
          L.rotZ += dt * L.spin * 0.5
          if (L.y <= 0.04) { L.y = 0.03; L.landed = 5 + Math.random() * 7 }
        }
        dummy.position.set(L.x, L.y, L.z)
        dummy.rotation.set(L.rotX, i + t * 0.2, L.rotZ)
        dummy.scale.setScalar(L.scale)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true

      const ph = PHASE_LIGHT[phaseRef.current]
      const k = Math.min(dt * 2, 1)
      sun.intensity += (ph.sun - sun.intensity) * k
      amb.intensity += (ph.amb - amb.intensity) * k
      sun.color.lerp(tint.setHex(ph.sunColor), k)

      renderer.render(scene, camera)
      if (!readySent) { readySent = true; readyRef.current?.() }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      geo.dispose()
      mat.dispose()
      mesh.dispose()
      renderer.dispose()
      canvas.remove()
    }
  }, [variant])

  return <div ref={boxRef} className="scene3d scene3d-leaves" aria-hidden="true" />
}

/* ── AGUA 3D — río y lago: olas reales con shader, piedras y brillos ── */

const WATER_TONE: Record<'river' | 'lake', { amp: number }> = {
  river: { amp: 0.085 },
  lake: { amp: 0.05 },
}

const PHASE_WATER: Record<ScenePhase, { deep: number; shallow: number; sun: number; amb: number }> = {
  dawn: { deep: 0x2a6f8f, shallow: 0xe8cba0, sun: 1.0, amb: 0.72 },
  day: { deep: 0x1f6f8f, shallow: 0x9fe0dc, sun: 1.2, amb: 0.82 },
  dusk: { deep: 0x17325f, shallow: 0x7f9fc8, sun: 0.85, amb: 0.55 },
  night: { deep: 0x0f2440, shallow: 0x4a6f9f, sun: 0.45, amb: 0.3 },
}

const WATER_VS = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  varying float vH;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  float wave(vec2 p) {
    return sin(p.x * 2.2 + uTime * 1.1) * 0.55
         + sin(p.y * 3.1 - uTime * 1.5) * 0.30
         + sin((p.x + p.y) * 1.3 + uTime * 0.7) * 0.25
         + sin(p.x * 5.7 - uTime * 2.2) * 0.06;
  }
  void main() {
    vec3 pos = position;
    vec2 xz = pos.xz;
    float h = wave(xz) * uAmp;
    float e = 0.12;
    float hx = wave(xz + vec2(e, 0.0)) * uAmp;
    float hz = wave(xz + vec2(0.0, e)) * uAmp;
    pos.y += h;
    vH = h / max(uAmp, 0.0001);
    vN = normalize(vec3((h - hx) / e, 1.0, (h - hz) / e));
    vUv = uv;
    vW = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const WATER_FS = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uGlint;
  uniform float uAlpha;
  uniform float uTime;
  varying float vH;
  varying vec3 vN;
  varying vec3 vW;
  varying vec2 vUv;
  void main() {
    float m = smoothstep(-1.0, 1.0, vH);
    vec3 col = mix(uDeep, uShallow, m * m * 0.92);
    vec3 N = normalize(vN);
    vec3 L = normalize(vec3(0.35, 0.55, 0.75));
    vec3 V = normalize(cameraPosition - vW);
    float spec = pow(max(dot(reflect(-L, N), V), 0.0), 26.0);
    vec2 cell = floor(vUv * vec2(150.0, 46.0));
    float tw = fract(sin(dot(cell, vec2(12.9898, 78.233)) + floor(uTime * 1.4) * 7.13) * 43758.5453);
    float glint = step(0.978, tw) * (0.55 + 0.45 * m);
    col += uGlint * (spec * 0.38 + glint * 0.16);
    gl_FragColor = vec4(col, uAlpha);
  }
`

export function Water3D({ tone, phase, onReady }: {
  tone: 'river' | 'lake'
  phase: ScenePhase
  onReady?: () => void
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const phaseRef = useRef<ScenePhase>(phase)
  const inViewRef = useRef(false)
  const readyRef = useRef(onReady)
  const uniRef = useRef<THREE.ShaderMaterial | null>(null)
  const sunRef = useRef<THREE.DirectionalLight | null>(null)
  const ambRef = useRef<THREE.AmbientLight | null>(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { readyRef.current = onReady }, [onReady])
  useEffect(() => {
    const el = boxRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { inViewRef.current = true; return }
    const io = new IntersectionObserver((es) => { inViewRef.current = es[0]?.isIntersecting ?? true }, { threshold: 0.04 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Uniforms y luces siguen la fase del día sin reconstruir la escena
  useEffect(() => {
    const pw = PHASE_WATER[phase]
    const m = uniRef.current
    if (m) {
      ;(m.uniforms.uDeep.value as THREE.Color).setHex(pw.deep)
      ;(m.uniforms.uShallow.value as THREE.Color).setHex(pw.shallow)
    }
    if (sunRef.current) sunRef.current.intensity = pw.sun
    if (ambRef.current) ambRef.current.intensity = pw.amb
  }, [phase])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const box = boxRef.current
    if (!box) return
    const canvas = document.createElement('canvas')
    box.appendChild(canvas)
    const renderer = makeRenderer(canvas)
    if (!renderer) { canvas.remove(); return }

    const scene = new THREE.Scene()
    const w = Math.max(box.clientWidth, 120)
    const h = Math.max(box.clientHeight, 60)
    renderer.setSize(w, h, false)
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 30)
    camera.position.set(0, 2.9, 4.1)
    camera.lookAt(0, -0.05, -0.2)

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2)
    sun.position.set(2.4, 3.4, 2.6)
    const amb = new THREE.AmbientLight(0xffffff, 0.82)
    scene.add(sun, amb)
    sunRef.current = sun
    ambRef.current = amb

    // superficie del agua con olas en el vertex shader
    const geo = new THREE.PlaneGeometry(18, 3.6, 108, 28)
    geo.rotateX(-Math.PI / 2)
    const tone0 = WATER_TONE[tone]
    const pw0 = PHASE_WATER[phaseRef.current]
    const mat = new THREE.ShaderMaterial({
      vertexShader: WATER_VS,
      fragmentShader: WATER_FS,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: tone0.amp },
        uDeep: { value: new THREE.Color(pw0.deep) },
        uShallow: { value: new THREE.Color(pw0.shallow) },
        uGlint: { value: new THREE.Color(tone === 'lake' ? 0xfff2dc : 0xffffff) },
        uAlpha: { value: 0.86 },
      },
    })
    uniRef.current = mat
    const water = new THREE.Mesh(geo, mat)
    scene.add(water)

    // piedras low-poly asomando entre las olas
    const sGeo = new THREE.DodecahedronGeometry(1, 0)
    const sMat = new THREE.MeshLambertMaterial({ color: 0x8a8577, flatShading: true })
    const stones = new THREE.InstancedMesh(sGeo, sMat, 14)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < 14; i++) {
      const edge = i % 2 === 0 ? -1 : 1
      dummy.position.set((Math.random() * 2 - 1) * 6.4, -0.03 + Math.random() * 0.07, edge * (0.85 + Math.random() * 0.45))
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI)
      const s = 0.07 + Math.random() * 0.13
      dummy.scale.set(s * (1 + Math.random()), s * 0.7, s)
      dummy.updateMatrix()
      stones.setMatrixAt(i, dummy.matrix)
    }
    scene.add(stones)

    let raf = 0
    let last = performance.now()
    let readySent = false
    const resize = () => {
      const bw = Math.max(box.clientWidth, 120)
      const bh = Math.max(box.clientHeight, 60)
      renderer.setSize(bw, bh, false)
      camera.aspect = bw / bh
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(box)

    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!inViewRef.current) { last = performance.now(); return }
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      mat.uniforms.uTime.value += dt
      renderer.render(scene, camera)
      if (!readySent) { readySent = true; readyRef.current?.() }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      geo.dispose()
      mat.dispose()
      sGeo.dispose()
      sMat.dispose()
      stones.dispose()
      renderer.dispose()
      uniRef.current = null
      sunRef.current = null
      ambRef.current = null
      canvas.remove()
    }
  }, [tone])

  return <div ref={boxRef} className="scene3d scene3d-water" aria-hidden="true" />
}

/* ── MASCOTA 3D — Axi el LÉMUR (R41: el GLB esquelético real de OpenGameArt
   CC0 — el MISMO modelo que acompaña el camino; los clips idle/run/attack
   se mapean a los moods de R17: idle→idle, wave→attack levanta el brazo,
   party→run con saltito. Si no hay WebGL o el GLB no carga: respaldo SVG) ── */

const MASCOT_GLB = '/assets/world/mascot/lemur.glb'
const MASCOT_H = 1.22 // altura de la mascota en el encuadre (visor ~1.16 u)
const MASCOT_DROPRATE = 0.46 // fracción de la altura que queda bajo el eje

export function Mascot3D({ size = 62, mood = 'idle', onFail }: { size?: number; mood?: string; onFail?: () => void }) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const moodRef = useRef(mood)
  const failRef = useRef(onFail)
  const height = Math.round(size * 1.14)

  useEffect(() => { moodRef.current = mood }, [mood])
  useEffect(() => { failRef.current = onFail }, [onFail])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const box = boxRef.current
    if (!box) return
    const canvas = document.createElement('canvas')
    canvas.className = 'mascot-3d'
    canvas.style.width = `${size}px`
    canvas.style.height = `${height}px`
    box.appendChild(canvas)
    const renderer = makeRenderer(canvas, 2)
    if (!renderer) { canvas.remove(); failRef.current?.(); return }
    renderer.setSize(size, height, false)
    // R41: el lémur es de pelaje claro — sin fondo se pierde contra el crema
    // de la página (el cuervo oscuro no lo necesitaba). Insignia suave.
    renderer.setClearColor(0xe3ddcd, 1)
    canvas.style.borderRadius = '14px'

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, size / height, 0.1, 20)
    camera.position.set(0, 0.05, 2.95)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.HemisphereLight(0xffffff, 0xe8e2d4, 0.95))
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.0)
    sun.position.set(1.6, 2.4, 3.2)
    scene.add(sun)

    const root = new THREE.Group()
    scene.add(root)
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.34, 20),
      new THREE.MeshBasicMaterial({ color: 0x201b15, transparent: true, opacity: 0.14 }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = -0.635
    scene.add(shadow)

    let disposed = false
    let mixer: THREE.AnimationMixer | null = null
    let model: THREE.Group | null = null
    const acts: Record<string, THREE.AnimationAction> = {}

    void loadGlb(MASCOT_GLB, { clone: true })
      .then((glb) => {
        if (disposed) return
        const loaded = glb.scene
        model = loaded
        model.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (mesh.isMesh) {
            mesh.frustumCulled = false // skinned: el bbox de bind pose no sigue a los huesos
            const m = mesh.material as THREE.MeshStandardMaterial
            if (m && 'metalness' in m) { m.metalness = 0; m.roughness = 1 }
          }
        })
        const pick = (frag: string) =>
          stripRootTracks(glb.animations).find((a) => a.name.toLowerCase().includes(frag)) ?? null
        const idleClip = pick('idle')
        if (!idleClip) throw new Error('lemur.glb sin clip idle')
        mixer = new THREE.AnimationMixer(model)
        acts.idle = mixer.clipAction(idleClip)
        const runClip = pick('run')
        const atkClip = pick('attackmelee')
        if (runClip) acts.party = mixer.clipAction(runClip)
        if (atkClip) acts.wave = mixer.clipAction(atkClip)
        acts.idle.play()
        mixer.update(0) // poser el esqueleto (idle) antes de medir
        // R41 (lección del rig del mundo): la medida honesta es la POSE ACTUAL
        // (Box3.setFromObject usa la bind pose y la cadena del GLB trae la
        // rotación FBX Z→Y — ver posedBoxOf). Escala → rotación 3/4 → asentar.
        model.scale.setScalar(1)
        model.position.set(0, 0, 0)
        model.rotation.set(0, 0.22, 0) // 3/4: deja ver la cola rayada
        model.updateMatrixWorld(true)
        const p0 = posedBoxOf(model)
        const s = MASCOT_H / (p0.max.y - p0.min.y)
        model.scale.setScalar(s)
        model.updateMatrixWorld(true)
        const p1 = posedBoxOf(model)
        model.position.set(
          -(p1.min.x + p1.max.x) / 2,
          -p1.min.y - MASCOT_H * MASCOT_DROPRATE,
          -(p1.min.z + p1.max.z) / 2,
        )
        root.add(model)
      })
      .catch(() => { if (!disposed) failRef.current?.() })

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let t = 0
    let last = performance.now()
    let current: THREE.AnimationAction | null = null

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (reduced) {
        // pose viva congelada (primer frame del idle), sin mixer ni bob
        if (mixer) mixer.update(0)
        renderer.render(scene, camera)
        return
      }
      t += dt
      const m = moodRef.current
      // selección de clip por mood (crossfade suave; R17 conserva sus moods)
      const want = (m === 'wave' && acts.wave) || (m === 'party' && acts.party) || acts.idle
      if (mixer && want) {
        if (current !== want) {
          if (current?.isRunning()) current.fadeOut(0.22)
          want.reset().fadeIn(0.22).play()
          if (want === acts.wave) { want.setLoop(THREE.LoopRepeat, Infinity); want.timeScale = 0.85 }
          if (want === acts.party) { want.setLoop(THREE.LoopRepeat, Infinity); want.timeScale = 1.15 }
          if (want === acts.idle) { want.setLoop(THREE.LoopRepeat, Infinity); want.timeScale = 1 }
          current = want
        }
        mixer.update(dt)
      }
      // gesticulación del cuerpo (los moods R17 intactos, ahora con cola)
      let gy = Math.sin(t * 1.7) * 0.018
      let grz = 0
      let gry = 0
      if (m === 'wave') grz = 0.05
      if (m === 'party') {
        gy += Math.abs(Math.sin(t * 8.5)) * 0.13
        gry = Math.sin(t * 4.2) * 0.24
      }
      if (m === 'cheer') { grz = Math.sin(t * 3.6) * 0.12; gy += 0.02 }
      const k = Math.min(dt * 9, 1)
      root.position.y += (gy - root.position.y) * k
      root.rotation.z += (grz - root.rotation.z) * k
      root.rotation.y += (gry - root.rotation.y) * k
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      mixer?.stopAllAction()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const mm = o.material
          if (Array.isArray(mm)) mm.forEach(x => x.dispose())
          else mm.dispose()
        }
      })
      renderer.dispose()
      canvas.remove()
    }
  }, [size, height])

  return <div ref={boxRef} aria-hidden="true" />
}

/* ── GLOBO 3D — planeta low-poly arrastrable con la ruta México → York ─ */

export type GlobeStopState = 'done' | 'current' | 'next' | 'locked'

const GLOBE_R = 1.3
const MEX = { lat: 19.43, lon: -99.13 }
const YORK = { lat: 53.96, lon: -1.08 }

function llToV(lat: number, lon: number, r: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

function arcPoint(a: THREE.Vector3, b: THREE.Vector3, t: number, lift: number): THREE.Vector3 {
  const v = new THREE.Vector3().lerpVectors(a, b, t).normalize()
  return v.multiplyScalar(GLOBE_R * (1 + lift))
}

const STOP_COLORS: Record<GlobeStopState, number> = {
  done: 0x14a085,
  current: 0xe9a23b,
  next: 0xffffff,
  locked: 0xd8d0c1,
}

function numberSprite(n: number, state: GlobeStopState): THREE.Sprite {
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 64
  const ctx = cv.getContext('2d')
  if (ctx) {
    ctx.beginPath()
    ctx.arc(32, 32, 26, 0, Math.PI * 2)
    ctx.fillStyle = state === 'locked' ? '#F4F0E8' : state === 'done' ? '#14A085' : state === 'current' ? '#E9A23B' : '#FFFFFF'
    ctx.fill()
    ctx.lineWidth = 5
    ctx.strokeStyle = state === 'locked' ? '#C9BFB2' : state === 'current' ? '#B9780F' : state === 'done' ? '#0C7E71' : '#14A085'
    ctx.stroke()
    ctx.fillStyle = state === 'locked' ? '#9A917F' : '#FFFFFF'
    if (state === 'next' || state === 'locked') ctx.fillStyle = state === 'next' ? '#201B15' : '#9A917F'
    ctx.font = '800 30px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(n), 32, 34)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.needsUpdate = true
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }))
  sp.scale.set(0.14, 0.14, 1)
  return sp
}

export function TravelGlobe({ progress, states, stopCount }: {
  progress: number
  states: GlobeStopState[]
  stopCount: number
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const progRef = useRef(progress)
  const statesRef = useRef(states)
  const needRef = useRef(true)
  const progKey = Math.round(progress * 24)

  useEffect(() => { progRef.current = progress; statesRef.current = states; needRef.current = true }, [progress, states])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const box = boxRef.current
    if (!box) return
    const canvas = document.createElement('canvas')
    box.insertBefore(canvas, box.firstChild)
    const renderer = makeRenderer(canvas, 1.75)
    if (!renderer) { canvas.remove(); return }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const scene = new THREE.Scene()
    const w = Math.max(box.clientWidth, 200)
    const h = Math.max(box.clientHeight, 200)
    renderer.setSize(w, h, false)
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 20)
    camera.position.set(0, 0.3, 3.6)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb8c4d8, 0.9))
    const sun = new THREE.DirectionalLight(0xfff4e0, 0.95)
    sun.position.set(2.4, 2.6, 2.2)
    scene.add(sun)

    // planeta low-poly: relieve + colores por cara (tierra/agua/nieve)
    const src = new THREE.IcosahedronGeometry(GLOBE_R, 3)
    const geo = src.index ? src.toNonIndexed() : src
    if (geo !== src) src.dispose()
    const pos = geo.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const cLandA = new THREE.Color(0x7cb56b)
    const cLandB = new THREE.Color(0x5c9b52)
    const cSand = new THREE.Color(0xd9c389)
    const cWaterA = new THREE.Color(0x4a90c2)
    const cWaterB = new THREE.Color(0x3b7db8)
    const cSnow = new THREE.Color(0xf2f4ee)
    const cen = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const cn = new THREE.Color()
    for (let idx = 0; idx < pos.count; idx++) {
      // desplazamiento continuo por vértice: posiciones idénticas → idéntica altura, sin grietas
      dir.fromBufferAttribute(pos, idx).normalize()
      const n = vnoise(dir.x * 2.4 + 5.2, dir.y * 2.4 + 1.7, dir.z * 2.4 + 9.1)
      const lift = Math.max(0, n - 0.55) * 0.34
      const v = dir.multiplyScalar(GLOBE_R * (1 + 0.006 + lift))
      pos.setXYZ(idx, v.x, v.y, v.z)
    }
    for (let f = 0; f < pos.count; f += 3) {
      cen.set(0, 0, 0)
      for (let k = 0; k < 3; k++) cen.add(new THREE.Vector3().fromBufferAttribute(pos, f + k))
      cen.divideScalar(3)
      dir.copy(cen).normalize()
      const n = vnoise(dir.x * 2.4 + 5.2, dir.y * 2.4 + 1.7, dir.z * 2.4 + 9.1)
      const isLand = n > 0.55
      cn.set(0, 0, 0)
      if (dir.y > 0.88) cn.copy(cSnow)
      else if (isLand) {
        cn.lerpColors(cLandA, cLandB, (n - 0.55) / 0.45)
        if (n < 0.575) cn.lerp(cSand, 0.25)
      } else cn.lerpColors(cWaterA, cWaterB, Math.min(n / 0.55, 1))
      for (let k = 0; k < 3; k++) {
        const idx = f + k
        colors[idx * 3] = cn.r
        colors[idx * 3 + 1] = cn.g
        colors[idx * 3 + 2] = cn.b
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geo.computeVertexNormals()
    const planet = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }))
    const world = new THREE.Group()
    world.add(planet)

    // atmósfera sutil
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_R * 1.16, 24, 18),
      new THREE.MeshBasicMaterial({ color: 0x9fc8e8, transparent: true, opacity: 0.14, side: THREE.BackSide }),
    )
    world.add(atmo)

    // ruta México → York: arco por gran círculo con altitud
    const a = llToV(MEX.lat, MEX.lon, 1)
    const b = llToV(YORK.lat, YORK.lon, 1)
    const N = 64
    const arcPts: THREE.Vector3[] = []
    for (let i = 0; i <= N; i++) {
      const t = i / N
      arcPts.push(arcPoint(a, b, t, 0.02 + Math.sin(t * Math.PI) * 0.16))
    }
    const baseCurve = new THREE.CatmullRomCurve3(arcPts)
    const baseTube = new THREE.Mesh(
      new THREE.TubeGeometry(baseCurve, 72, 0.011, 6),
      new THREE.MeshBasicMaterial({ color: 0xc9bfb2, transparent: true, opacity: 0.55 }),
    )
    world.add(baseTube)

    let progTube: THREE.Mesh | null = null
    const buildProg = (p: number) => {
      if (progTube) {
        progTube.geometry.dispose()
        ;(progTube.material as THREE.Material).dispose()
        world.remove(progTube)
        progTube = null
      }
      if (p <= 0.001) return
      const upto = Math.max(2, Math.floor(N * Math.min(p, 1)) + 1)
      const sub = new THREE.CatmullRomCurve3(arcPts.slice(0, upto))
      progTube = new THREE.Mesh(
        new THREE.TubeGeometry(sub, Math.max(8, upto * 2), 0.014, 6),
        new THREE.MeshBasicMaterial({ color: 0x14a085 }),
      )
      world.add(progTube)
    }
    buildProg(progRef.current)

    // paradas: marcadores + numeritos tipo sprite
    const markers: THREE.Mesh[] = []
    const sprites: THREE.Sprite[] = []
    for (let i = 0; i < stopCount; i++) {
      const t = stopCount > 1 ? i / (stopCount - 1) : 0
      const st = (statesRef.current[i] || 'locked') as GlobeStopState
      const p = arcPoint(a, b, t, 0.02 + Math.sin(t * Math.PI) * 0.16)
      const onSurface = p.clone().normalize().multiplyScalar(GLOBE_R * 1.012)
      const mk = new THREE.Mesh(
        new THREE.SphereGeometry(st === 'current' ? 0.05 : 0.038, 8, 6),
        new THREE.MeshLambertMaterial({ color: STOP_COLORS[st], flatShading: true }),
      )
      mk.position.copy(onSurface)
      world.add(mk)
      markers.push(mk)
      const sp = numberSprite(i + 1, st)
      sp.position.copy(p.clone().normalize().multiplyScalar(GLOBE_R * (1.09 + Math.sin(t * Math.PI) * 0.14)))
      world.add(sp)
      sprites.push(sp)
    }

    // orientación inicial: la mitad de la ruta de frente a cámara
    const mid = arcPoint(a, b, 0.5, 0).normalize()
    world.rotation.y = Math.atan2(mid.x, mid.z)
    world.rotation.x = 0.3
    scene.add(world)

    // arrastre para girar el mundo (con inercia suave)
    let dragging = false
    let px = 0
    let py = 0
    let tRotY = world.rotation.y
    let tRotX = world.rotation.x
    let lastPointer = 0
    const onDown = (e: PointerEvent) => {
      dragging = true
      px = e.clientX
      py = e.clientY
      box.classList.add('dragging')
      try { canvas.setPointerCapture(e.pointerId) } catch { /* sin captura */ }
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      tRotY += (e.clientX - px) * 0.006
      tRotX = Math.max(-0.9, Math.min(0.9, tRotX + (e.clientY - py) * 0.004))
      px = e.clientX
      py = e.clientY
      lastPointer = performance.now()
      needRef.current = true
    }
    const onUp = () => {
      dragging = false
      box.classList.remove('dragging')
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)

    const resize = () => {
      const bw = Math.max(box.clientWidth, 200)
      const bh = Math.max(box.clientHeight, 200)
      renderer.setSize(bw, bh, false)
      camera.aspect = bw / bh
      camera.updateProjectionMatrix()
      needRef.current = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(box)

    let raf = 0
    let last = performance.now()
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const idle = !dragging && now - lastPointer > 2500
      if (!reduced && idle) { tRotY += 0.1 * dt }
      const k = Math.min(dt * 7, 1)
      world.rotation.y += (tRotY - world.rotation.y) * k
      world.rotation.x += (tRotX - world.rotation.x) * k
      if (!reduced) {
        const tS = performance.now() / 1000
        markers.forEach((mk, i) => {
          if ((statesRef.current[i] || 'locked') === 'current') {
            const s = 1 + Math.sin(tS * 3.2) * 0.28
            mk.scale.setScalar(s)
          } else mk.scale.setScalar(1)
        })
        needRef.current = true
      }
      if (needRef.current) {
        needRef.current = false
        renderer.render(scene, camera)
      }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      if (progTube) {
        progTube.geometry.dispose()
        ;(progTube.material as THREE.Material).dispose()
      }
      geo.dispose()
      ;(planet.material as THREE.Material).dispose()
      atmo.geometry.dispose()
      ;(atmo.material as THREE.Material).dispose()
      baseTube.geometry.dispose()
      ;(baseTube.material as THREE.Material).dispose()
      markers.forEach(mk => { mk.geometry.dispose(); (mk.material as THREE.Material).dispose() })
      sprites.forEach(sp => {
        const mat2 = sp.material as THREE.SpriteMaterial
        mat2.map?.dispose()
        mat2.dispose()
      })
      renderer.dispose()
      canvas.remove()
    }
  }, [stopCount])

  // reconstruir el trazo de progreso cuando avanza el viaje
  useEffect(() => {
    needRef.current = true
  }, [progKey])

  return (
    <div ref={boxRef} className="globe3d-wrap" aria-hidden="true">
      <span className="globe3d-hint">Arrastra para girar el mundo</span>
    </div>
  )
}
