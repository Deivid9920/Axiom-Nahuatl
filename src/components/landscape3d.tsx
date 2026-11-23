'use client'

/*
 * ===================== R19 — PAISAJE 3D COMPLETO (three.js) =====================
 * Un solo canvas WebGL que sustituye TODO el decorado SVG/CSS del camino:
 * cielo con degradado y sol/luna, terreno low-poly con camino serpenteante,
 * árboles 3D que se mecen con el viento, hierba, hojas que se desprenden y
 * caen cerca del camino, río con olas por shader, puente de madera, piedras,
 * flores, nubes, pájaros y luciérnagas. Todo procedural: sin imágenes, sin
 * texturas externas, sin peticiones — 100% geometría y shaders.
 *
 * Cámara (R21 — DIORAMA 3D interactivo): PerspectiveCamera elevada (≈40°)
 * que mira hacia abajo a una maqueta navegable, con OrbitControls limitados
 * (giro por arrastre con damping, zoom por botones +/− y pellizco, sin
 * bloquear nunca el scroll de la página) y vuelos de cámara que recorren el
 * camino 3D al seleccionar un nodo. Los nodos de las lecciones son
 * estructuras low-poly físicas sobre el camino (Raycaster: hover + click)
 * y el sol proyecta sombras reales que siguen al punto de interés.
 *
 * R36 — TRANSFORMACIÓN 3D (PDF maestro): el archivo se reduce al COMPONENTE;
 * los builders viven en src/components/world/ (terreno, flora, decorado,
 * agua, nodos) y los DATOS de biomas en src/lib/world/configs.ts («arquitectura
 * de datos separada del gráfico»). El renderer incorpora gestión de color
 * (NeutralToneMapping: comprime brillos sin desplazar la paleta afinada) y
 * el asa de depuración __d3d expone stats() (fps, draw calls, triángulos,
 * memoria) para medir que las mejoras visuales no cuestan rendimiento.
 *
 * R37 — RIG DE CÁMARA (World Map + orto/persp): la lógica de cámara vive en
 * world/cameraRig.ts: la perspectiva R21 se conserva tal cual y convive con
 * un prototipo ORTOGRÁFICO (zoom equivalente) y un modo 'world' que encuadra
 * el mundo completo (base de la vista World Map del PDF maestro). El asa
 * __d3d expone setProjection/getProjection y setMode/getMode para medir y
 * decidir con datos; la app no cambia de comportamiento por defecto.
 *
 * R38 — ISLA DE REFERENCIA (PDF maestro): el terreno se recorta como diorama
 * flotante (superelipse orgánica + labio de tierra + roca colgante que se
 * sella al corte), el río cae en CASCADA al borde (shader con bruma), cada
 * bioma recibe decoración propia (datos en configs) y los nodos representan
 * los 5 estados (bloqueado/disponible/actual/completado/final). En el modo
 * World Map la niebla se afloja suave (por bioma) para leer la isla entera.
 *
 * R39/R41 — COMPAÑERO DEL CAMINO (PDF maestro): desde R41 es el LÉMUR «Axi»
 * (GLB esquelético CC0 de OpenGameArt en world/lemur.ts) con locomoción
 * TERRESTRE (idle/look/walk/run/celebrate): corre por el hombro del camino
 * junto al nodo vigente, sincroniza su carrera con los vuelos de cámara al
 * cambiar el foco y celebra al completarse una lección. Antes R39 era un
 * cuervo procedural con 7 estados (incluidos vuelo) — sustituido por
 * decisión de dirección (el usuario aportó el asset del lémur).
 * Sólo REACCIONA a la navegación existente (requestFocus/syncNodes): la
 * lógica educativa, el progreso y los desbloqueos quedan intactos.
 *
 * Degradación: sin WebGL la capa no monta (onReady nunca llega) y quedan los
 * adornos SVG/CSS de R16-R18. Con prefers-reduced-motion el mundo se renderiza
 * calmado: viento mínimo, vuelos instantáneos, sin vaivén extra.
 * IntersectionObserver pausa el render fuera de vista; todo se libera al
 * desmontar.
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// datos (capa separada del gráfico — R36)
import { WORLDS, PHASE_SKY } from '@/lib/world/configs'
import type { ScenePhase } from '@/lib/world/configs'

// gráfico (builders extraídos — R36)
import { buildPathCurve } from './world/util'
import { SKY_VS, SKY_FS, sharedU } from './world/shaders'
import { makeHeightFn, buildTerrain, buildRoad, buildIslandRock } from './world/terrain'
import { buildTrees, buildGrass, buildLeaves } from './world/flora'
import type { LeafSystem } from './world/flora'
import { buildDetails, buildBridge, buildClouds, buildStars, buildFireflies, buildBirds, glowTexture } from './world/decor'
import { buildProps } from './world/props'
import { buildWater } from './world/water'
import { buildWaterfall } from './world/waterfall'
import { buildLessonNodes, D3_STATE_LABEL } from './world/nodes'
import { buildLemurRig } from './world/lemur'
import type { LemurRig, LemurState } from './world/lemur'
import { buildMeadowLayer } from './world/glbLayer'
import { CameraRig } from './world/cameraRig'
import type { NodeVisual, NodeWorld } from './world/nodes'
import type { D3Node } from './world/types'

// compatibilidad: la app importa estos tipos desde '@/components/landscape3d'
export type { D3Node } from './world/types'
export type { ScenePhase } from '@/lib/world/configs'

/* ==== componente React ==== */

