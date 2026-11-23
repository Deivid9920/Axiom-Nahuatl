'use client'

/*
 * ===================== MAPA 2D POR CAPAS ESTILO CUPHEAD (PixiJS v8) =====================
 * Arquitectura desacoplada en capas independientes dentro de PixiJS v8 (sin contornos
 * cuadrados y sin personaje):
 *   - Capa 0 (skyOceanLayer): Cielo y océano infinito en acuarela con olas animadas y sol/luna.
 *   - Capa 1 (ambientLayer): Halos de espuma en la costa, reflejos y barquitos en el mar.
 *   - Capa 2 (mainIslandLayer): Isla principal recortada (PNG transparente sin bordes) con
 *     filtro de acuarela único por módulo.
 *   - Capa 3 (nextIslandLayer): Puente de madera + isla del SIGUIENTE nivel (un diseño distinto
 *     al actual) renderizada en escala de grises real (ColorMatrixFilter.desaturate) y niebla.
 *   - Capa 4 (nodesLayer): Camino punteado y medallones numerados interactivos sobre la isla.
 *   - Capa 5 (skyForegroundLayer): Nubes de acuarela y aves independientes con paralaje suave.
 */

import { useEffect, useRef, useState } from 'react'
import {
  getIslandAssetForModule,
  getIslandTheme2D,
  type IslandAssetSpec,
  type IslandTheme2D,
} from '@/lib/world/overworld2d-themes'
import { BLOCK_LABELS, type CourseModule } from '@/lib/books/modules'
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

interface Overworld2DProps {
  moduleInfo: CourseModule
  nextModule?: CourseModule | null
  phase: ScenePhase
  nodes: Overworld2DNode[]
  focusId?: string | null
  doneCount: number
  totalCount: number
  onNodeSelect: (id: string) => void
  onReady?: () => void
}

