'use client'

/*
 * ===================== ARCHIPIÉLAGO 2D ESTILO CUPHEAD (PixiJS v8) =====================
 * Muestra TODOS los 10 módulos de inglés (A1.1 → B1.2) como 10 islas independientes,
 * separadas en un océano continuo sin contornos cuadrados (100% 2D, sin versión 3D):
 *   - Cada módulo tiene su propia isla con silueta/orientación y paleta de acuarela distinta.
 *   - Los módulos futuros bloqueados se muestran en escala de grises real (ColorMatrixFilter)
 *     y al hacer clic abren su vista previa monocromática.
 *   - Un barco caricatura 1930s navega por la ruta marítima de la Isla N a la Isla N+1
 *     cuando se completa un módulo, simulando el desbloqueo de la siguiente isla.
 *   - La mascota de Axiom (lémur Axi) aparece junto al nivel que se está cursando
 *     como si lo estuviera sosteniendo con sus patas.
 */

import { useEffect, useRef, useState } from 'react'
import {
  getIslandAssetForModule,
  getIslandTheme2D,
  type IslandAssetSpec,
} from '@/lib/world/overworld2d-themes'
import { AXI_MASCOT_DATA_URI } from '@/lib/world/axi-mascot-svg'
import { BLOCK_LABELS, COURSE_MODULES, type CourseModule } from '@/lib/books/modules'
import type { ScenePhase } from '@/lib/world/configs'
import { MS } from '@/components/icons'

export interface Overworld2DNode {
  id: string
  title: string
  state: 'done' | 'current' | 'locked'
  block?: 'grammar' | 'writing' | 'speaking' | 'listening' | 'vocab' | 'review' | 'final'
  final?: boolean
  order?: number
}

export interface ModuleArchipelagoStatus {
  code: string
  index: number
  unlocked: boolean
  state: 'available' | 'in_progress' | 'completed' | 'locked'
  done: number
  total: number
  pct: number
  lockReason?: string | null
}

interface Overworld2DProps {
  moduleInfo: CourseModule
  allModulesStatus?: ModuleArchipelagoStatus[]
  phase: ScenePhase
  nodes: Overworld2DNode[]
  focusId?: string | null
  doneCount: number
  totalCount: number
  isCurrentCompleted?: boolean
  onBack?: () => void
  onOpenCert?: () => void
  onNodeSelect: (id: string) => void
  onSelectModule?: (moduleCode: string) => void
  onReady?: () => void
}

// Separación generosa entre cada una de las 10 islas del archipiélago
const ISLAND_STRIDE_X = 1920
const BASE_Y_CENTER = 440
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

function islandPlacement(index1Based: number) {
  const i = index1Based - 1
  const cx = 760 + i * ISLAND_STRIDE_X
  // Ligero vaivén vertical orgánico para que parezca un archipiélago real
  const offsets = [0, -85, 65, -55, 80, -70, 55, -80, 60, -30]
  const cy = BASE_Y_CENTER + (offsets[i % offsets.length] || 0)
  return { cx, cy }
}

function sampleRoadPoints(
  asset: IslandAssetSpec,
  cx: number,
  cy: number,
  count: number,
  flipX?: boolean,
): { x: number; y: number }[] {
  const waypoints = asset.roadWaypoints
  if (count <= 0) return []
  const left = cx - asset.width * 0.5
  const top = cy - asset.height * 0.5
  const mapX = (nx: number) => left + (flipX ? 1 - nx : nx) * asset.width
  const mapY = (ny: number) => top + ny * asset.height
  if (count === 1) {
    return [{ x: mapX(waypoints[0][0]), y: mapY(waypoints[0][1]) }]
  }
  const out: { x: number; y: number }[] = []
  const lastIdx = waypoints.length - 1
  for (let i = 0; i < count; i++) {
    const t = (i / (count - 1)) * lastIdx
    const i0 = Math.floor(t)
    const i1 = Math.min(lastIdx, i0 + 1)
    const frac = t - i0
    const nx = waypoints[i0][0] + (waypoints[i1][0] - waypoints[i0][0]) * frac
    const ny = waypoints[i0][1] + (waypoints[i1][1] - waypoints[i0][1]) * frac
    out.push({ x: mapX(nx), y: mapY(ny) })
  }
  return out
}

// Carga estándar vía HTMLImageElement (evita Web Workers blob: bloqueados por CSP)
function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Dibuja el barco caricatura estilo Cuphead 1930s que zarpa entre islas
function buildCupheadShip(PIXI: typeof import('pixi.js')) {
  const ship = new PIXI.Container()

  // Estela de agua bajo el casco
  const wake = new PIXI.Graphics()
  wake.ellipse(-4, 15, 38, 10)
  wake.fill({ color: 0xfaf3e7, alpha: 0.48 })
  ship.addChild(wake)

  const g = new PIXI.Graphics()
  // Casco de madera con contorno tinta cacao
  g.poly([-30, 0, 32, 0, 22, 16, -22, 16])
  g.fill(0x8c5535)
  g.stroke({ width: 3, color: 0x2d2a26 })

  // Franja decorativa mostaza en el casco
  g.moveTo(-26, 5)
  g.lineTo(27, 5)
  g.stroke({ width: 3, color: 0xe9b83e })

  // Cabina trasera
  g.roundRect(-22, -10, 16, 10, 3)
  g.fill(0xfaf3e7)
  g.stroke({ width: 2.5, color: 0x2d2a26 })

  // Mástil
  g.moveTo(2, 0)
  g.lineTo(2, -46)
  g.stroke({ width: 3.5, color: 0x2d2a26 })

  // Vela principal abombada (crema + franja coral)
  g.moveTo(4, -40)
  g.quadraticCurveTo(28, -24, 4, -6)
  g.closePath()
  g.fill(0xfaf3e7)
  g.stroke({ width: 2.8, color: 0x2d2a26 })

  g.moveTo(5, -27)
  g.quadraticCurveTo(20, -23, 5, -18)
  g.closePath()
  g.fill(0xe76f51)

  // Vela secundaria izquierda
  g.moveTo(0, -36)
  g.quadraticCurveTo(-15, -24, 0, -10)
  g.closePath()
  g.fill(0xf5e5c4)
  g.stroke({ width: 2.4, color: 0x2d2a26 })

  // Banderín en la punta del mástil
  g.poly([2, -46, 18, -42, 2, -37])
  g.fill(0xe9b83e)
  g.stroke({ width: 2, color: 0x2d2a26 })

  ship.addChild(g)
  return ship
}