interface D3Api {
  syncNodes: (list: D3Node[]) => void
  requestFocus: (id: string | null | undefined) => void
  zoomStep: (dir: number) => void
}

export function Landscape3D({ variant, phase, nodes, focusId, onNodeSelect, onReady, onFail }: {
  variant: number
  phase: ScenePhase
  /** lecciones que se levantan como estructuras físicas sobre el camino */
  nodes?: D3Node[]
  /** nodo hacia el que la cámara vuela siguiendo el camino */
  focusId?: string | null
  onNodeSelect?: (id: string) => void
  onReady?: () => void
  onFail?: () => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const applyPhaseRef = useRef<((p: ScenePhase) => void) | null>(null)
  const phaseRef = useRef(phase)
  const readyRef = useRef(onReady)
  const failRef = useRef(onFail)
  const selectRef = useRef(onNodeSelect)
  const nodesRef = useRef(nodes)
  const apiRef = useRef<D3Api | null>(null)
  useEffect(() => { phaseRef.current = phase; applyPhaseRef.current?.(phase) }, [phase])
  useEffect(() => { readyRef.current = onReady; failRef.current = onFail; selectRef.current = onNodeSelect })
  useEffect(() => { nodesRef.current = nodes })

  // Los nodos llegan de forma asíncrona (currículo por API): se sincronizan
  // cuando cambia su firma (ids + estados), no la identidad del arreglo. Los
  // efectos viven DESPUÉS del efecto principal para que apiRef ya exista.
  const nodesSig = (nodes ?? []).map(nd => `${nd.id}:${nd.state}${nd.final ? ':f' : ''}`).join('|')
  useEffect(() => {
    apiRef.current?.syncNodes(nodes ?? [])
  }, [nodesSig])
  useEffect(() => {
    apiRef.current?.requestFocus(focusId ?? null)
  }, [focusId, nodesSig])

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const cfg = WORLDS[variant] ?? WORLDS[1]
    const seed = variant * 1013

    // ── renderer (sin WebGL → los adornos SVG/CSS siguen en su sitio) ──
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' })
    } catch {
      failRef.current?.()
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
    renderer.setSize(wrap.clientWidth || 640, wrap.clientHeight || 480, false)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // R36: gestión de color — Neutral (Khronos PBR Neutral) comprime los
    // brillos con desplazamiento de tono mínimo: la paleta afinada de R16 se
    // conserva y el pipeline queda listo para la iluminación de la isla de
    // referencia (R38). Los ShaderMaterial propios (cielo/agua) no incluyen el
    // chunk de tone mapping y mantienen sus colores exactos.
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1.0
    const canvas = renderer.domElement
    wrap.appendChild(canvas)

    const scene = new THREE.Scene()
    const hAt = makeHeightFn(cfg)

    // R21: camino 3D REAL (CatmullRom) — sobre él viven los nodos y los vuelos
    const curve = buildPathCurve()

    // R37: rig de cámara — perspectiva R21 intacta + prototipo ortográfica +
    // modo 'world' (World Map). Vuelos, órbita y zoom pasan por el rig.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const rig = new CameraRig({ dom: canvas, width: wrap.clientWidth || 640, height: wrap.clientHeight || 480, curve, hAt, reduced })

    // cúpula del cielo + niebla + luces
    const skyU = {
      uTop: { value: new THREE.Color(0xbcdfee) }, uHor: { value: new THREE.Color(0xf2f7ec) },
      uSunDir: { value: new THREE.Vector3(35, 95, -140) }, uSunTint: { value: new THREE.Color(1.0, 0.88, 0.66) },
    }
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 28, 16),
      new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, uniforms: skyU, side: THREE.BackSide, depthWrite: false, fog: false })
    )
    sky.renderOrder = -10
    scene.add(sky)

    scene.fog = new THREE.Fog(0xe8f0e6, cfg.fogNear, cfg.fogFar)

    const hemi = new THREE.HemisphereLight(0xf2f7ec, cfg.groundB, 0.82)
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.15)
    const amb = new THREE.AmbientLight(0xffffff, 0.22)
    scene.add(hemi, sun, amb, sun.target)

    // R21: sombras reales del sol, con el frustum anclado al punto de interés
    sun.castShadow = true
    const smallScreen = Math.min(window.innerWidth || 9999, wrap.clientWidth || 9999) < 760
    sun.shadow.mapSize.set(smallScreen ? 1024 : 2048, smallScreen ? 1024 : 2048)
    sun.shadow.camera.left = -27
    sun.shadow.camera.right = 27
    sun.shadow.camera.top = 27
    sun.shadow.camera.bottom = -27
    sun.shadow.camera.near = 4
    sun.shadow.camera.far = 150
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.03
    const sunOffDir = new THREE.Vector3(0.21, 0.6, -0.84).normalize()

    // ── el mundo ──
    const world = new THREE.Group()
    const parts = { group: world, crowns: [], leafSpawnArea: { minX: 0, maxX: 0, zNear: 0, zFar: 0 }, groundAt: hAt }
    world.add(buildTerrain(cfg, hAt))
    world.add(buildIslandRock(cfg, hAt)) // R38: roca colgante sellada al labio
    world.add(buildRoad(cfg, hAt, curve))
    // R40: buildTrees devuelve SU grupo — la capa GLB del piloto lo sustituye
    // cuando los assets cargan (mismas posiciones, seed compartida)
    const procTrees = buildTrees(cfg, seed, hAt, parts)
    world.add(procTrees)
    buildGrass(cfg, seed, hAt, world)
    buildDetails(cfg, seed, hAt, world)
    buildProps(cfg, seed, hAt, world) // R38: decoración por bioma (datos)
    if (cfg.river) buildBridge(cfg.river, world)
    const waterMat = buildWater(cfg, phaseRef.current, world)?.mat ?? null
    const waterfall = buildWaterfall(cfg, phaseRef.current, world) // R38: cascada al borde
    const clouds = buildClouds(cfg, seed, world)
    const stars = buildStars(world)
    const fireflies = buildFireflies(seed, world)
    const birds = cfg.birds ? buildBirds(world) : null
    const leaves: LeafSystem = buildLeaves(cfg, seed, parts.crowns, hAt, world)
    // R41: el lémur compañero (locomoción en world/lemur.ts; los disparos
    // viven en syncNodes/requestFocus — sólo reacción, sin lógica educativa).
    // Carga ASÍNCRONA del GLB esquelético: hasta que llega el mundo no cambia
    // (degradación elegante — si falla, no hay compañero y el resto intacto).
    let lemur: LemurRig | null = null
    scene.add(world)

    // R40: CAPA GLB DEL PILOTO (sólo Pradera) — assets CC0 reales. Carga
    // asíncrona con degradación elegante: si un GLB falla, el mundo procedural
    // R38 queda intacto. Al cargar: sustituye la arboleda primitiva (mismas
    // posiciones por seed compartida) y añade aldea/sotobosque/fauna.
    let glbUpdate: ((t: number, dt: number) => void) | null = null
    if (variant === 1) {
      void (async () => {
        try {
          const layer = await buildMeadowLayer(cfg, seed, hAt)
          if (!wrap.isConnected) return // desmontado durante la carga
          world.add(layer.group)
          world.remove(procTrees)
          glbUpdate = layer.update
        } catch { /* sin assets: queda el gráfico procedural R38 */ }
      })()
    }

    // sol/luna (destello lejano, sin niebla)
    const orbMat = new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, fog: false, depthWrite: false, depthTest: false })
    const orb = new THREE.Sprite(orbMat)
    orb.renderOrder = -8
    scene.add(orb)

    // ── fase del día: cielo, niebla, luces, agua, estrellas, luciérnagas ──
    const applyPhase = (p: ScenePhase) => {
      const ps = PHASE_SKY[p]
      skyU.uTop.value.setHex(ps.top)
      skyU.uHor.value.setHex(ps.hor)
      skyU.uSunDir.value.set(ps.sunDir[0], ps.sunDir[1], ps.sunDir[2])
      orbMat.color.setHex(ps.orb)
      orb.scale.setScalar(ps.orbScale)
      orb.position.set(ps.sunDir[0] * 1.75, Math.max(30, ps.sunDir[1] * 1.75), ps.sunDir[2] * 1.75)
      ;(scene.fog as THREE.Fog).color.setHex(ps.fog)
      sun.color.setHex(ps.sunCol)
      sun.intensity = ps.sunI
      sunOffDir.set(ps.sunDir[0], Math.max(ps.sunDir[1], 16), ps.sunDir[2]).normalize()
      hemi.intensity = ps.ambI
      hemi.color.setHex(ps.hor)
      stars.mat.opacity = p === 'night' ? 0.95 : 0
      const ffOn = p === 'night' || cfg.firefliesAlways
      fireflies.mat.opacity = ffOn ? 0.95 : 0
      fireflies.pts.visible = ffOn
      if (waterMat && cfg.river) {
        const dim = p === 'night' ? 0.3 : p === 'dusk' ? 0.62 : p === 'dawn' ? 0.85 : 1
        waterMat.uniforms.uDeep.value.setHex(cfg.river.deep).multiplyScalar(dim)
        waterMat.uniforms.uShallow.value.setHex(cfg.river.shallow).multiplyScalar(p === 'night' ? 0.42 : p === 'dusk' ? 0.8 : 1)
        waterMat.uniforms.uSunDir.value.set(ps.sunDir[0], ps.sunDir[1], ps.sunDir[2])
        waterMat.uniforms.uSunI.value = ps.sunI
      }
      // R38: la cascada comparte paleta y luz del río por fase
      if (waterfall && cfg.river) {
        const dim = p === 'night' ? 0.3 : p === 'dusk' ? 0.62 : p === 'dawn' ? 0.85 : 1
        waterfall.mat.uniforms.uColA.value.setHex(cfg.river.shallow).multiplyScalar(p === 'night' ? 0.42 : p === 'dusk' ? 0.8 : 1)
        waterfall.mat.uniforms.uColB.value.setHex(cfg.river.deep).multiplyScalar(dim)
        waterfall.mat.uniforms.uSunI.value = ps.sunI
      }
    }
    applyPhaseRef.current = applyPhase
    applyPhase(phaseRef.current)

    // ── R21/R37: diorama interactivo — OrbitControls limitados (en el rig),
    //         Raycaster sobre los nodos, vuelos por el camino y zoom propio ──
    canvas.style.touchAction = 'pan-y'   // el dedo vertical sigue desplazando la página
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cursor = 'grab'

    // ── nodos de lecciones (se reconstruyen cuando cambia el progreso) ──
    let nodeWorld: NodeWorld | null = null
    let nodeMeta = new Map<string, { u: number; state: D3Node['state']; side: number }>()
    let visualById = new Map<string, NodeVisual>()
    let titleById = new Map<string, D3Node>()
    let builtOnce = false
    const disposeNodes = () => {
      if (!nodeWorld) return
      world.remove(nodeWorld.group)
      nodeWorld.dispose()
      nodeWorld = null
    }
    const defaultU = () => {
      for (const m of nodeMeta.values()) if (m.state === 'current') return m.u
      // R38: si la app enviara 'available' sin ninguna 'current', ahí se posa
      for (const m of nodeMeta.values()) if (m.state === 'available') return m.u
      return nodeMeta.size ? 0.5 : 0.08
    }
    const clampU = (u: number) => Math.min(0.965, Math.max(0.02, u))
    // R39/R41: percha del compañero — hombro del camino en el lado OPUESTO a
    // la estructura del nodo (nunca dentro del pedestal) y mirando al sentido
    // de la marcha; +0.1 sobre hAt para no hundirse en la cinta del camino
    const perchForU = (u: number, side = 1) => {
      const uu = clampU(u)
      const p = curve.getPointAt(uu)
      const tan = curve.getTangentAt(uu)
      const perp = new THREE.Vector3(-tan.z, 0, tan.x).normalize()
      const off = -Math.sign(side || 1) * 0.95
      const x = p.x + perp.x * off
      const z = p.z + perp.z * off
      return { pos: new THREE.Vector3(x, hAt(x, z) + 0.1, z), yaw: Math.atan2(tan.x, tan.z) }
    }
    // R39/R41: percha del nodo vigente (misma regla que defaultU: current →
    // available → centro del camino)
    const lemurPerchForCurrent = () => {
      for (const [, m] of nodeMeta) if (m.state === 'current') return perchForU(m.u, m.side)
      for (const [, m] of nodeMeta) if (m.state === 'available') return perchForU(m.u, m.side)
      return perchForU(nodeMeta.size ? 0.5 : 0.08, 1)
    }
    // posado inicial cuando el GLB llegue (nodos por API aún no: inicio del
    // camino; si syncNodes ya corrió, el nodo vigente)
    void buildLemurRig({ hAt, reduced }).then((l) => {
      if (!l) return // sin mascota: mundo procedural intacto
      if (!wrap.isConnected) { l.dispose(); return } // desmontado durante la carga
      lemur = l
      world.add(l.group)
      l.perchTo(lemurPerchForCurrent(), { instant: true })
    })
    const syncNodes = (list: D3Node[]) => {
      setHover(null)
      const prevMeta = nodeMeta // R39: estados anteriores para el diff de celebración
      disposeNodes()
      nodeMeta = new Map()
      visualById = new Map()
      titleById = new Map()
      if (!list.length) { if (!builtOnce) builtOnce = true; return }
      const n = list.length
      list.forEach((node, i) => {
        let u = n === 1 ? 0.5 : 0.05 + (0.9 * i) / (n - 1)
        const p = new THREE.Vector3()
        curve.getPointAt(u, p)
        // misma regla que el constructor: nunca dentro del río
        for (let guard = 0; guard < 70 && cfg.river && Math.abs(p.z - cfg.river.z) < cfg.river.w + 1.7; guard++) {
          u = Math.min(0.985, u + 0.004)
          curve.getPointAt(u, p)
        }
        // R39/R41: el lado de la estructura alimenta la percha del compañero
        const side = node.final ? 0.3 : i % 2 === 0 ? 1.28 : -1.28
        nodeMeta.set(node.id, { u, state: node.state, side })
        titleById.set(node.id, node)
      })
      nodeWorld = buildLessonNodes(cfg, seed, curve, hAt, list)
      world.add(nodeWorld.group)
      list.forEach((node, i) => {
        const v = nodeWorld?.visuals[i]
        if (v) visualById.set(node.id, v)
      })
      // primer montaje: barrido corto por el camino hasta el nodo vigente
      if (!builtOnce) {
        builtOnce = true
        const target = clampU(defaultU())
        rig.jumpTo(clampU(target - (reduced ? 0 : 0.1)))
        rig.followU(target, false)
        // R39/R41: el compañero aparece posado junto al nodo vigente
        lemur?.perchTo(lemurPerchForCurrent(), { instant: true })
      } else {
        // R39/R41: re-sincronía de progreso — acompaña al nuevo nodo vigente
        // y celebra lo recién completado (si corre, celebra al llegar)
        lemur?.perchTo(lemurPerchForCurrent())
        for (const [id, m] of nodeMeta) {
          const prev = prevMeta.get(id)
          if (prev && prev.state !== 'done' && m.state === 'done') { lemur?.celebrate(); break }
        }
      }
    }
    const requestFocus = (id: string | null | undefined) => {
      const meta = id ? nodeMeta.get(id) : undefined
      if (!meta) return
      // R39/R41: el compañero corre sincronizado con el vuelo de cámara
      // (misma fórmula de duración que followU: 750 + dist·16 ms)
      const prevU = rig.focusU
      rig.followU(meta.u, false)
      const distM = Math.abs(meta.u - prevU) * curve.getLength()
      lemur?.perchTo(perchForU(meta.u, meta.side), {
        dur: Math.min(2.4, Math.max(0.9, (750 + distM * 16) / 1000)),
      })
    }
    const zoomStep = (dir: number) => {
      rig.zoomStep(dir)
    }
    apiRef.current = { syncNodes, requestFocus, zoomStep }

    // ── Raycaster: hover y click sobre los nodos ──
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const pickAt = (clientX: number, clientY: number): string | null => {
      if (!nodeWorld) return null
      const r = canvas.getBoundingClientRect()
      if (!r.width || !r.height) return null
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, rig.camera)
      const hit = ray.intersectObjects(nodeWorld.hits, false)[0]
      return hit ? ((hit.object.userData.d3dId as string) ?? null) : null
    }

    // ficha flotante del nodo bajo el cursor (proyectada desde el mundo 3D)
    const tip = document.createElement('div')
    tip.className = 'd3d-tip'
    tip.setAttribute('aria-hidden', 'true')
    const tipTitle = document.createElement('b')
    const tipState = document.createElement('span')
    tip.append(tipTitle, tipState)
    wrap.appendChild(tip)
    let hoveredId: string | null = null
    const setHover = (id: string | null) => {
      if (id === hoveredId) return
      const prev = hoveredId ? visualById.get(hoveredId) : null
      if (prev) prev.targetScale = 1
      hoveredId = id
      const v = id ? visualById.get(id) : null
      if (v) v.targetScale = 1.13
      const node = id ? titleById.get(id) : null
      if (id && node) {
        tipTitle.textContent = node.title
        tipState.textContent = D3_STATE_LABEL[node.state]
        tip.classList.add('on')
        canvas.style.cursor = 'pointer'
      } else {
        tip.classList.remove('on')
        canvas.style.cursor = 'grab'
      }
    }

    // punteros: arrastre = girar (OrbitControls), toque corto = seleccionar,
    // dos dedos = pellizco para acercar/alejar
    const active = new Map<number, { x: number; y: number }>()
    let pinch0 = 0
    let downX = 0
    let downY = 0
    const onDown = (e: PointerEvent) => {
      active.set(e.pointerId, { x: e.clientX, y: e.clientY })
      downX = e.clientX
      downY = e.clientY
      if (active.size === 2) {
        const [a, b] = [...active.values()]
        pinch0 = Math.hypot(a.x - b.x, a.y - b.y)
        rig.pinchStart()
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (active.has(e.pointerId)) active.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (active.size === 2 && pinch0 > 0) {
        const [a, b] = [...active.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d > 4) rig.pinchMove(pinch0 / d)
        return
      }
      setHover(pickAt(e.clientX, e.clientY))
    }
    const onUp = (e: PointerEvent) => {
      const wasTwo = active.size === 2
      active.delete(e.pointerId)
      if (wasTwo && active.size < 2) {
        pinch0 = 0
        rig.pinchEnd()
      }
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY)
      if (moved < 8 && nodeWorld) {
        const id = pickAt(e.clientX, e.clientY)
        if (id) selectRef.current?.(id)
      }
    }
    const onLeave = () => {
      setHover(null)
      active.clear()
      pinch0 = 0
      rig.pinchEnd()
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)

    let visible = true
    const io = new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true }, { rootMargin: '120px' })
    io.observe(wrap)

    const ro = new ResizeObserver(() => {
      const w = wrap.clientWidth, h = wrap.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      rig.resize(w, h)
    })
    ro.observe(wrap)

    const tipV = new THREE.Vector3()
    let raf = 0
    let last = performance.now()
    let t = 0
    let announced = false
    // R36: medición de rendimiento (fps rolling de 1 s) para evidencias
    let frames = 0
    let fpsT = performance.now()
    let fps = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!visible || !wrap.isConnected) return
      t += dt * (reduced ? 0.55 : 1)
      sharedU.uTime.value = t

      // viento: brisa base con ráfagas suaves
      const gust = 0.42 + 0.3 * Math.sin(t * 0.23) + 0.22 * Math.sin(t * 0.71 + 1.7)
      const windTarget = reduced ? 0.08 : Math.max(0.07, gust)
      sharedU.uWind.value += (windTarget - sharedU.uWind.value) * 0.03

      // ── cámara (R37: el rig concentra vuelos, transición World Map,
      //      órbita con damping y el zoom propio botones/pellizco) ──
      rig.update(now)
      // R38: en el modo World Map la niebla se afloja suave (por bioma) para
      // leer la isla entera; al volver al follow recupera su afinado R21.
      // Lerp exponencial con dt: independiente del framerate.
      const fogMul = rig.mode === 'world' ? 3.1 : 1
      const fog = scene.fog as THREE.Fog
      const fogK = 1 - Math.exp(-dt * 4.5)
      fog.near += (cfg.fogNear * fogMul - fog.near) * fogK
      fog.far += (cfg.fogFar * fogMul - fog.far) * fogK
      // el sol acompaña al punto de interés: sombras nítidas donde se mira
      sun.position.copy(rig.target).addScaledVector(sunOffDir, 58)
      sun.target.position.copy(rig.target)

      // vida del mundo
      if (clouds) {
        for (const m of clouds.meshes) {
          m.position.x += clouds.speed * dt * (reduced ? 0.3 : 1)
          if (m.position.x > 78) m.position.x = -78
        }
      }
      birds?.update(t)
      leaves.update(dt, t, sharedU.uWind.value, reduced ? 1 : 0)
      lemur?.update(t, dt) // R39/R41: vida del compañero
      if (glbUpdate) glbUpdate(t, dt) // R40: fauna animada de la capa GLB
      if (fireflies.pts.visible) {
        const fp = fireflies.pts.geometry.attributes.position as THREE.BufferAttribute
        for (let i = 0; i < 34; i++) {
          fp.setY(i, fireflies.base[i * 3 + 1] + Math.sin(t * 1.25 + i * 1.9) * 0.42)
          fp.setX(i, fireflies.base[i * 3] + Math.sin(t * 0.6 + i * 0.7) * 0.5)
        }
        fp.needsUpdate = true
      }

      // vida de los nodos: gema flotante, brillo, banderas y hover
      if (nodeWorld) {
        for (const v of nodeWorld.visuals) {
          v.scale += (v.targetScale - v.scale) * 0.16
          v.group.scale.setScalar(v.scale)
          if (v.gem) {
            v.gem.position.y = v.gemBaseY + Math.sin(t * 1.35 + v.ph) * (reduced ? 0.06 : 0.16)
            v.gem.rotation.y = t * 0.8 + v.ph
          }
          if (v.glow) {
            const gm = v.glow.material as THREE.SpriteMaterial
            gm.opacity = 0.42 + Math.sin(t * 1.9 + v.ph) * 0.13
          }
          if (v.flag) v.flag.rotation.z = Math.sin(t * 2.1 + v.ph) * 0.09
        }
        // ficha flotante proyectada desde el mundo 3D
        if (hoveredId) {
          const v = visualById.get(hoveredId)
          if (v) {
            tipV.copy(v.anchor).project(rig.camera)
            if (tipV.z < 1) {
              tip.style.left = `${((tipV.x * 0.5 + 0.5) * wrap.clientWidth).toFixed(1)}px`
              tip.style.top = `${((-tipV.y * 0.5 + 0.5) * wrap.clientHeight).toFixed(1)}px`
            }
          }
        }
      }

      renderer.render(scene, rig.camera)
      frames++
      if (now - fpsT >= 1000) { fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now }
      if (!announced) { announced = true; wrap.classList.add('d3d-on'); readyRef.current?.() }
    }
    // primer sincronizado de nodos (los efectos de firma corren antes en el
    // montaje, cuando apiRef aún era null)
    if (nodesRef.current?.length) syncNodes(nodesRef.current)
    // asa de depuración (herramientas de evidencia; no afecta la app). stats()
    // (R36): fps, draw calls, triángulos y memoria del último frame renderizado.
    ;(window as unknown as { __d3d?: object }).__d3d = {
      camera: rig.camera, controls: rig.controls, curve, nodeWorld: () => nodeWorld,
      scene, world, // R40: asa de evidencia (sondas de escena; la app no la usa)
      // R37: conmutadores del prototipo de cámara (herramientas de evidencia;
      // la app no los usa — comportamiento por defecto idéntico a R21)
      setProjection: (p: 'persp' | 'ortho') => rig.setProjection(p),
      getProjection: () => rig.proj,
      setMode: (m: 'follow' | 'world') => rig.setMode(m),
      getMode: () => rig.mode,
      // R41: asa del lémur (evidencia; la app no la usa)
      lemur: () => lemur,
      setLemurState: (s: LemurState) => lemur?.setState(s),
      getLemurState: () => lemur?.state ?? null,
      stats: () => ({
        fps,
        calls: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        geos: renderer.info.memory.geometries,
        tex: renderer.info.memory.textures,
        progs: renderer.info.programs?.length ?? 0,
        tone: renderer.toneMapping,
      }),
    }
    raf = requestAnimationFrame(loop)

    // ── limpieza completa ──
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      apiRef.current = null
      rig.dispose()
      lemur?.dispose() // R41: detiene el mixer y libera su instancia clonada
      lemur = null
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      tip.remove()
      applyPhaseRef.current = null
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const m = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material
        if (Array.isArray(m)) m.forEach(x => x.dispose())
        else if (m) m.dispose()
      })
      renderer.dispose()
      orbMat.map?.dispose()
      fireflies.mat.map?.dispose()
      waterfall?.dispose()
      if (canvas.isConnected) wrap.removeChild(canvas)
    }
  }, [variant])

  return (
    <div ref={wrapRef} className="landscape3d">
      <div className="d3d-hint" aria-hidden="true">Arrastra para girar el mundo · toca un nodo</div>
      <div className="d3d-zooms">
        <button type="button" className="d3d-zoom" aria-label="Acercar la cámara" onClick={() => apiRef.current?.zoomStep(1)}>+</button>
        <button type="button" className="d3d-zoom" aria-label="Alejar la cámara" onClick={() => apiRef.current?.zoomStep(-1)}>−</button>
      </div>
    </div>
  )
}