function sampleRoadPoints(
  asset: IslandAssetSpec,
  count: number,
  flipX?: boolean,
): { x: number; y: number }[] {
  const waypoints = asset.roadWaypoints
  if (count <= 0) return []
  const mapX = (nx: number) => (flipX ? 1 - nx : nx) * asset.width
  if (count === 1) {
    return [{ x: mapX(waypoints[0][0]), y: waypoints[0][1] * asset.height }]
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
    out.push({ x: mapX(nx), y: ny * asset.height })
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

export function Overworld2D({
  moduleInfo,
  nextModule,
  phase,
  nodes,
  focusId,
  doneCount,
  totalCount,
  onNodeSelect,
  onReady,
}: Overworld2DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const cameraApiRef = useRef<{
    zoomBy: (delta: number) => void
    resetView: () => void
    focusNode: (id: string) => void
  } | null>(null)

  const onNodeSelectRef = useRef(onNodeSelect)
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect
    onReadyRef.current = onReady
  }, [onNodeSelect, onReady])

  const [hoveredNode, setHoveredNode] = useState<{
    index: number
    node: Overworld2DNode
  } | null>(null)
  const [hoveredNext, setHoveredNext] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  const theme: IslandTheme2D = getIslandTheme2D(moduleInfo.index)
  const currentAsset = getIslandAssetForModule(moduleInfo.index)
  const nextAsset = nextModule ? getIslandAssetForModule(nextModule.index) : null
  const nextTheme = nextModule ? getIslandTheme2D(nextModule.index) : null
  const nodesSignature = nodes.map(n => `${n.id}:${n.state}`).join('|')

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
      // CAPA 0: CIELO Y OCÉANO INFINITO (independiente de la isla, sin bordes)
      // =====================================================================
      const skyOceanLayer = new PIXI.Container()
      app.stage.addChild(skyOceanLayer)

      const skyBg = new PIXI.Graphics()
      const orbG = new PIXI.Graphics()
      const starsG = new PIXI.Graphics()
      skyOceanLayer.addChild(skyBg, starsG, orbG)

      const drawViewportBackdrop = () => {
        const vw = app.screen.width || 960
        const vh = app.screen.height || 520

        skyBg.clear()
        const grad = new PIXI.FillGradient(0, 0, 0, vh)
        grad.addColorStop(0, skyTopCol)
        grad.addColorStop(0.42, oceanMidCol)
        grad.addColorStop(1, oceanBotCol)
        skyBg.rect(0, 0, vw, vh)
        skyBg.fill(grad)

        // Sol / luna suave en el horizonte
        orbG.clear()
        const orbX = vw * 0.84
        const orbY = vh * 0.16
        const orbColor = isNight ? 0xf2ebd9 : isDusk ? 0xffb36b : 0xffe9a6
        orbG.circle(orbX, orbY, 54)
        orbG.fill({ color: orbColor, alpha: isNight ? 0.12 : 0.22 })
        orbG.circle(orbX, orbY, 26)
        orbG.fill({ color: orbColor, alpha: isNight ? 0.35 : 0.45 })

        // Estrellas suaves de noche
        starsG.clear()
        if (isNight) {
          for (let s = 0; s < 36; s++) {
            const sx = ((s * 173 + 47) % 1000) / 1000 * vw
            const sy = ((s * 97 + 23) % 1000) / 1000 * (vh * 0.48)
            starsG.circle(sx, sy, 1.2 + (s % 3) * 0.5)
            starsG.fill({ color: 0xfaf3e7, alpha: 0.35 + (s % 4) * 0.12 })
          }
        }
      }
      drawViewportBackdrop()

      // Olas suaves en el océano infinito (capa separada)
      const oceanWaves: { g: import('pixi.js').Graphics; baseX: number; phase: number; amp: number }[] = []
      const wavesLayer = new PIXI.Container()
      skyOceanLayer.addChild(wavesLayer)
      for (let i = 0; i < 22; i++) {
        const wg = new PIXI.Graphics()
        const wx = ((i * 191 + 40) % 1300)
        const wy = ((i * 117 + 80) % 680)
        wg.moveTo(0, 0)
        wg.quadraticCurveTo(14, -5, 28, 0)
        wg.quadraticCurveTo(42, -5, 56, 0)
        wg.stroke({
          width: 2.2,
          color: theme.waveColor,
          alpha: isNight ? 0.14 : 0.32,
          cap: 'round',
        })
        wg.position.set(wx, wy)
        wavesLayer.addChild(wg)
        oceanWaves.push({ g: wg, baseX: wx, phase: i * 0.7, amp: 8 + (i % 3) * 4 })
      }

      // =====================================================================
      // CONTENEDOR DEL MUNDO (cámara pan + zoom independiente del fondo)
      // =====================================================================
      const world = new PIXI.Container()
      app.stage.addChild(world)

      // Cargar ambos recortes PNG transparentes en paralelo (isla actual + isla siguiente)
      const [mainImg, nextImg] = await Promise.all([
        loadHtmlImage(currentAsset.src),
        nextAsset ? loadHtmlImage(nextAsset.src) : Promise.resolve(null),
      ])
      if (disposed) return

      const mainW = currentAsset.width
      const mainH = currentAsset.height
      const nextScale = 0.56
      const nextW = nextAsset ? nextAsset.width * nextScale : 0
      const nextH = nextAsset ? nextAsset.height * nextScale : 0
      const nextCenterX = mainW + 215
      const nextCenterY = mainH * 0.54

      // =====================================================================
      // CAPA 1: ELEMENTOS AMBIENTALES EN EL MAR (espuma costera y barquitos)
      // =====================================================================
      const ambientLayer = new PIXI.Container()
      world.addChild(ambientLayer)

      // Halo suave de espuma/oleaje alrededor de la isla principal
      const foamMain = new PIXI.Graphics()
      foamMain.ellipse(mainW * 0.5, mainH * 0.54, mainW * 0.44, mainH * 0.41)
      foamMain.fill({ color: theme.waveColor, alpha: isNight ? 0.08 : 0.16 })
      foamMain.ellipse(mainW * 0.5, mainH * 0.54, mainW * 0.47, mainH * 0.44)
      foamMain.stroke({ width: 2.5, color: theme.waveColor, alpha: isNight ? 0.12 : 0.25 })
      ambientLayer.addChild(foamMain)

      // Barquitos vintage independientes flotando en el mar abierto
      const boats: { g: import('pixi.js').Graphics; baseY: number; phase: number }[] = []
      const boatCoords: [number, number][] = [
        [mainW * 0.09, mainH * 0.34],
        [mainW * 0.87, mainH * 0.20],
        [mainW * 0.15, mainH * 0.88],
      ]
      boatCoords.forEach(([bx, by], idx) => {
        const b = new PIXI.Graphics()
        // Casco
        b.poly([-14, 0, 14, 0, 9, 7, -9, 7])
        b.fill(0x8c5a3c)
        b.stroke({ width: 2, color: 0x2d2a26 })
        // Vela crema
        b.poly([0, -2, 0, -20, 12, -4])
        b.fill(0xfaf3e7)
        b.stroke({ width: 1.8, color: 0x2d2a26 })
        b.position.set(bx, by)
        ambientLayer.addChild(b)
        boats.push({ g: b, baseY: by, phase: idx * 2.1 })
      })

      // =====================================================================
      // CAPA 2: ISLA PRINCIPAL RECORTADA (PNG transparente, cero cuadro)
      // =====================================================================
      const mainIslandLayer = new PIXI.Container()
      world.addChild(mainIslandLayer)

      if (mainImg) {
        const tex = PIXI.Texture.from(mainImg)
        const sprite = new PIXI.Sprite(tex)
        sprite.anchor.set(0.5)
        sprite.position.set(mainW * 0.5, mainH * 0.5)
        sprite.width = mainW
        sprite.height = mainH
        if (theme.flipX) sprite.scale.x = -Math.abs(sprite.scale.x)

        const cm = new PIXI.ColorMatrixFilter()
        if (theme.hueShift !== 0) cm.hue(theme.hueShift, true)
        if (theme.saturation !== 0) cm.saturate(theme.saturation, true)
        const phaseBrightness = isNight ? 0.86 : isDusk ? 0.94 : theme.brightness
        if (phaseBrightness !== 1) cm.brightness(phaseBrightness, true)
        sprite.filters = [cm]
        mainIslandLayer.addChild(sprite)
      }

      // =====================================================================
      // CAPA 3: PUENTE + ISLA VECINA DIFERENTE EN ESCALA DE GRISES
      // =====================================================================
      const nextIslandLayer = new PIXI.Container()
      world.addChild(nextIslandLayer)

      if (nextModule && nextAsset) {
        const anchorX = (theme.flipX ? 1 - currentAsset.bridgeAnchor[0] : currentAsset.bridgeAnchor[0]) * mainW
        const anchorY = currentAsset.bridgeAnchor[1] * mainH
        const bridgeStartX = Math.max(mainW * 0.82, anchorX)
        const bridgeStartY = anchorY
        const bridgeEndX = nextCenterX - nextW * 0.34
        const bridgeEndY = nextCenterY + 26

        // Puente arqueado de madera conectando ambas islas en el océano
        const bridge = new PIXI.Graphics()
        const midX = (bridgeStartX + bridgeEndX) * 0.5
        const midY = (bridgeStartY + bridgeEndY) * 0.5 - 18
        bridge.moveTo(bridgeStartX, bridgeStartY)
        bridge.quadraticCurveTo(midX, midY, bridgeEndX, bridgeEndY)
        bridge.stroke({ width: 28, color: 0x2d2a26, cap: 'round' })
        bridge.moveTo(bridgeStartX, bridgeStartY)
        bridge.quadraticCurveTo(midX, midY, bridgeEndX, bridgeEndY)
        bridge.stroke({ width: 21, color: 0xa69886, cap: 'round' })

        // Barandal / barrera bloqueada al centro del puente
        bridge.circle(midX, midY, 15)
        bridge.fill(0x525252)
        bridge.stroke({ width: 3, color: 0xfaf3e7 })
        nextIslandLayer.addChild(bridge)

        const lockIcon = new PIXI.Text({
          text: '🔒',
          style: { fontSize: 13 },
        })
        lockIcon.anchor.set(0.5)
        lockIcon.position.set(midX, midY)
        nextIslandLayer.addChild(lockIcon)

        // Isla vecina recortada (PNG transparente DIFERENTE a la actual) en gris real
        const grayWrap = new PIXI.Container()
        grayWrap.position.set(nextCenterX, nextCenterY)
        grayWrap.eventMode = 'static'
        grayWrap.cursor = 'pointer'

        // Niebla circular suave bajo la isla gris (sin bordes cuadrados)
        const mistHalo = new PIXI.Graphics()
        mistHalo.ellipse(0, 12, nextW * 0.48, nextH * 0.44)
        mistHalo.fill({ color: 0xe6e6e6, alpha: 0.18 })
        grayWrap.addChild(mistHalo)

        if (nextImg) {
          const nextTex = PIXI.Texture.from(nextImg)
          const nextSprite = new PIXI.Sprite(nextTex)
          nextSprite.anchor.set(0.5)
          nextSprite.width = nextW
          nextSprite.height = nextH
          if (nextTheme?.flipX) nextSprite.scale.x = -Math.abs(nextSprite.scale.x)

          const grayFilter = new PIXI.ColorMatrixFilter()
          grayFilter.desaturate()
          grayFilter.brightness(0.95, true)
          nextSprite.filters = [grayFilter]
          nextSprite.alpha = 0.86
          grayWrap.addChild(nextSprite)
        }

        // Placa central estilo sello bloqueado
        const plate = new PIXI.Graphics()
        plate.roundRect(-126, -34, 252, 68, 16)
        plate.fill({ color: 0x383838, alpha: 0.9 })
        plate.stroke({ width: 2.8, color: 0xf0f0f0 })
        grayWrap.addChild(plate)

        const nextTitle = new PIXI.Text({
          text: `🔒 PRÓXIMO · ${nextModule.level}`,
          style: {
            fontFamily: 'Georgia, serif',
            fontSize: 15,
            fontWeight: 'bold',
            fill: '#F5F5F5',
          },
        })
        nextTitle.anchor.set(0.5)
        nextTitle.position.set(0, -11)
        grayWrap.addChild(nextTitle)

        const nextSub = new PIXI.Text({
          text: `${nextModule.title}\nClic para vista previa`,
          style: {
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 11.5,
            fill: '#DDDDDD',
            align: 'center',
          },
        })
        nextSub.anchor.set(0.5)
        nextSub.position.set(0, 14)
        grayWrap.addChild(nextSub)

        let nextDownPos = { x: 0, y: 0 }
        grayWrap.on('pointerover', () => {
          grayWrap.scale.set(1.04)
          setHoveredNext(true)
        })
        grayWrap.on('pointerout', () => {
          grayWrap.scale.set(1.0)
          setHoveredNext(false)
        })
        grayWrap.on('pointerdown', e => {
          nextDownPos = { x: e.global.x, y: e.global.y }
        })
        grayWrap.on('pointerup', e => {
          if (Math.hypot(e.global.x - nextDownPos.x, e.global.y - nextDownPos.y) < 10) {
            setPreviewOpen(true)
          }
        })

        nextIslandLayer.addChild(grayWrap)
      }

      // =====================================================================
      // CAPA 4: CAMINO PUNTEADO Y MEDALLONES DE NIVEL (SIN PERSONAJE)
      // =====================================================================
      const nodesLayer = new PIXI.Container()
      world.addChild(nodesLayer)

      const points = sampleRoadPoints(currentAsset, nodes.length, theme.flipX)
      const pathG = new PIXI.Graphics()
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i]
        const b = points[i + 1]
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
            color: doneSeg ? 0xe9b83e : theme.pathColor,
            alpha: doneSeg ? 0.95 : 0.85,
            cap: 'round',
          })
        }
      }
      nodesLayer.addChild(pathG)

      const pulseRings: import('pixi.js').Graphics[] = []
      const floatArrows: { obj: import('pixi.js').Graphics; baseY: number }[] = []
      const nodePositions = new Map<string, { x: number; y: number }>()

      nodes.forEach((node, idx) => {
        const pt = points[idx]
        if (!pt) return
        nodePositions.set(node.id, pt)

        const isDone = node.state === 'done'
        const isCurrent = node.state === 'current'
        const isLocked = node.state === 'locked'
        const isFinal = Boolean(node.final || node.block === 'final')
        const radius = isFinal ? 28 : 22

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
              : theme.accentNum
            : 0x8f8c86
        medal.circle(0, 0, radius - 2)
        medal.fill(fillCol)
        medal.stroke({ width: 2, color: 0x2d2a26, alpha: 0.5 })
        container.addChild(medal)

        const symbol = isDone
          ? '✓'
          : isLocked
            ? '🔒'
            : isFinal
              ? '★'
              : String(idx + 1).padStart(2, '0')

        const text = new PIXI.Text({
          text: symbol,
          style: {
            fontFamily: 'Georgia, serif',
            fontSize: isLocked ? 13 : isFinal ? 18 : 14,
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

      // =====================================================================
      // CAPA 5: NUBES Y AVES INDEPENDIENTES CON PARALAJE SUAVE
      // =====================================================================
      const skyForegroundLayer = new PIXI.Container()
      world.addChild(skyForegroundLayer)

      const totalSpanW = nextModule ? mainW + nextW + 260 : mainW
      const clouds: { g: import('pixi.js').Graphics; speed: number }[] = []
      for (let c = 0; c < 6; c++) {
        const cl = new PIXI.Graphics()
        cl.circle(0, 0, 28)
        cl.circle(26, -9, 34)
        cl.circle(56, 0, 25)
        cl.circle(26, 8, 22)
        cl.fill({ color: 0xfaf3e7, alpha: isNight ? 0.14 : 0.44 })
        cl.position.set(80 + c * 340, 42 + (c % 2) * 44)
        skyForegroundLayer.addChild(cl)
        clouds.push({ g: cl, speed: 6 + (c % 3) * 3.5 })
      }

      const birds: { g: import('pixi.js').Graphics; speed: number; baseY: number; phase: number }[] = []
      for (let b = 0; b < 4; b++) {
        const bg = new PIXI.Graphics()
        bg.moveTo(-7, 2)
        bg.quadraticCurveTo(-3, -4, 0, 0)
        bg.quadraticCurveTo(3, -4, 7, 2)
        bg.stroke({ width: 2, color: isNight ? 0xd9e4f0 : 0x2d2a26, alpha: 0.55, cap: 'round' })
        const by = 95 + b * 48
        bg.position.set(220 + b * 410, by)
        skyForegroundLayer.addChild(bg)
        birds.push({ g: bg, speed: 18 + b * 4, baseY: by, phase: b * 1.4 })
      }

      // =====================================================================
      // CÁMARA INTERACTIVA (pan + zoom suave)
      // =====================================================================
      let scale = 1
      let targetScale = 1
      let targetX = 0
      let targetY = 0
      let dragging = false
      let dragStart = { x: 0, y: 0, wx: 0, wy: 0 }

      const computeFit = () => {
        const vw = app.screen.width || 960
        const vh = app.screen.height || 520
        const fit = Math.min(vw / (mainW + (nextModule ? 280 : 40)), vh / mainH)
        return Math.max(0.45, Math.min(1.22, fit * 1.03))
      }

      const resetView = () => {
        const vw = app.screen.width || 960
        const vh = app.screen.height || 520
        const fit = computeFit()
        targetScale = fit
        targetX = (vw - (nextModule ? mainW + 210 : mainW) * fit) * 0.5
        targetY = (vh - mainH * fit) * 0.5
      }

      resetView()
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
        const next = Math.max(0.42, Math.min(1.75, prev - ev.deltaY * 0.0009))
        const wx = (mx - targetX) / prev
        const wy = (my - targetY) / prev
        targetScale = next
        targetX = mx - wx * next
        targetY = my - wy * next
      }
      app.canvas.addEventListener('wheel', onWheel, { passive: false })

      cameraApiRef.current = {
        zoomBy: (delta: number) => {
          const vw = app.screen.width || 960
          const vh = app.screen.height || 520
          const prev = targetScale
          const next = Math.max(0.42, Math.min(1.75, prev + delta))
          const wx = (vw / 2 - targetX) / prev
          const wy = (vh / 2 - targetY) / prev
          targetScale = next
          targetX = vw / 2 - wx * next
          targetY = vh / 2 - wy * next
        },
        resetView,
        focusNode: (id: string) => {
          const pt = nodePositions.get(id)
          if (!pt) return
          const vw = app.screen.width || 960
          const vh = app.screen.height || 520
          targetScale = Math.max(targetScale, 0.9)
          targetX = vw / 2 - pt.x * targetScale
          targetY = vh / 2 - pt.y * targetScale
        },
      }

      // Ticker 60 FPS
      let elapsed = 0
      app.ticker.add(ticker => {
        const dt = ticker.deltaMS / 1000
        elapsed += dt

        scale += (targetScale - scale) * Math.min(1, dt * 10)
        world.scale.set(scale)
        world.x += (targetX - world.x) * Math.min(1, dt * 10)
        world.y += (targetY - world.y) * Math.min(1, dt * 10)

        // Olas oceánicas independientes
        oceanWaves.forEach(w => {
          w.g.x = w.baseX + Math.sin(elapsed * 0.9 + w.phase) * w.amp
        })

        // Espuma suave latiendo alrededor de la isla
        foamMain.scale.set(1 + Math.sin(elapsed * 1.4) * 0.008)

        // Barquitos meciéndose
        boats.forEach(b => {
          b.g.y = b.baseY + Math.sin(elapsed * 2.1 + b.phase) * 3.5
          b.g.rotation = Math.sin(elapsed * 1.6 + b.phase) * 0.07
        })

        // Pulso del nivel actual
        const pulse = 1 + Math.sin(elapsed * 4.2) * 0.1
        pulseRings.forEach(r => {
          r.scale.set(pulse)
          r.alpha = 0.65 + Math.sin(elapsed * 4.2) * 0.3
        })
        floatArrows.forEach(a => {
          a.obj.y = a.baseY + Math.sin(elapsed * 5.0) * 5
        })

        // Nubes y aves en capa superior
        clouds.forEach(c => {
          c.g.x += c.speed * dt
          if (c.g.x > totalSpanW + 160) c.g.x = -140
        })
        birds.forEach(b => {
          b.g.x += b.speed * dt
          b.g.y = b.baseY + Math.sin(elapsed * 3.2 + b.phase) * 6
          if (b.g.x > totalSpanW + 120) b.g.x = -80
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
  }, [moduleInfo.code, nextModule?.code, phase, nodesSignature])

  const remainingToUnlock = Math.max(0, totalCount - doneCount)

  return (
    <div className="relative w-full h-full overflow-hidden rounded-[22px] select-none">
      {/* Lienzo WebGL2 / Canvas de PixiJS v8 */}
      <div ref={hostRef} className="w-full h-full" />

      {/* Placa superior central: nombre de la isla (libre de solapamiento con la placa izquierda) */}
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-10 hidden md:flex flex-col items-center gap-1">
        <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#2D2A26] bg-[#FAF3E7]/95 px-3.5 py-1 shadow-[0_3px_0_#2D2A26]">
          <span className="text-[10.5px] font-black uppercase tracking-[0.14em] text-[#E76F51]">
            Mapa 2D
          </span>
          <span className="text-xs font-extrabold text-[#2D2A26] whitespace-nowrap">
            {theme.islandName}
          </span>
        </div>
      </div>

      {/* Acceso rápido superior derecho a la vista previa en gris del siguiente nivel */}
      <div className="absolute top-3 right-14 z-10 flex items-center gap-2">
        {nextModule && (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#4A4A4A] bg-[#E8E8E8]/95 hover:bg-[#DCDCDC] px-3 py-1.5 text-[11px] font-extrabold text-[#2D2A26] shadow-[0_3px_0_#4A4A4A] transition-transform active:translate-y-[1px] cursor-pointer"
            title="Ver en gris qué viene en el siguiente nivel de inglés"
          >
            <MS name="visibility" className="!text-[15px] text-[#555]" />
            <span>Siguiente: {nextModule.level} (Vista gris)</span>
          </button>
        )}
      </div>

      {/* Tooltip flotante al pasar sobre un nivel o la isla gris */}
      {(hoveredNode || (hoveredNext && nextModule)) && !previewOpen && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-20">
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
                    ? '★ Disponible ahora · Clic para iniciar'
                    : '🔒 Bloqueado · Completa el nivel anterior'}
              </p>
            </div>
          ) : nextModule ? (
            <div className="rounded-2xl border-2 border-[#4A4A4A] bg-[#ECECEC]/95 px-4 py-2 shadow-[0_4px_0_#4A4A4A] text-center grayscale">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#444]">
                🔒 Próximo nivel · {nextModule.level}
              </p>
              <p className="text-xs font-extrabold text-[#222] mt-0.5">{nextModule.title}</p>
              <p className="text-[10.5px] font-semibold text-[#555] mt-0.5">
                Clic para abrir la vista previa en gris
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* Controles de cámara (+ / − / Ajustar vista) en lateral derecho despejado */}
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
          onClick={() => cameraApiRef.current?.resetView()}
          className="w-8 h-8 rounded-lg border-2 border-[#2D2A26] bg-[#FAF3E7]/95 hover:bg-[#6B8E6A] hover:text-white text-[#2D2A26] shadow-[0_2px_0_#2D2A26] flex items-center justify-center cursor-pointer"
          aria-label="Ajustar vista de la isla"
          title="Ver isla completa"
        >
          <MS name="fit_screen" className="!text-[16px]" />
        </button>
      </div>

      {/* Modal de Vista Previa en Escala de Grises del Siguiente Nivel */}
      {previewOpen && nextModule && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[88%] overflow-y-auto rounded-2xl border-2 border-[#4A4A4A] bg-[#F0F0F0] text-[#2E2E2E] shadow-[0_10px_0_#3A3A3A] p-5 grayscale"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b-2 border-dashed border-[#9A9A9A] pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#5A5A5A] bg-[#DCDCDC] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#3A3A3A]">
                  <MS name="lock" className="!text-[12px]" />
                  <span>Vista previa en gris · Próximo nivel</span>
                </div>
                <h3 className="mt-1.5 text-lg font-black text-[#222]">
                  Módulo {nextModule.index} · {nextModule.level} — {nextModule.title}
                </h3>
                <p className="text-xs text-[#555] mt-0.5">
                  {nextModule.purpose} · {nextModule.hours} horas estimadas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
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
                  ? `Te faltan ${remainingToUnlock} nivel(es) y la evaluación final del módulo actual para desbloquear esta isla.`
                  : 'Completa la evaluación final del módulo actual para desbloquear este nivel.'}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#555] mb-2">
                Qué verás en {nextModule.level} ({nextModule.lessons.length} niveles)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {nextModule.lessons.map((lesson, idx) => (
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