// Dibuja a Axi (el lémur mascota de Axiom) junto al nivel actual sosteniendo el medallón
function buildAxiMascotHolding(PIXI: typeof import('pixi.js')) {
  const mascot = new PIXI.Container()

  // Cola anillada característica del lémur (en contenedor propio para animarla)
  const tail = new PIXI.Graphics()
  tail.moveTo(-8, 12)
  tail.bezierCurveTo(-28, 10, -34, -14, -18, -26)
  tail.stroke({ width: 8, color: 0x2d2a26, cap: 'round' })
  tail.moveTo(-8, 12)
  tail.bezierCurveTo(-28, 10, -34, -14, -18, -26)
  tail.stroke({ width: 5, color: 0xe6e1d6, cap: 'round' })
  // Anillos oscuros de la cola
  const rings: [number, number][] = [
    [-16, 10],
    [-25, 2],
    [-27, -10],
    [-22, -21],
  ]
  rings.forEach(([rx, ry]) => {
    tail.circle(rx, ry, 2.7)
    tail.fill(0x2d2a26)
  })
  mascot.addChild(tail)

  const body = new PIXI.Graphics()
  // Sombra
  body.ellipse(0, 22, 16, 5.5)
  body.fill({ color: 0x2d2a26, alpha: 0.28 })

  // Pies
  body.ellipse(-6, 19, 6, 3.8)
  body.fill(0x524e48)
  body.stroke({ width: 2, color: 0x2d2a26 })
  body.ellipse(6, 19, 6, 3.8)
  body.fill(0x524e48)
  body.stroke({ width: 2, color: 0x2d2a26 })

  // Cuerpo gris cálido + pancita crema
  body.roundRect(-10, -2, 20, 21, 9)
  body.fill(0x8d877e)
  body.stroke({ width: 2.5, color: 0x2d2a26 })
  body.ellipse(1, 9, 6.5, 8)
  body.fill(0xfaf3e7)

  // Pañuelo coral de Axiom
  body.roundRect(-11, -3, 22, 5.5, 2.5)
  body.fill(0xe76f51)
  body.stroke({ width: 2, color: 0x2d2a26 })

  // Cabeza redonda de lémur
  body.circle(0, -15, 13)
  body.fill(0xfaf3e7)
  body.stroke({ width: 2.5, color: 0x2d2a26 })

  // Orejas redondas
  body.circle(-11, -24, 5)
  body.fill(0x7c766d)
  body.stroke({ width: 2.2, color: 0x2d2a26 })
  body.circle(11, -24, 5)
  body.fill(0x7c766d)
  body.stroke({ width: 2.2, color: 0x2d2a26 })

  // Antifaz oscuro de lémur + ojos expresivos
  body.ellipse(-4.5, -15.5, 4.6, 5.2)
  body.fill(0x3a3631)
  body.ellipse(5, -15.5, 4.6, 5.2)
  body.fill(0x3a3631)
  body.circle(-4.2, -16, 2.3)
  body.fill(0xe9b83e)
  body.circle(5.3, -16, 2.3)
  body.fill(0xe9b83e)
  body.circle(-4.2, -16, 1.1)
  body.fill(0x2d2a26)
  body.circle(5.3, -16, 1.1)
  body.fill(0x2d2a26)

  // Hocico
  body.ellipse(0.5, -10.5, 3.2, 2.2)
  body.fill(0x2d2a26)

  // Brazos extendidos hacia la derecha sosteniendo el medallón del nivel
  body.moveTo(8, 2)
  body.quadraticCurveTo(18, -2, 24, -6)
  body.stroke({ width: 5.5, color: 0x2d2a26, cap: 'round' })
  body.moveTo(8, 2)
  body.quadraticCurveTo(18, -2, 24, -6)
  body.stroke({ width: 3.2, color: 0x8d877e, cap: 'round' })
  // Patita superior apoyada en el borde del medallón
  body.circle(25, -6, 4.2)
  body.fill(0xfaf3e7)
  body.stroke({ width: 2, color: 0x2d2a26 })

  body.moveTo(9, 10)
  body.quadraticCurveTo(18, 11, 24, 8)
  body.stroke({ width: 5.5, color: 0x2d2a26, cap: 'round' })
  body.moveTo(9, 10)
  body.quadraticCurveTo(18, 11, 24, 8)
  body.stroke({ width: 3.2, color: 0x8d877e, cap: 'round' })
  // Patita inferior sosteniendo el medallón
  body.circle(25, 8, 4.2)
  body.fill(0xfaf3e7)
  body.stroke({ width: 2, color: 0x2d2a26 })

  mascot.addChild(body)
  return { mascot, tail }
}

export function Overworld2D({
  moduleInfo,
  allModulesStatus,
  phase,
  nodes,
  focusId,
  doneCount,
  totalCount,
  isCurrentCompleted = false,
  onBack,
  onOpenCert,
  onNodeSelect,
  onSelectModule,
  onReady,
}: Overworld2DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const cameraApiRef = useRef<{
    zoomBy: (delta: number) => void
    focusIsland: (moduleIndex: number) => void
    focusNode: (id: string) => void
  } | null>(null)

  const onNodeSelectRef = useRef(onNodeSelect)
  const onSelectModuleRef = useRef(onSelectModule)
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect
    onSelectModuleRef.current = onSelectModule
    onReadyRef.current = onReady
  }, [onNodeSelect, onSelectModule, onReady])

  const [hoveredNode, setHoveredNode] = useState<{
    index: number
    node: Overworld2DNode
  } | null>(null)
  const [hoveredIsland, setHoveredIsland] = useState<{
    mod: CourseModule
    unlocked: boolean
    completed: boolean
  } | null>(null)
  const [previewModule, setPreviewModule] = useState<CourseModule | null>(null)
  const [focusedIslandIdx, setFocusedIslandIdx] = useState<number>(moduleInfo.index)

  useEffect(() => {
    setFocusedIslandIdx(moduleInfo.index)
  }, [moduleInfo.index])

  const theme = getIslandTheme2D(moduleInfo.index)
  const nodesSignature = nodes.map(n => `${n.id}:${n.state}`).join('|')
  const statusSignature = (allModulesStatus || [])
    .map(m => `${m.code}:${m.unlocked ? 1 : 0}:${m.state}`)
    .join('|')

  useEffect(() => {
    if (focusId) cameraApiRef.current?.focusNode(focusId)
  }, [focusId])

  useEffect(() => {
    let disposed = false
    const host = hostRef.current
    if (!host) return

    let appInstance: import('pixi.js').Application | null = null

    const init = async () => {
      const PIXI = await import('pixi.js')
      if (disposed || !hostRef.current) return

      const app = new PIXI.Application()
      const isNight = phase === 'night'
      const isDusk = phase === 'dusk'
      const isDawn = phase === 'dawn'

      const skyTopCol = isNight ? 0x16243d : isDusk ? 0x695985 : isDawn ? 0xbcd3e2 : theme.skyTop
      const oceanMidCol = isNight ? 0x1e3352 : isDusk ? 0x706c8f : isDawn ? 0x9ec4cf : theme.oceanMid
      const oceanBotCol = isNight ? 0x15253d : isDusk ? 0x4b5373 : isDawn ? 0x74a3b5 : theme.oceanBottom

      await app.init({
        resizeTo: host,
        backgroundColor: oceanMidCol,
        antialias: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
      })

      if (disposed) {
        app.destroy(true, { children: true })
        return
      }

      appInstance = app
      host.innerHTML = ''
      host.appendChild(app.canvas)
      app.canvas.style.display = 'block'
      app.canvas.style.width = '100%'
      app.canvas.style.height = '100%'
      app.canvas.style.cursor = 'grab'

      // =====================================================================
      // CAPA 0: CIELO Y OCÉANO INFINITO (fijo al viewport, sin contornos cuadrados)
      // =====================================================================
      const skyOceanLayer = new PIXI.Container()
      app.stage.addChild(skyOceanLayer)

      const skyBg = new PIXI.Graphics()
      const orbG = new PIXI.Graphics()
      const starsG = new PIXI.Graphics()
      skyOceanLayer.addChild(skyBg, starsG, orbG)

      const drawViewportBackdrop = () => {
        const vw = app.screen.width || 1100
        const vh = app.screen.height || 620

        skyBg.clear()
        const grad = new PIXI.FillGradient({
          type: 'linear',
          start: { x: 0, y: 0 },
          end: { x: 0, y: vh },
          colorStops: [
            { offset: 0, color: skyTopCol },
            { offset: 0.42, color: oceanMidCol },
            { offset: 1, color: oceanBotCol },
          ],
          textureSpace: 'global',
        })
        skyBg.rect(0, 0, vw, vh)
        skyBg.fill(grad)

        orbG.clear()
        const orbX = vw * 0.86
        const orbY = vh * 0.14
        const orbColor = isNight ? 0xf2ebd9 : isDusk ? 0xffb36b : 0xffe9a6
        orbG.circle(orbX, orbY, 54)
        orbG.fill({ color: orbColor, alpha: isNight ? 0.12 : 0.22 })
        orbG.circle(orbX, orbY, 26)
        orbG.fill({ color: orbColor, alpha: isNight ? 0.35 : 0.45 })

        starsG.clear()
        if (isNight) {
          for (let s = 0; s < 42; s++) {
            const sx = (((s * 173 + 47) % 1000) / 1000) * vw
            const sy = (((s * 97 + 23) % 1000) / 1000) * (vh * 0.46)
            starsG.circle(sx, sy, 1.2 + (s % 3) * 0.5)
            starsG.fill({ color: 0xfaf3e7, alpha: 0.35 + (s % 4) * 0.12 })
          }
        }
      }
      drawViewportBackdrop()

      const oceanWaves: { g: import('pixi.js').Graphics; baseX: number; phase: number; amp: number }[] = []
      const wavesLayer = new PIXI.Container()
      skyOceanLayer.addChild(wavesLayer)
      for (let i = 0; i < 28; i++) {
        const wg = new PIXI.Graphics()
        const wx = (i * 191 + 40) % 1600
        const wy = (i * 117 + 70) % 820
        wg.moveTo(0, 0)
        wg.quadraticCurveTo(14, -5, 28, 0)
        wg.quadraticCurveTo(42, -5, 56, 0)
        wg.stroke({
          width: 2.2,
          color: theme.waveColor,
          alpha: isNight ? 0.14 : 0.3,
          cap: 'round',
        })
        wg.position.set(wx, wy)
        wavesLayer.addChild(wg)
        oceanWaves.push({ g: wg, baseX: wx, phase: i * 0.7, amp: 8 + (i % 3) * 4 })
      }

      // =====================================================================
      // CONTENEDOR DEL ARCHIPIÉLAGO (10 islas separadas)
      // =====================================================================
      const world = new PIXI.Container()
      app.stage.addChild(world)

      // Cargar las texturas base recortadas (PNG transparentes) + mascota Axi ilustrada en SVG 2D
      const [img1, img2, axiImg] = await Promise.all([
        loadHtmlImage('/assets/overworld/island-1.png'),
        loadHtmlImage('/assets/overworld/island-2.png'),
        loadHtmlImage(AXI_MASCOT_DATA_URI),
      ])
      if (disposed) return

      const texMap: Record<string, import('pixi.js').Texture | null> = {
        'island-1': img1 ? PIXI.Texture.from(img1) : null,
        'island-2': img2 ? PIXI.Texture.from(img2) : null,
      }
      const axiTex = axiImg ? PIXI.Texture.from(axiImg) : null

      // Mapa de estado por código de módulo
      const statusMap = new Map<string, ModuleArchipelagoStatus>()
      ;(allModulesStatus || []).forEach(s => statusMap.set(s.code, s))

      const getModState = (mod: CourseModule) => {
        const s = statusMap.get(mod.code)
        if (s) {
          const completed =
            s.state === 'completed' || (mod.code === moduleInfo.code && isCurrentCompleted)
          return { unlocked: s.unlocked || mod.index === 1, completed, done: s.done, total: s.total }
        }
        if (mod.code === moduleInfo.code) {
          return { unlocked: true, completed: isCurrentCompleted, done: doneCount, total: totalCount }
        }
        return {
          unlocked: mod.index <= moduleInfo.index,
          completed: mod.index < moduleInfo.index,
          done: 0,
          total: mod.lessons.length,
        }
      }

      // Capas independientes del mundo
      const routesLayer = new PIXI.Container()
      const islandsLayer = new PIXI.Container()
      const nodesLayer = new PIXI.Container()
      const shipLayer = new PIXI.Container()
      const skyForegroundLayer = new PIXI.Container()
      world.addChild(routesLayer, islandsLayer, nodesLayer, shipLayer, skyForegroundLayer)

      const foams: import('pixi.js').Graphics[] = []
      const pulseRings: import('pixi.js').Graphics[] = []
      const floatArrows: { obj: import('pixi.js').Graphics; baseY: number }[] = []
      const nodePositions = new Map<string, { x: number; y: number }>()
      let axiSpriteRef: { sprite: import('pixi.js').Sprite; baseY: number } | null = null

      // =====================================================================
      // RUTAS MARÍTIMAS ENTRE LAS 10 ISLAS (curvas punteadas en el mar)
      // =====================================================================
      interface SeaRoute {
        fromIndex: number
        toIndex: number
        p0: { x: number; y: number }
        ctrl: { x: number; y: number }
        p1: { x: number; y: number }
        unlocked: boolean
      }
      const seaRoutes: SeaRoute[] = []

      for (let i = 0; i < COURSE_MODULES.length - 1; i++) {
        const modA = COURSE_MODULES[i]
        const modB = COURSE_MODULES[i + 1]
        const posA = islandPlacement(modA.index)
        const posB = islandPlacement(modB.index)
        const assetA = getIslandAssetForModule(modA.index)
        const assetB = getIslandAssetForModule(modB.index)
        const stateA = getModState(modA)
        const stateB = getModState(modB)

        const p0 = { x: posA.cx + assetA.width * 0.42, y: posA.cy + 145 }
        const p1 = { x: posB.cx - assetB.width * 0.42, y: posB.cy + 145 }
        const ctrl = {
          x: (p0.x + p1.x) * 0.5,
          y: Math.max(p0.y, p1.y) + 95,
        }
        const routeActive = stateA.completed || stateB.unlocked
        seaRoutes.push({
          fromIndex: modA.index,
          toIndex: modB.index,
          p0,
          ctrl,
          p1,
          unlocked: routeActive,
        })

        // Dibujar línea punteada marítima estilo mapa pirata / Cuphead
        const rg = new PIXI.Graphics()
        const segments = 22
        for (let s = 0; s < segments; s += 2) {
          const t0 = s / segments
          const t1 = Math.min(1, (s + 0.85) / segments)
          const ptAt = (t: number) => ({
            x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * ctrl.x + t * t * p1.x,
            y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * ctrl.y + t * t * p1.y,
          })
          const a = ptAt(t0)
          const b = ptAt(t1)
          rg.moveTo(a.x, a.y)
          rg.lineTo(b.x, b.y)
          rg.stroke({
            width: routeActive ? 5 : 4,
            color: routeActive ? 0xe9b83e : 0xfaf3e7,
            alpha: routeActive ? 0.85 : 0.35,
            cap: 'round',
          })
        }
        routesLayer.addChild(rg)
      }

      // =====================================================================
      // RENDER DE LAS 10 ISLAS INDEPENDIENTES
      // =====================================================================
      COURSE_MODULES.forEach(mod => {
        const { cx, cy } = islandPlacement(mod.index)
        const modTheme = getIslandTheme2D(mod.index)
        const asset = getIslandAssetForModule(mod.index)
        const st = getModState(mod)
        const isSelected = mod.code === moduleInfo.code
        const isLocked = !st.unlocked

        const islandWrap = new PIXI.Container()
        islandWrap.position.set(cx, cy)

        // Halo de espuma orgánica alrededor de cada isla (cero bordes cuadrados)
        const foam = new PIXI.Graphics()
        foam.ellipse(0, 26, asset.width * 0.45, asset.height * 0.42)
        foam.fill({ color: isLocked ? 0xd9e0e3 : modTheme.waveColor, alpha: isNight ? 0.08 : 0.16 })
        foam.ellipse(0, 26, asset.width * 0.48, asset.height * 0.45)
        foam.stroke({
          width: 2.5,
          color: isLocked ? 0xd0d6d9 : modTheme.waveColor,
          alpha: isNight ? 0.12 : 0.24,
        })
        islandWrap.addChild(foam)
        foams.push(foam)

        const tex = texMap[asset.key]
        if (tex) {
          const sprite = new PIXI.Sprite(tex)
          sprite.anchor.set(0.5)
          sprite.width = asset.width
          sprite.height = asset.height
          if (modTheme.flipX) sprite.scale.x = -Math.abs(sprite.scale.x)

          const cm = new PIXI.ColorMatrixFilter()
          if (isLocked) {
            cm.desaturate()
            cm.brightness(0.92, true)
            sprite.alpha = 0.82
          } else {
            if (modTheme.hueShift !== 0) cm.hue(modTheme.hueShift, true)
            if (modTheme.saturation !== 0) cm.saturate(modTheme.saturation, true)
            const phaseBrightness = isNight ? 0.86 : isDusk ? 0.94 : modTheme.brightness
            if (phaseBrightness !== 1) cm.brightness(phaseBrightness, true)
          }
          sprite.filters = [cm]
          islandWrap.addChild(sprite)
        }

        // Letrero vintage de cada isla arriba de su cima
        const plateY = -asset.height * 0.46
        const plate = new PIXI.Graphics()
        const plateW = 290
        plate.roundRect(-plateW / 2, plateY - 24, plateW, 48, 16)
        plate.fill({
          color: isLocked ? 0x454545 : isSelected ? 0xfaf3e7 : 0xf4ece0,
          alpha: 0.94,
        })
        plate.stroke({
          width: isSelected ? 3.5 : 2.5,
          color: isLocked ? 0xd8d8d8 : isSelected ? 0xe76f51 : 0x2d2a26,
        })
        islandWrap.addChild(plate)

        const titlePrefix = isLocked ? '🔒 ' : st.completed ? '✓ ' : ''
        const islandLabel = new PIXI.Text({
          text: `${titlePrefix}ISLA ${ROMAN[mod.index - 1]} · ${mod.level}`,
          style: {
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            fontWeight: 'bold',
            fill: isLocked ? '#F2F2F2' : '#2D2A26',
          },
        })
        islandLabel.anchor.set(0.5)
        islandLabel.position.set(0, plateY - 7)
        islandWrap.addChild(islandLabel)

        const islandSub = new PIXI.Text({
          text: isLocked
            ? 'Clic para vista previa en gris'
            : st.completed
              ? 'Completada · Clic para visitar'
              : isSelected
                ? modTheme.islandName.replace(/^Isla [IVX]+ · /, '')
                : 'Disponible · Clic para entrar',
          style: {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 11,
            fontWeight: 'bold',
            fill: isLocked ? '#D2D2D2' : st.completed ? '#4E6E4D' : '#E76F51',
          },
        })
        islandSub.anchor.set(0.5)
        islandSub.position.set(0, plateY + 11)
        islandWrap.addChild(islandSub)

        // Si NO es la isla actualmente abierta, toda la isla es clicable (entrar o vista previa gris)
        if (!isSelected) {
          islandWrap.eventMode = 'static'
          islandWrap.cursor = 'pointer'
          let downPos = { x: 0, y: 0 }
          islandWrap.on('pointerover', () => {
            islandWrap.scale.set(1.025)
            setHoveredIsland({ mod, unlocked: !isLocked, completed: st.completed })
          })
          islandWrap.on('pointerout', () => {
            islandWrap.scale.set(1.0)
            setHoveredIsland(prev => (prev?.mod.code === mod.code ? null : prev))
          })
          islandWrap.on('pointerdown', e => {
            downPos = { x: e.global.x, y: e.global.y }
          })
          islandWrap.on('pointerup', e => {
            if (Math.hypot(e.global.x - downPos.x, e.global.y - downPos.y) < 10) {
              if (isLocked) {
                setPreviewModule(mod)
              } else {
                onSelectModuleRef.current?.(mod.code)
              }
            }
          })
        }

        islandsLayer.addChild(islandWrap)

        // =====================================================================
        // NIVELES + MASCOTA AXI SOSTENIENDO EL NIVEL ACTUAL (en la isla activa)
        // =====================================================================
        if (isSelected) {
          const pts = sampleRoadPoints(asset, cx, cy, nodes.length, modTheme.flipX)

          // Camino punteado entre los 14 medallones
          const pathG = new PIXI.Graphics()
          for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i]
            const b = pts[i + 1]
            const doneSeg = nodes[i].state === 'done'
            const dist = Math.hypot(b.x - a.x, b.y - a.y)
            const steps = Math.max(3, Math.floor(dist / 16))
            for (let s = 0; s < steps; s += 2) {
              const t0 = s / steps
              const t1 = Math.min(1, (s + 1) / steps)
              const x0 = a.x + (b.x - a.x) * t0
              const y0 = a.y + (b.y - a.y) * t0
              const x1 = a.x + (b.x - a.x) * t1
              const y1 = a.y + (b.y - a.y) * t1
              pathG.moveTo(x0, y0)
              pathG.lineTo(x1, y1)
              pathG.stroke({ width: 7, color: 0x2d2a26, alpha: 0.45, cap: 'round' })
              pathG.moveTo(x0, y0)
              pathG.lineTo(x1, y1)
              pathG.stroke({
                width: 4,
                color: doneSeg ? 0xe9b83e : modTheme.pathColor,
                alpha: doneSeg ? 0.95 : 0.85,
                cap: 'round',
              })
            }
          }
          nodesLayer.addChild(pathG)

          nodes.forEach((node, idx) => {
            const pt = pts[idx]
            if (!pt) return
            nodePositions.set(node.id, pt)

            const isDone = node.state === 'done'
            const isCurrent = node.state === 'current'
            const isNodeLocked = node.state === 'locked'
            const isFinal = Boolean(node.final || node.block === 'final')
            const radius = isFinal ? 28 : 22

            // Mascota Axi bonita parada justo al lado izquierdo del nivel cursando, sosteniéndolo
            if (isCurrent && axiTex) {
              const axiSp = new PIXI.Sprite(axiTex)
              axiSp.anchor.set(0.84, 0.62)
              axiSp.width = 76
              axiSp.height = 80
              const mx = pt.x - radius + 5
              const my = pt.y + 4
              axiSp.position.set(mx, my)
              nodesLayer.addChild(axiSp)
              axiSpriteRef = { sprite: axiSp, baseY: my }
            }

            const container = new PIXI.Container()
            container.position.set(pt.x, pt.y)
            container.eventMode = 'static'
            container.cursor = 'pointer'

            const shadow = new PIXI.Graphics()
            shadow.ellipse(0, radius * 0.55, radius * 1.15, radius * 0.45)
            shadow.fill({ color: 0x2d2a26, alpha: 0.3 })
            container.addChild(shadow)

            if (isCurrent) {
              const ring = new PIXI.Graphics()
              ring.circle(0, 0, radius + 9)
              ring.stroke({ width: 4, color: 0xe9b83e, alpha: 0.95 })
              container.addChild(ring)
              pulseRings.push(ring)

              const arrow = new PIXI.Graphics()
              arrow.poly([-10, -radius - 26, 10, -radius - 26, 0, -radius - 11])
              arrow.fill(0xe9b83e)
              arrow.stroke({ width: 2.8, color: 0x2d2a26 })
              container.addChild(arrow)
              floatArrows.push({ obj: arrow, baseY: 0 })
            }

            const medal = new PIXI.Graphics()
            medal.circle(0, 0, radius + 3)
            medal.fill(0xfaf3e7)
            medal.stroke({ width: 3.5, color: 0x2d2a26 })

            const fillCol = isDone
              ? 0x6b8e6a
              : isCurrent
                ? isFinal
                  ? 0xe9b83e
                  : modTheme.accentNum
                : 0x8f8c86
            medal.circle(0, 0, radius - 2)
            medal.fill(fillCol)
            medal.stroke({ width: 2, color: 0x2d2a26, alpha: 0.5 })
            container.addChild(medal)

            const symbol = isDone
              ? '✓'
              : isNodeLocked
                ? '🔒'
                : isFinal
                  ? '★'
                  : String(idx + 1).padStart(2, '0')

            const text = new PIXI.Text({
              text: symbol,
              style: {
                fontFamily: 'Georgia, serif',
                fontSize: isNodeLocked ? 13 : isFinal ? 18 : 14,
                fontWeight: 'bold',
                fill: isCurrent && isFinal ? '#2D2A26' : '#FAF3E7',
              },
            })
            text.anchor.set(0.5)
            container.addChild(text)

            if (isCurrent || isFinal) {
              const shortLbl =
                node.title.length > 20 ? node.title.slice(0, 19) + '…' : node.title
              const pill = new PIXI.Graphics()
              const tw = Math.max(88, shortLbl.length * 6.8 + 18)
              pill.roundRect(-tw / 2, radius + 7, tw, 22, 11)
              pill.fill({ color: 0xfaf3e7, alpha: 0.94 })
              pill.stroke({ width: 2, color: 0x2d2a26 })
              container.addChild(pill)

              const lbl = new PIXI.Text({
                text: shortLbl,
                style: {
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  fontSize: 11,
                  fontWeight: 'bold',
                  fill: '#2D2A26',
                },
              })
              lbl.anchor.set(0.5)
              lbl.position.set(0, radius + 18)
              container.addChild(lbl)
            }

            let downPos = { x: 0, y: 0 }
            container.on('pointerover', () => {
              container.scale.set(1.14)
              setHoveredNode({ index: idx, node })
            })
            container.on('pointerout', () => {
              container.scale.set(1.0)
              setHoveredNode(prev => (prev?.node.id === node.id ? null : prev))
            })
            container.on('pointerdown', e => {
              downPos = { x: e.global.x, y: e.global.y }
            })
            container.on('pointerup', e => {
              if (Math.hypot(e.global.x - downPos.x, e.global.y - downPos.y) < 10) {
                onNodeSelectRef.current(node.id)
              }
            })

            nodesLayer.addChild(container)
          })
        }
      })

      // =====================================================================
      // BARCO QUE NAVEGA AL SIGUIENTE MÓDULO AL COMPLETAR EL ACTUAL
      // =====================================================================
      const ship = buildCupheadShip(PIXI)
      shipLayer.addChild(ship)

      const activeRoute = seaRoutes.find(r => r.fromIndex === moduleInfo.index) || null
      const activePos = islandPlacement(moduleInfo.index)
      const activeAsset = getIslandAssetForModule(moduleInfo.index)
      const dockedPos = activeRoute
        ? activeRoute.p0
        : { x: activePos.cx + activeAsset.width * 0.42, y: activePos.cy + 145 }

      // Si el módulo actual ya se completó, el barco zarpa desde Isla N hacia Isla N+1
      let shipProgress = 0
      const shouldSailToNext = Boolean(isCurrentCompleted && activeRoute)
      ship.position.set(dockedPos.x, dockedPos.y)

      // Estela de burbujas blancas que deja el barco al navegar
      const wakeParticles: { g: import('pixi.js').Graphics; life: number }[] = []
      let wakeCooldown = 0

      // =====================================================================
      // CAPA 5: NUBES Y AVES INDEPENDIENTES A LO LARGO DEL ARCHIPIÉLAGO
      // =====================================================================
      const totalArchipelagoW = 760 + COURSE_MODULES.length * ISLAND_STRIDE_X
      const clouds: { g: import('pixi.js').Graphics; speed: number }[] = []
      for (let c = 0; c < 18; c++) {
        const cl = new PIXI.Graphics()
        // Nube estilo cartoon Cuphead con contorno tinta cacao y relleno crema
        cl.circle(0, 2, 24)
        cl.circle(24, -8, 30)
        cl.circle(52, 1, 22)
        cl.circle(26, 9, 20)
        cl.fill({ color: 0xfaf3e7, alpha: isNight ? 0.28 : 0.92 })
        cl.stroke({ width: 3, color: 0x2d2a26, alpha: isNight ? 0.35 : 0.72 })
        cl.circle(1, 2, 22)
        cl.circle(24, -7, 28)
        cl.circle(51, 1, 20)
        cl.circle(26, 8, 18)
        cl.fill({ color: 0xfaf3e7, alpha: isNight ? 0.25 : 0.94 })
        cl.position.set(c * 1100 + 80, -35 + (c % 3) * 58)
        skyForegroundLayer.addChild(cl)
        clouds.push({ g: cl, speed: 7 + (c % 3) * 4 })
      }

      const birds: { g: import('pixi.js').Graphics; speed: number; baseY: number; phase: number }[] = []
      for (let b = 0; b < 12; b++) {
        const bg = new PIXI.Graphics()
        bg.moveTo(-7, 2)
        bg.quadraticCurveTo(-3, -4, 0, 0)
        bg.quadraticCurveTo(3, -4, 7, 2)
        bg.stroke({ width: 2, color: isNight ? 0xd9e4f0 : 0x2d2a26, alpha: 0.5, cap: 'round' })
        const by = 45 + (b % 4) * 55
        bg.position.set(220 + b * 1550, by)
        skyForegroundLayer.addChild(bg)
        birds.push({ g: bg, speed: 20 + (b % 3) * 5, baseY: by, phase: b * 1.4 })
      }

      // =====================================================================
      // CÁMARA INTERACTIVA (pan libre por las 10 islas + zoom + enfoque suave)
      // =====================================================================
      let scale = 0.72
      let targetScale = 0.72
      let targetX = 0
      let targetY = 0
      let dragging = false
      let dragStart = { x: 0, y: 0, wx: 0, wy: 0 }

      const focusIsland = (modIdx: number) => {
        const vw = app.screen.width || 1100
        const vh = app.screen.height || 620
        const { cx, cy } = islandPlacement(modIdx)
        const asset = getIslandAssetForModule(modIdx)
        const fit = Math.min(vw / (asset.width * 1.24), vh / (asset.height * 1.18))
        targetScale = Math.max(0.45, Math.min(1.05, fit))
        // Desplazar ligeramente a la izquierda para dejar asomar la siguiente isla en el borde derecho
        const peekOffset = modIdx < COURSE_MODULES.length ? vw * 0.08 : 0
        targetX = vw * 0.5 - peekOffset - cx * targetScale
        targetY = vh * 0.5 - cy * targetScale
        setFocusedIslandIdx(modIdx)
      }

      focusIsland(moduleInfo.index)
      scale = targetScale
      world.scale.set(scale)
      world.position.set(targetX, targetY)

      app.renderer.on('resize', () => {
        drawViewportBackdrop()
      })

      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen
      app.stage.on('pointerdown', e => {
        dragging = true
        dragStart = { x: e.global.x, y: e.global.y, wx: targetX, wy: targetY }
        app.canvas.style.cursor = 'grabbing'
      })
      app.stage.on('pointermove', e => {
        if (!dragging) return
        targetX = dragStart.wx + (e.global.x - dragStart.x)
        targetY = dragStart.wy + (e.global.y - dragStart.y)
      })
      const endDrag = () => {
        dragging = false
        app.canvas.style.cursor = 'grab'
      }
      app.stage.on('pointerup', endDrag)
      app.stage.on('pointerupoutside', endDrag)

      const onWheel = (ev: WheelEvent) => {
        ev.preventDefault()
        const rect = app.canvas.getBoundingClientRect()
        const mx = ev.clientX - rect.left
        const my = ev.clientY - rect.top
        const prev = targetScale
        const next = Math.max(0.24, Math.min(1.65, prev - ev.deltaY * 0.0008))
        const wx = (mx - targetX) / prev
        const wy = (my - targetY) / prev
        targetScale = next
        targetX = mx - wx * next
        targetY = my - wy * next
      }
      app.canvas.addEventListener('wheel', onWheel, { passive: false })

      cameraApiRef.current = {
        zoomBy: (delta: number) => {
          const vw = app.screen.width || 1100
          const vh = app.screen.height || 620
          const prev = targetScale
          const next = Math.max(0.24, Math.min(1.65, prev + delta))
          const wx = (vw / 2 - targetX) / prev
          const wy = (vh / 2 - targetY) / prev
          targetScale = next
          targetX = vw / 2 - wx * next
          targetY = vh / 2 - wy * next
        },
        focusIsland,
        focusNode: (id: string) => {
          const pt = nodePositions.get(id)
          if (!pt) return
          const vw = app.screen.width || 1100
          const vh = app.screen.height || 620
          targetScale = Math.max(targetScale, 0.88)
          targetX = vw / 2 - pt.x * targetScale
          targetY = vh / 2 - pt.y * targetScale
        },
      }

      // Ticker 60 FPS
      let elapsed = 0
      app.ticker.add(ticker => {
        const dt = ticker.deltaMS / 1000
        elapsed += dt

        scale += (targetScale - scale) * Math.min(1, dt * 9)
        world.scale.set(scale)
        world.x += (targetX - world.x) * Math.min(1, dt * 9)
        world.y += (targetY - world.y) * Math.min(1, dt * 9)

        // Olas oceánicas
        oceanWaves.forEach(w => {
          w.g.x = w.baseX + Math.sin(elapsed * 0.9 + w.phase) * w.amp
        })

        // Espuma costera
        const foamS = 1 + Math.sin(elapsed * 1.4) * 0.008
        foams.forEach(f => f.scale.set(foamS))

        // Animación suave de la mascota Axi sosteniendo el nivel actual
        if (axiSpriteRef) {
          axiSpriteRef.sprite.y = axiSpriteRef.baseY + Math.sin(elapsed * 3.0) * 2.4
          axiSpriteRef.sprite.rotation = Math.sin(elapsed * 2.4) * 0.035
        }

        // Pulso del nivel actual
        const pulse = 1 + Math.sin(elapsed * 4.2) * 0.1
        pulseRings.forEach(r => {
          r.scale.set(pulse)
          r.alpha = 0.65 + Math.sin(elapsed * 4.2) * 0.3
        })
        floatArrows.forEach(a => {
          a.obj.y = a.baseY + Math.sin(elapsed * 5.0) * 5
        })

        // Animación del barco:
        // - Si el módulo actual se completó, el barco navega suavemente a la Isla N+1 dejando estela.
        // - Si aún está en curso, se mece suavemente en el muelle listo para zarpar.
        if (shouldSailToNext && activeRoute) {
          if (shipProgress < 1) {
            shipProgress = Math.min(1, shipProgress + dt * 0.22)
            const t = shipProgress
            const sx =
              (1 - t) * (1 - t) * activeRoute.p0.x +
              2 * (1 - t) * t * activeRoute.ctrl.x +
              t * t * activeRoute.p1.x
            const sy =
              (1 - t) * (1 - t) * activeRoute.p0.y +
              2 * (1 - t) * t * activeRoute.ctrl.y +
              t * t * activeRoute.p1.y
            ship.position.set(sx, sy + Math.sin(elapsed * 5) * 3)
            ship.rotation = Math.sin(elapsed * 4) * 0.06

            wakeCooldown -= dt
            if (wakeCooldown <= 0) {
              wakeCooldown = 0.12
              const wp = new PIXI.Graphics()
              wp.circle(0, 0, 5)
              wp.fill({ color: 0xfaf3e7, alpha: 0.65 })
              wp.position.set(sx - 24, sy + 14)
              shipLayer.addChildAt(wp, 0)
              wakeParticles.push({ g: wp, life: 1.0 })
            }
          } else {
            ship.position.set(
              activeRoute.p1.x,
              activeRoute.p1.y + Math.sin(elapsed * 2.4) * 4,
            )
            ship.rotation = Math.sin(elapsed * 1.9) * 0.05
          }
        } else {
          ship.position.set(dockedPos.x, dockedPos.y + Math.sin(elapsed * 2.2) * 4)
          ship.rotation = Math.sin(elapsed * 1.8) * 0.055
        }

        for (let i = wakeParticles.length - 1; i >= 0; i--) {
          const wp = wakeParticles[i]
          wp.life -= dt * 0.75
          wp.g.alpha = Math.max(0, wp.life * 0.6)
          wp.g.scale.set(1 + (1 - wp.life) * 2.2)
          if (wp.life <= 0) {
            wp.g.destroy()
            wakeParticles.splice(i, 1)
          }
        }

        // Nubes y aves
        clouds.forEach(c => {
          c.g.x += c.speed * dt
          if (c.g.x > totalArchipelagoW + 200) c.g.x = -160
        })
        birds.forEach(b => {
          b.g.x += b.speed * dt
          b.g.y = b.baseY + Math.sin(elapsed * 3.2 + b.phase) * 6
          if (b.g.x > totalArchipelagoW + 150) b.g.x = -100
        })
      })

      onReadyRef.current?.()
    }

    init()

    return () => {
      disposed = true
      cameraApiRef.current = null
      if (appInstance) {
        appInstance.destroy(true, { children: true })
        appInstance = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleInfo.code, phase, nodesSignature, statusSignature, isCurrentCompleted])

  const nextModule = COURSE_MODULES.find(m => m.index === moduleInfo.index + 1) ?? null
  const remainingToUnlock = Math.max(0, totalCount - doneCount)

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Lienzo WebGL2 / Canvas de PixiJS v8 a pantalla completa */}
      <div ref={hostRef} className="w-full h-full" />

      {/* Botón flotante superior izquierdo: volver al Mundo de métricas (+ constancia si completó) */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D2A26] bg-[#FAF3E7]/95 hover:bg-[#E9B83E] px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#2D2A26] shadow-[0_3px_0_#2D2A26] transition-colors cursor-pointer"
          >
            <MS name="public" className="!text-[15px]" />
            <span>Mundo</span>
          </button>
        )}
        {isCurrentCompleted && onOpenCert && (
          <button
            type="button"
            onClick={onOpenCert}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D2A26] bg-[#6B8E6A] hover:bg-[#587857] px-3 py-1.5 text-[11px] font-black text-[#FAF3E7] shadow-[0_3px_0_#2D2A26] cursor-pointer"
          >
            <MS name="workspace_premium" className="!text-[15px]" />
            <span>Constancia</span>
          </button>
        )}
      </div>

      {/* Navegador rápido de las 10 islas en la parte superior central */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 hidden lg:flex items-center gap-1 rounded-full border-2 border-[#2D2A26] bg-[#FAF3E7]/92 px-2 py-1 shadow-[0_3px_0_#2D2A26]">
        {COURSE_MODULES.map(m => {
          const st = (allModulesStatus || []).find(x => x.code === m.code)
          const unlocked = st ? st.unlocked : m.index <= moduleInfo.index
          const isCurrent = m.code === moduleInfo.code
          const isFocused = focusedIslandIdx === m.index
          return (
            <button
              key={m.code}
              type="button"
              onClick={() => cameraApiRef.current?.focusIsland(m.index)}
              className={`px-2 py-0.5 rounded-full text-[10.5px] font-black transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-[#E76F51] text-[#FAF3E7]'
                  : isFocused
                    ? 'bg-[#2D2A26] text-[#FAF3E7]'
                    : unlocked
                      ? 'bg-[#E9B83E]/30 text-[#2D2A26] hover:bg-[#E9B83E]/60'
                      : 'bg-[#DCDCDC] text-[#666] hover:bg-[#C8C8C8]'
              }`}
              title={`Isla ${ROMAN[m.index - 1]} · ${m.level} (${unlocked ? 'Desbloqueada' : 'Bloqueada · Vista gris'})`}
            >
              {ROMAN[m.index - 1]}
            </button>
          )
        })}
      </div>

      {/* Botón superior derecho: Zarpar al siguiente módulo (si ya terminó) o Vista gris */}
      <div className="absolute top-3 right-14 z-10 flex items-center gap-2">
        {nextModule && isCurrentCompleted ? (
          <button
            type="button"
            onClick={() => onSelectModule?.(nextModule.code)}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D2A26] bg-[#E9B83E] hover:bg-[#E76F51] hover:text-white px-3.5 py-1.5 text-[11px] font-black text-[#2D2A26] shadow-[0_3px_0_#2D2A26] transition-colors cursor-pointer"
          >
            <MS name="sailing" className="!text-[15px]" />
            <span>Zarpar a Isla {ROMAN[nextModule.index - 1]} ({nextModule.level})</span>
          </button>
        ) : nextModule ? (
          <button
            type="button"
            onClick={() => setPreviewModule(nextModule)}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#4A4A4A] bg-[#E8E8E8]/95 hover:bg-[#DCDCDC] px-3 py-1.5 text-[11px] font-extrabold text-[#2D2A26] shadow-[0_3px_0_#4A4A4A] transition-transform active:translate-y-[1px] cursor-pointer"
            title="Ver en gris qué viene en el siguiente nivel de inglés"
          >
            <MS name="visibility" className="!text-[15px] text-[#555]" />
            <span>Siguiente: {nextModule.level} (Vista gris)</span>
          </button>
        ) : null}
      </div>

      {/* Tooltip flotante al pasar sobre un nivel o sobre otra isla del archipiélago */}
      {(hoveredNode || hoveredIsland) && !previewModule && (
        <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 z-20">
          {hoveredNode ? (
            <div className="rounded-2xl border-2 border-[#2D2A26] bg-[#FAF3E7]/95 px-4 py-2 shadow-[0_4px_0_#2D2A26] text-center min-w-[210px]">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#E76F51]">
                Nivel {hoveredNode.index + 1} ·{' '}
                {BLOCK_LABELS[hoveredNode.node.block || 'grammar'] || 'Lección'}
              </p>
              <p className="text-xs font-extrabold text-[#2D2A26] mt-0.5">
                {hoveredNode.node.title}
              </p>
              <p className="text-[10.5px] font-semibold text-[#5C5852] mt-0.5">
                {hoveredNode.node.state === 'done'
                  ? '✓ Completado · Clic para repasar'
                  : hoveredNode.node.state === 'current'
                    ? '★ Nivel en curso · Clic para iniciar'
                    : '🔒 Bloqueado · Completa el nivel anterior'}
              </p>
            </div>
          ) : hoveredIsland ? (
            <div
              className={`rounded-2xl border-2 px-4 py-2 text-center ${
                hoveredIsland.unlocked
                  ? 'border-[#2D2A26] bg-[#FAF3E7]/95 shadow-[0_4px_0_#2D2A26]'
                  : 'border-[#4A4A4A] bg-[#ECECEC]/95 shadow-[0_4px_0_#4A4A4A] grayscale'
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#555]">
                {hoveredIsland.unlocked
                  ? `Isla ${ROMAN[hoveredIsland.mod.index - 1]} · ${hoveredIsland.mod.level}`
                  : `🔒 Isla ${ROMAN[hoveredIsland.mod.index - 1]} · ${hoveredIsland.mod.level}`}
              </p>
              <p className="text-xs font-extrabold text-[#222] mt-0.5">
                {hoveredIsland.mod.title}
              </p>
              <p className="text-[10.5px] font-semibold text-[#555] mt-0.5">
                {hoveredIsland.unlocked
                  ? 'Clic para viajar a esta isla'
                  : 'Clic para abrir la vista previa en gris'}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Controles de cámara (+ / − / Centrar isla actual) */}
      <div className="absolute top-16 right-3 z-10 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => cameraApiRef.current?.zoomBy(0.18)}
          className="w-8 h-8 rounded-lg border-2 border-[#2D2A26] bg-[#FAF3E7]/95 hover:bg-[#E9B83E] text-[#2D2A26] font-black text-base shadow-[0_2px_0_#2D2A26] flex items-center justify-center cursor-pointer"
          aria-label="Acercar mapa"
          title="Acercar"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => cameraApiRef.current?.zoomBy(-0.18)}
          className="w-8 h-8 rounded-lg border-2 border-[#2D2A26] bg-[#FAF3E7]/95 hover:bg-[#E9B83E] text-[#2D2A26] font-black text-base shadow-[0_2px_0_#2D2A26] flex items-center justify-center cursor-pointer"
          aria-label="Alejar mapa"
          title="Alejar"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => cameraApiRef.current?.focusIsland(moduleInfo.index)}
          className="w-8 h-8 rounded-lg border-2 border-[#2D2A26] bg-[#FAF3E7]/95 hover:bg-[#6B8E6A] hover:text-white text-[#2D2A26] shadow-[0_2px_0_#2D2A26] flex items-center justify-center cursor-pointer"
          aria-label="Centrar en mi isla actual"
          title="Centrar en mi isla"
        >
          <MS name="fit_screen" className="!text-[16px]" />
        </button>
      </div>

      {/* Modal de Vista Previa en Escala de Grises para cualquier módulo futuro */}
      {previewModule && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onClick={() => setPreviewModule(null)}
        >
          <div
            className="w-full max-w-xl max-h-[88%] overflow-y-auto rounded-2xl border-2 border-[#4A4A4A] bg-[#F0F0F0] text-[#2E2E2E] shadow-[0_10px_0_#3A3A3A] p-5 grayscale"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b-2 border-dashed border-[#9A9A9A] pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#5A5A5A] bg-[#DCDCDC] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#3A3A3A]">
                  <MS name="lock" className="!text-[12px]" />
                  <span>Vista previa en gris · Isla {ROMAN[previewModule.index - 1]}</span>
                </div>
                <h3 className="mt-1.5 text-lg font-black text-[#222]">
                  Módulo {previewModule.index} · {previewModule.level} — {previewModule.title}
                </h3>
                <p className="text-xs text-[#555] mt-0.5">
                  {previewModule.purpose} · {previewModule.hours} horas estimadas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModule(null)}
                className="rounded-lg border-2 border-[#4A4A4A] bg-white px-2.5 py-1 text-xs font-extrabold text-[#222] hover:bg-[#E2E2E2] cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-[#B0B0B0] bg-[#E5E5E5] p-3 text-xs text-[#3A3A3A]">
              <div className="flex items-center justify-between font-bold">
                <span>Progreso en Módulo {moduleInfo.index} ({moduleInfo.level})</span>
                <span>
                  {doneCount} / {totalCount} niveles
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#C8C8C8]">
                <div
                  className="h-full bg-[#525252]"
                  style={{
                    width: `${totalCount ? Math.round((doneCount / totalCount) * 100) : 0}%`,
                  }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-[#555]">
                {remainingToUnlock > 0
                  ? `Completa los ${remainingToUnlock} nivel(es) restantes y la evaluación final para que el barco zarpe hacia la siguiente isla.`
                  : 'Completa la evaluación final para que el barco zarpe y desbloquee el siguiente módulo.'}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#555] mb-2">
                Qué verás en {previewModule.level} ({previewModule.lessons.length} niveles)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {previewModule.lessons.map((lesson, idx) => (
                  <div
                    key={lesson.key}
                    className="flex items-start gap-2 rounded-xl border border-[#BEBEBE] bg-[#E8E8E8]/80 p-2.5 opacity-85"
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#666] bg-[#D4D4D4] text-[10px] font-black text-[#333]">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#2A2A2A] leading-tight">
                        {lesson.title}
                      </p>
                      <p className="text-[10.5px] font-semibold text-[#5A5A5A] mt-0.5">
                        {BLOCK_LABELS[lesson.block] || lesson.block} · {lesson.hours} h
                      </p>
                      <p className="text-[10.5px] text-[#666] mt-0.5 line-clamp-2">
                        {lesson.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
