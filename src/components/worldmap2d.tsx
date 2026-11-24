'use client'

/*
 * ===================== GLOBO 2D GIRATORIO "TU RUTA MÉXICO → YORK" (PixiJS v8) =====================
 * Planeta 2D estilo caricatura/acuarela con proyección esférica real (lat, lon) que
 * PUEDES GIRAR 360° arrastrando con el ratón o el dedo, igual que un globo 3D:
 *   - Continentes pintados (México/América, Europa/York, África, Asia, polos) proyectados
 *     dinámicamente sobre la esfera al girar.
 *   - Las 10 paradas de «Tu ruta México → York» repartidas sobre la esfera como mini-islas 2D
 *     (se ocultan suavemente detrás del horizonte y crecen al pasar al frente).
 *   - Nubes estilo cartoon con contorno de tinta cacao flotando alrededor del planeta.
 *   - Al hacer clic en una isla desbloqueada, dispara la transición de Axi en liana
 *     abriendo las nubes hacia el mapa completo de islas.
 */

import { useEffect, useRef, useState } from 'react'
import {
  getIslandAssetForModule,
  getIslandTheme2D,
} from '@/lib/world/overworld2d-themes'
import { AXI_MASCOT_DATA_URI } from '@/lib/world/axi-mascot-svg'
import { BLOCK_LABELS, COURSE_MODULES, type CourseModule } from '@/lib/books/modules'
import { MS } from '@/components/icons'

export interface WorldCardStatus {
  code: string
  index: number
  level: string
  title: string
  purpose: string
  hours: number
  done: number
  total: number
  pct: number
  unlocked: boolean
  lockReason: string | null
  state: 'available' | 'in_progress' | 'completed' | 'locked'
}

interface WorldMap2DProps {
  cards: WorldCardStatus[]
  todayMinutes: number
  targetMinutes: number
  dueReviews: number
  onOpenModule: (code: string) => void
  onOpenRepaso: () => void
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']
const DEG = Math.PI / 180

const ROUTE_STOP_NAMES = [
  'Casa · México',
  'Maletas y despedida',
  'Vuelo · Atlántico',
  'Llegada · London',
  'Tren · North Yorkshire',
  'York · Primer día',
  'The Shambles · Trabajo',
  'Hogar · Vecindad',
  'Museos · Historia viva',
  'York Minster · Meta B1',
]

// Coordenadas esféricas (lat, lon en grados) bien repartidas por todo el planeta 360°
// Cada parada tiene su propia masa verde de isla con costa arenosa rodeada de océano azul
const STOP_LAT_LON: { lat: number; lon: number; landRx: number; landRy: number; seed: number }[] = [
  { lat: 16, lon: -96, landRx: 15, landRy: 11, seed: 1 },  // 1. Casa · México
  { lat: 30, lon: -64, landRx: 13, landRy: 10, seed: 2 },  // 2. Maletas y despedida
  { lat: 6, lon: -38, landRx: 14, landRy: 10, seed: 3 },   // 3. Vuelo · Atlántico
  { lat: 38, lon: -14, landRx: 13, landRy: 10, seed: 4 },  // 4. Llegada · London
  { lat: 14, lon: 18, landRx: 14, landRy: 11, seed: 5 },   // 5. Tren · North Yorkshire
  { lat: 42, lon: 50, landRx: 13, landRy: 10, seed: 6 },   // 6. York · Primer día
  { lat: 10, lon: 84, landRx: 14, landRy: 10, seed: 7 },   // 7. The Shambles · Trabajo
  { lat: 34, lon: 122, landRx: 13, landRy: 10, seed: 8 },  // 8. Hogar · Vecindad
  { lat: 4, lon: 158, landRx: 14, landRy: 11, seed: 9 },   // 9. Museos · Historia viva
  { lat: -18, lon: -148, landRx: 15, landRy: 11, seed: 10 }, // 10. York Minster · Meta B1
]

// Genera un contorno orgánico en [lat, lon] alrededor de una isla para alojarla en su propia parte verde
function buildOrganicIslandLand(
  centerLat: number,
  centerLon: number,
  rxDeg: number,
  ryDeg: number,
  seed: number,
  steps = 16,
): [number, number][] {
  const pts: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2
    const wobble =
      1 +
      Math.sin(a * 3 + seed * 1.7) * 0.16 +
      Math.cos(a * 2 - seed * 2.3) * 0.12
    const lat = centerLat + Math.sin(a) * ryDeg * wobble
    const lon = centerLon + Math.cos(a) * rxDeg * wobble
    pts.push([lat, lon])
  }
  return pts
}

const ISLAND_LANDMASSES = STOP_LAT_LON.map((s, idx) => ({
  idx,
  sandPts: buildOrganicIslandLand(s.lat - 1.2, s.lon, s.landRx * 1.18, s.landRy * 1.18, s.seed),
  grassPts: buildOrganicIslandLand(s.lat, s.lon, s.landRx, s.landRy, s.seed),
}))

// Arrecifes de coral y bancos turquesa sumergidos repartidos en el océano del planeta
const REEF_SPOTS: { lat: number; lon: number; rx: number; ry: number; seed: number; coralColor: number }[] = [
  { lat: 4, lon: -82, rx: 10, ry: 6, seed: 11, coralColor: 0xe76f51 },
  { lat: 22, lon: -48, rx: 9, ry: 5.5, seed: 12, coralColor: 0xe9b83e },
  { lat: -12, lon: -58, rx: 11, ry: 6.5, seed: 13, coralColor: 0xf08c6c },
  { lat: 28, lon: 4, rx: 9, ry: 5.5, seed: 14, coralColor: 0xe76f51 },
  { lat: -6, lon: 34, rx: 10, ry: 6, seed: 15, coralColor: 0xe9b83e },
  { lat: 26, lon: 68, rx: 9, ry: 5.5, seed: 16, coralColor: 0xf08c6c },
  { lat: -14, lon: 106, rx: 11, ry: 6, seed: 17, coralColor: 0xe76f51 },
  { lat: 18, lon: 144, rx: 9.5, ry: 5.5, seed: 18, coralColor: 0xe9b83e },
  { lat: -24, lon: -118, rx: 10, ry: 6, seed: 19, coralColor: 0xf08c6c },
]

const REEF_POLYS = REEF_SPOTS.map(r => ({
  ...r,
  shallowPts: buildOrganicIslandLand(r.lat, r.lon, r.rx * 1.25, r.ry * 1.25, r.seed, 14),
  reefPts: buildOrganicIslandLand(r.lat, r.lon, r.rx * 0.72, r.ry * 0.72, r.seed + 3, 12),
}))

// Boyas náuticas mediasumergidas flotando en el mar con baliza parpadeante
const BUOY_SPOTS: { lat: number; lon: number; phase: number }[] = [
  { lat: 24, lon: -80, phase: 0.2 },
  { lat: 18, lon: -50, phase: 1.5 },
  { lat: 24, lon: -24, phase: 2.8 },
  { lat: 27, lon: 32, phase: 0.9 },
  { lat: 22, lon: 70, phase: 2.1 },
  { lat: 20, lon: 106, phase: 3.4 },
  { lat: -8, lon: -120, phase: 1.1 },
  { lat: -14, lon: -26, phase: 2.6 },
]

// Barquitos vintage navegando suavemente en el océano
const SAILBOAT_SPOTS: { lat: number; lon: number; speedLon: number; phase: number }[] = [
  { lat: 10, lon: -66, speedLon: 2.2, phase: 0.4 },
  { lat: 32, lon: -28, speedLon: 1.8, phase: 2.0 },
  { lat: 2, lon: 54, speedLon: 2.0, phase: 3.7 },
  { lat: 14, lon: 138, speedLon: 1.9, phase: 1.3 },
]

// Pequeñas crestas de olas blancas repartidas por todo el océano
const OCEAN_WAVE_SPOTS: { lat: number; lon: number; phase: number }[] = [
  { lat: -4, lon: -94, phase: 0.1 },
  { lat: 42, lon: -88, phase: 1.2 },
  { lat: -18, lon: -78, phase: 2.4 },
  { lat: 8, lon: -18, phase: 0.8 },
  { lat: -22, lon: 4, phase: 1.9 },
  { lat: 48, lon: 22, phase: 3.1 },
  { lat: -12, lon: 62, phase: 0.6 },
  { lat: 38, lon: 98, phase: 2.2 },
  { lat: -26, lon: 136, phase: 1.4 },
  { lat: 6, lon: -158, phase: 2.9 },
  { lat: 34, lon: -132, phase: 0.5 },
  { lat: -30, lon: -42, phase: 1.7 },
]

function projectSphere(
  latDeg: number,
  lonDeg: number,
  rotLat: number,
  rotLon: number,
  cx: number,
  cy: number,
  R: number,
) {
  const lat = latDeg * DEG
  const dLon = lonDeg * DEG - rotLon
  const cosLat = Math.cos(lat)
  const sinLat = Math.sin(lat)
  const cosRLat = Math.cos(rotLat)
  const sinRLat = Math.sin(rotLat)
  const cosDLon = Math.cos(dLon)
  const sinDLon = Math.sin(dLon)

  const x = cx + R * cosLat * sinDLon
  const y = cy - R * (cosRLat * sinLat - sinRLat * cosLat * cosDLon)
  const z = sinRLat * sinLat + cosRLat * cosLat * cosDLon
  return { x, y, z }
}

function drawCartoonCloud(g: import('pixi.js').Graphics) {
  g.clear()
  g.circle(-18, 4, 15)
  g.circle(0, -4, 20)
  g.circle(20, 3, 16)
  g.circle(3, 8, 15)
  g.fill(0xfaf3e7)
  g.stroke({ width: 2.6, color: 0x2d2a26 })
  // Limpiar líneas internas rellenando el interior en crema
  g.circle(-17, 4, 13.5)
  g.circle(0, -3, 18.5)
  g.circle(19, 3, 14.5)
  g.circle(2, 7, 13.5)
  g.fill(0xfaf3e7)
}

function loadHtmlImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export function WorldMap2D({
  cards,
  todayMinutes,
  targetMinutes,
  dueReviews,
  onOpenModule,
  onOpenRepaso,
}: WorldMap2DProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const globeApiRef = useRef<{ rotateToStop: (idx: number) => void } | null>(null)
  const onOpenModuleRef = useRef(onOpenModule)
  useEffect(() => {
    onOpenModuleRef.current = onOpenModule
  }, [onOpenModule])

  const [hovered, setHovered] = useState<{
    mod: CourseModule
    card: WorldCardStatus | null
    stopName: string
  } | null>(null)
  const [previewMod, setPreviewMod] = useState<CourseModule | null>(null)

  const currentCard =
    cards.find(c => c.state === 'in_progress') ||
    cards.find(c => c.state === 'available') ||
    cards[0] ||
    null

  const completedCount = cards.filter(c => c.state === 'completed').length
  const totalLessonsDone = cards.reduce((acc, c) => acc + c.done, 0)
  const totalLessonsAll = cards.reduce((acc, c) => acc + c.total, 0)
  const globalPct = totalLessonsAll ? Math.round((totalLessonsDone / totalLessonsAll) * 100) : 0
  const goalPct = Math.min(100, Math.round((todayMinutes / Math.max(1, targetMinutes)) * 100))

  const cardsSig = cards.map(c => `${c.code}:${c.state}:${c.pct}`).join('|')

  useEffect(() => {
    let disposed = false
    const host = hostRef.current
    if (!host) return

    let appInstance: import('pixi.js').Application | null = null

    const init = async () => {
      const PIXI = await import('pixi.js')
      if (disposed || !hostRef.current) return

      const app = new PIXI.Application()
      await app.init({
        resizeTo: host,
        backgroundColor: 0xcbe8f3,
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

      // Capas del globo giratorio
      const bgLayer = new PIXI.Container()
      const globeContainer = new PIXI.Container()
      const routeLayer = new PIXI.Container()
      const islandsLayer = new PIXI.Container()
      islandsLayer.sortableChildren = true
      const fgLayer = new PIXI.Container()
      app.stage.addChild(bgLayer, globeContainer, routeLayer, islandsLayer, fgLayer)

      const bgG = new PIXI.Graphics()
      const globeG = new PIXI.Graphics()
      const maskedSurface = new PIXI.Container()
      const reefsG = new PIXI.Graphics()
      const continentsG = new PIXI.Graphics()
      const seaLifeG = new PIXI.Graphics()
      const globeMask = new PIXI.Graphics()
      const gridG = new PIXI.Graphics()
      const globeRimG = new PIXI.Graphics()
      const routesG = new PIXI.Graphics()

      bgLayer.addChild(bgG)
      maskedSurface.addChild(reefsG, continentsG, gridG, seaLifeG)
      maskedSurface.mask = globeMask
      globeContainer.addChild(globeG, globeMask, maskedSurface, globeRimG)
      routeLayer.addChild(routesG)

      const cardMap = new Map<string, WorldCardStatus>()
      cards.forEach(c => cardMap.set(c.code, c))
      const currentCode = currentCard?.code || 'm1'
      const currentIdx = Math.max(0, COURSE_MODULES.findIndex(m => m.code === currentCode))

      // Estado de rotación esférica (centrado inicialmente en la parada actual, ej. México)
      let rotLon = (STOP_LAT_LON[currentIdx]?.lon ?? -70) * DEG + 0.35
      let rotLat = 0.28
      let targetRotLon: number | null = null
      let targetRotLat: number | null = null
      let velLon = 0
      let velLat = 0
      let dragging = false
      let dragMoved = false
      let lastPtr = { x: 0, y: 0 }

      globeApiRef.current = {
        rotateToStop: (idx: number) => {
          const st = STOP_LAT_LON[idx]
          if (!st) return
          targetRotLon = st.lon * DEG
          targetRotLat = Math.max(-0.55, Math.min(0.65, st.lat * DEG * 0.7))
          velLon = 0
          velLat = 0
        },
      }

      // Interacción de arrastre 360° en toda la pantalla del globo
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen
      app.stage.on('pointerdown', e => {
        dragging = true
        dragMoved = false
        targetRotLon = null
        targetRotLat = null
        lastPtr = { x: e.global.x, y: e.global.y }
        app.canvas.style.cursor = 'grabbing'
      })
      app.stage.on('pointermove', e => {
        if (!dragging) return
        const dx = e.global.x - lastPtr.x
        const dy = e.global.y - lastPtr.y
        if (Math.hypot(dx, dy) > 3) dragMoved = true
        rotLon -= dx * 0.0062
        rotLat = Math.max(-0.68, Math.min(0.75, rotLat + dy * 0.0052))
        velLon = -dx * 0.0045
        velLat = dy * 0.0035
        lastPtr = { x: e.global.x, y: e.global.y }
      })
      const endDrag = () => {
        dragging = false
        app.canvas.style.cursor = 'grab'
      }
      app.stage.on('pointerup', endDrag)
      app.stage.on('pointerupoutside', endDrag)

      // Construir las 10 mini-islas 2D
      interface StopNodeRef {
        mod: CourseModule
        idx: number
        wrap: import('pixi.js').Container
        pulse?: import('pixi.js').Graphics
        axi?: import('pixi.js').Sprite
        hovered: boolean
      }
      const stopRefs: StopNodeRef[] = []

      COURSE_MODULES.forEach((mod, idx) => {
        const card = cardMap.get(mod.code) || null
        const unlocked = card ? card.unlocked : mod.index === 1
        const completed = card?.state === 'completed'
        const isCurrent = mod.code === currentCode
        const asset = getIslandAssetForModule(mod.index)
        const theme = getIslandTheme2D(mod.index)

        const wrap = new PIXI.Container()
        wrap.eventMode = 'static'
        wrap.cursor = 'pointer'

        const shadow = new PIXI.Graphics()
        shadow.ellipse(0, 20, isCurrent ? 50 : 38, isCurrent ? 16 : 12)
        shadow.fill({ color: 0x1a3040, alpha: unlocked ? 0.34 : 0.22 })
        wrap.addChild(shadow)

        let pulse: import('pixi.js').Graphics | undefined
        if (isCurrent) {
          pulse = new PIXI.Graphics()
          pulse.ellipse(0, 8, 64, 28)
          pulse.stroke({ width: 4, color: 0xe9b83e, alpha: 0.95 })
          wrap.addChild(pulse)
        }

        const tex = texMap[asset.key]
        if (tex) {
          const sp = new PIXI.Sprite(tex)
          sp.anchor.set(0.5)
          const targetW = isCurrent ? 124 : 86
          const ratio = asset.height / asset.width
          sp.width = targetW
          sp.height = targetW * ratio
          if (theme.flipX) sp.scale.x = -Math.abs(sp.scale.x)

          const cm = new PIXI.ColorMatrixFilter()
          if (!unlocked) {
            cm.desaturate()
            cm.brightness(0.92, true)
            sp.alpha = 0.88
          } else {
            if (theme.hueShift !== 0) cm.hue(theme.hueShift, true)
            if (theme.saturation !== 0) cm.saturate(theme.saturation, true)
          }
          sp.filters = [cm]
          wrap.addChild(sp)
        }

        let axi: import('pixi.js').Sprite | undefined
        if (isCurrent && axiTex) {
          axi = new PIXI.Sprite(axiTex)
          axi.anchor.set(0.5, 0.85)
          axi.width = 56
          axi.height = 59
          axi.position.set(-54, 14)
          wrap.addChild(axi)
        }

        const pillY = isCurrent ? 33 : 25
        const pillW = isCurrent ? 112 : 80
        const pill = new PIXI.Graphics()
        pill.roundRect(-pillW / 2, pillY - 11, pillW, 22, 11)
        pill.fill({
          color: !unlocked ? 0x474747 : isCurrent ? 0xe76f51 : completed ? 0x6b8e6a : 0xfaf3e7,
          alpha: 0.95,
        })
        pill.stroke({
          width: isCurrent ? 2.6 : 1.8,
          color: !unlocked ? 0xd8d8d8 : 0x2d2a26,
        })
        wrap.addChild(pill)

        const lbl = new PIXI.Text({
          text: isCurrent
            ? `★ Isla ${ROMAN[idx]} · ${mod.level}`
            : `${!unlocked ? '🔒' : completed ? '✓' : ''} ${ROMAN[idx]} · ${mod.level}`,
          style: {
            fontFamily: 'Georgia, serif',
            fontSize: isCurrent ? 10.5 : 9.5,
            fontWeight: 'bold',
            fill: !unlocked || isCurrent || completed ? '#FAF3E7' : '#2D2A26',
          },
        })
        lbl.anchor.set(0.5)
        lbl.position.set(0, pillY)
        wrap.addChild(lbl)

        const ref: StopNodeRef = { mod, idx, wrap, pulse, axi, hovered: false }

        wrap.on('pointerover', () => {
          ref.hovered = true
          setHovered({ mod, card, stopName: ROUTE_STOP_NAMES[idx] })
        })
        wrap.on('pointerout', () => {
          ref.hovered = false
          setHovered(prev => (prev?.mod.code === mod.code ? null : prev))
        })
        wrap.on('pointerup', () => {
          if (dragMoved) return
          if (unlocked) {
            onOpenModuleRef.current(mod.code)
          } else {
            setPreviewMod(mod)
          }
        })

        islandsLayer.addChild(wrap)
        stopRefs.push(ref)
      })

      // Nubes caricatura estilo Cuphead flotando alrededor del globo
      const clouds: { g: import('pixi.js').Graphics; speed: number }[] = []
      for (let c = 0; c < 5; c++) {
        const cl = new PIXI.Graphics()
        drawCartoonCloud(cl)
        cl.scale.set(0.85 + (c % 3) * 0.22)
        cl.position.set(80 + c * 250, 90 + (c % 3) * 145)
        fgLayer.addChild(cl)
        clouds.push({ g: cl, speed: 8 + (c % 3) * 3.5 })
      }

      // Dibuja el fondo azul bajito y la base del globo a pantalla completa
      const drawStaticGlobe = () => {
        const vw = app.screen.width || 1200
        const vh = app.screen.height || 680
        const cx = vw * 0.5
        const cy = vh * 0.5
        const R = Math.min(vw * 0.4, vh * 0.44, 335)

        bgG.clear()
        const skyGrad = new PIXI.FillGradient({
          type: 'linear',
          start: { x: 0, y: 0 },
          end: { x: 0, y: vh },
          colorStops: [
            { offset: 0, color: 0xd8f0f8 },
            { offset: 0.55, color: 0xc4e5f2 },
            { offset: 1, color: 0xadd8ea },
          ],
          textureSpace: 'global',
        })
        bgG.rect(0, 0, vw, vh)
        bgG.fill(skyGrad)

        globeG.clear()
        globeG.circle(cx, cy + 14, R * 1.06)
        globeG.fill({ color: 0x62aac4, alpha: 0.16 })
        globeG.circle(cx, cy + 16, R * 1.02)
        globeG.fill({ color: 0x1d3b4d, alpha: 0.22 })

        // Esfera oceánica por capas 2.5D
        globeG.circle(cx, cy, R)
        globeG.fill(0x36708d)
        globeG.circle(cx - R * 0.08, cy - R * 0.08, R * 0.9)
        globeG.fill(0x4f95b3)
        globeG.circle(cx - R * 0.16, cy - R * 0.16, R * 0.72)
        globeG.fill(0x73bcd1)
        globeG.circle(cx - R * 0.24, cy - R * 0.24, R * 0.45)
        globeG.fill({ color: 0xbde7ec, alpha: 0.55 })

        globeMask.clear()
        globeMask.circle(cx, cy, R - 1)
        globeMask.fill(0xffffff)

        globeRimG.clear()
        globeRimG.ellipse(cx - R * 0.28, cy - R * 0.34, R * 0.36, R * 0.2)
        globeRimG.fill({ color: 0xffffff, alpha: 0.14 })
        globeRimG.circle(cx, cy, R)
        globeRimG.stroke({ width: 3.8, color: 0x2d2a26, alpha: 0.65 })
      }

      // Redibuja arrecifes, masas verdes, vida marina (boyas, barcos, olas), rutas e islas
      const renderRotatedGlobe = (elapsed: number) => {
        const vw = app.screen.width || 1200
        const vh = app.screen.height || 680
        const cx = vw * 0.5
        const cy = vh * 0.5
        const R = Math.min(vw * 0.4, vh * 0.44, 335)

        // 0. Arrecifes de coral y bancos turquesa sumergidos bajo el agua
        reefsG.clear()
        const drawReefPoly = (
          pts: [number, number][],
          fillCol: number,
          fillAlpha: number,
          strokeCol?: number,
        ) => {
          const projected = pts.map(([lat, lon]) =>
            projectSphere(lat, lon, rotLat, rotLon, cx, cy, R),
          )
          if (projected.filter(p => p.z > 0.02).length < 4) return
          const flat: number[] = []
          projected.forEach(p => {
            if (p.z < 0) {
              const dx = p.x - cx
              const dy = p.y - cy
              const d = Math.hypot(dx, dy) || 1
              flat.push(cx + (dx / d) * R, cy + (dy / d) * R)
            } else {
              flat.push(p.x, p.y)
            }
          })
          reefsG.poly(flat)
          reefsG.fill({ color: fillCol, alpha: fillAlpha })
          if (strokeCol !== undefined) {
            reefsG.stroke({ width: 1.5, color: strokeCol, alpha: 0.4 })
          }
        }

        REEF_POLYS.forEach(r => {
          drawReefPoly(r.shallowPts, 0x8be0da, 0.34, 0xdffaf7)
          drawReefPoly(r.reefPts, r.coralColor, 0.42)
          const cPt = projectSphere(r.lat, r.lon, rotLat, rotLon, cx, cy, R)
          if (cPt.z > 0.15) {
            const sc = 0.6 + cPt.z * 0.5
            // Pequeños pólipos / corales caricatura asomando bajo el agua turquesa
            reefsG.circle(cPt.x - 6 * sc, cPt.y, 3.2 * sc)
            reefsG.circle(cPt.x + 4 * sc, cPt.y - 3 * sc, 2.6 * sc)
            reefsG.circle(cPt.x + 2 * sc, cPt.y + 4 * sc, 2.8 * sc)
            reefsG.fill({ color: r.coralColor, alpha: 0.72 * cPt.z })
          }
        })

        // 1. Partes verdes orgánicas alojando exactamente a cada una de las 10 islas en el océano
        continentsG.clear()
        const drawSphericalPoly = (
          pts: [number, number][],
          fillCol: number,
          strokeCol: number,
          strokeW: number,
        ) => {
          const projected = pts.map(([lat, lon]) =>
            projectSphere(lat, lon, rotLat, rotLon, cx, cy, R),
          )
          const visibleCount = projected.filter(p => p.z > -0.1).length
          if (visibleCount < 3) return
          const flat: number[] = []
          projected.forEach(p => {
            if (p.z < 0) {
              const dx = p.x - cx
              const dy = p.y - cy
              const d = Math.hypot(dx, dy) || 1
              flat.push(cx + (dx / d) * R, cy + (dy / d) * R)
            } else {
              flat.push(p.x, p.y)
            }
          })
          continentsG.poly(flat)
          continentsG.fill(fillCol)
          continentsG.stroke({ width: strokeW, color: strokeCol, alpha: 0.8 })
        }

        ISLAND_LANDMASSES.forEach(land => {
          const mod = COURSE_MODULES[land.idx]
          const card = cardMap.get(mod.code)
          const unlocked = card ? card.unlocked : mod.index === 1
          // Orilla de arena / espuma + masa verde donde se aloja la isla
          drawSphericalPoly(
            land.sandPts,
            unlocked ? 0xeed9ad : 0xbcbab5,
            unlocked ? 0x6d5c43 : 0x5c5b58,
            2,
          )
          drawSphericalPoly(
            land.grassPts,
            unlocked ? 0x7ea66e : 0x969994,
            unlocked ? 0x3b5936 : 0x4e504d,
            2.4,
          )
        })

        // Casquetes polares suaves
        const northPole = projectSphere(85, 0, rotLat, rotLon, cx, cy, R)
        if (northPole.z > -0.3) {
          continentsG.ellipse(northPole.x, northPole.y, R * 0.4, R * 0.14)
          continentsG.fill({ color: 0xfaf6ee, alpha: 0.82 })
        }

        // 2. Meridianos y paralelos girando con la esfera
        gridG.clear()
        for (let lon = -180; lon < 180; lon += 30) {
          let drawing = false
          for (let lat = -75; lat <= 75; lat += 15) {
            const p = projectSphere(lat, lon, rotLat, rotLon, cx, cy, R)
            if (p.z > 0) {
              if (!drawing) {
                gridG.moveTo(p.x, p.y)
                drawing = true
              } else {
                gridG.lineTo(p.x, p.y)
              }
            } else {
              drawing = false
            }
          }
          gridG.stroke({ width: 1.1, color: 0xfaf3e7, alpha: 0.17 })
        }

        // 2b. Vida marina animada sobre la esfera: olas blancas, boyas mediasumergidas y barquitos
        seaLifeG.clear()
        OCEAN_WAVE_SPOTS.forEach(w => {
          const p = projectSphere(w.lat, w.lon, rotLat, rotLon, cx, cy, R)
          if (p.z < 0.12) return
          const drift = Math.sin(elapsed * 1.4 + w.phase) * 4
          const s = 0.6 + p.z * 0.5
          seaLifeG.moveTo(p.x - 9 * s + drift, p.y)
          seaLifeG.quadraticCurveTo(p.x - 4 * s + drift, p.y - 3 * s, p.x + drift, p.y)
          seaLifeG.quadraticCurveTo(p.x + 4 * s + drift, p.y - 3 * s, p.x + 9 * s + drift, p.y)
          seaLifeG.stroke({ width: 1.8 * s, color: 0xfaf3e7, alpha: 0.42 * p.z, cap: 'round' })
        })

        // Boyas náuticas mediasumergidas (con aro de agua y luz parpadeante)
        BUOY_SPOTS.forEach(b => {
          const p = projectSphere(b.lat, b.lon, rotLat, rotLon, cx, cy, R)
          if (p.z < 0.12) return
          const s = 0.65 + p.z * 0.52
          const bob = Math.sin(elapsed * 2.4 + b.phase) * 2.4 * s
          const bx = p.x
          const by = p.y + bob

          // Onda circular de agua donde queda mediasumergida la boya
          const ringScale = 1 + Math.sin(elapsed * 2.2 + b.phase) * 0.16
          seaLifeG.ellipse(bx, p.y + 4 * s, 11 * s * ringScale, 4.2 * s * ringScale)
          seaLifeG.stroke({ width: 1.6 * s, color: 0xeaf9fb, alpha: 0.58 * p.z })

          // Base sumergida difuminada bajo el agua
          seaLifeG.ellipse(bx, p.y + 5 * s, 6.5 * s, 3.2 * s)
          seaLifeG.fill({ color: 0x26546b, alpha: 0.45 * p.z })

          // Cuerpo flotante de la boya (rojo coral + franja crema)
          seaLifeG.poly([
            bx - 6.5 * s, by + 3 * s,
            bx + 6.5 * s, by + 3 * s,
            bx + 4.2 * s, by - 7 * s,
            bx - 4.2 * s, by - 7 * s,
          ])
          seaLifeG.fill({ color: 0xe76f51, alpha: 0.96 * p.z })
          seaLifeG.stroke({ width: 1.8 * s, color: 0x2d2a26, alpha: 0.9 * p.z })

          // Franja crema en medio
          seaLifeG.rect(bx - 4.8 * s, by - 3 * s, 9.6 * s, 2.8 * s)
          seaLifeG.fill({ color: 0xfaf3e7, alpha: 0.95 * p.z })

          // Mástil y farito mostaza parpadeante arriba
          seaLifeG.moveTo(bx, by - 7 * s)
          seaLifeG.lineTo(bx, by - 12 * s)
          seaLifeG.stroke({ width: 1.6 * s, color: 0x2d2a26, alpha: 0.9 * p.z })

          const blink = 0.55 + Math.sin(elapsed * 4.5 + b.phase * 2) * 0.45
          seaLifeG.circle(bx, by - 13 * s, 4.2 * s)
          seaLifeG.fill({ color: 0xffe484, alpha: 0.35 * blink * p.z })
          seaLifeG.circle(bx, by - 13 * s, 2.1 * s)
          seaLifeG.fill({ color: 0xffe066, alpha: (0.6 + 0.4 * blink) * p.z })
        })

        // Barquitos vintage navegando suavemente
        SAILBOAT_SPOTS.forEach(boat => {
          const curLon = boat.lon + Math.sin(elapsed * 0.25 + boat.phase) * 7
          const p = projectSphere(boat.lat, curLon, rotLat, rotLon, cx, cy, R)
          if (p.z < 0.14) return
          const s = 0.62 + p.z * 0.48
          const bob = Math.sin(elapsed * 2.2 + boat.phase) * 1.8 * s
          const bx = p.x
          const by = p.y + bob

          // Estela blanca
          seaLifeG.ellipse(bx - 3 * s, by + 5 * s, 11 * s, 3.2 * s)
          seaLifeG.fill({ color: 0xfaf3e7, alpha: 0.42 * p.z })
          // Casco marrón
          seaLifeG.poly([
            bx - 9 * s, by + 1 * s,
            bx + 9 * s, by + 1 * s,
            bx + 6 * s, by + 5 * s,
            bx - 6 * s, by + 5 * s,
          ])
          seaLifeG.fill({ color: 0x8c5535, alpha: p.z })
          seaLifeG.stroke({ width: 1.5 * s, color: 0x2d2a26, alpha: p.z })
          // Vela crema
          seaLifeG.poly([
            bx, by + 1 * s,
            bx, by - 11 * s,
            bx + 8 * s, by - 1 * s,
          ])
          seaLifeG.fill({ color: 0xfaf3e7, alpha: p.z })
          seaLifeG.stroke({ width: 1.4 * s, color: 0x2d2a26, alpha: p.z })
        })

        // 3. Proyectar las 10 paradas + dibujar ruta punteada visible
        const projectedStops = STOP_LAT_LON.map(s =>
          projectSphere(s.lat, s.lon, rotLat, rotLon, cx, cy, R),
        )

        routesG.clear()
        for (let i = 0; i < projectedStops.length - 1; i++) {
          const sA = STOP_LAT_LON[i]
          const sB = STOP_LAT_LON[i + 1]
          const cardA = cardMap.get(COURSE_MODULES[i].code)
          const doneSeg = cardA?.state === 'completed'
          const steps = 14
          for (let s = 0; s < steps; s += 2) {
            const t0 = s / steps
            const t1 = Math.min(1, (s + 0.85) / steps)
            // Camino corto en longitud
            let dLon = sB.lon - sA.lon
            if (dLon > 180) dLon -= 360
            if (dLon < -180) dLon += 360
            const p0 = projectSphere(
              sA.lat + (sB.lat - sA.lat) * t0,
              sA.lon + dLon * t0,
              rotLat,
              rotLon,
              cx,
              cy,
              R * 1.03,
            )
            const p1 = projectSphere(
              sA.lat + (sB.lat - sA.lat) * t1,
              sA.lon + dLon * t1,
              rotLat,
              rotLon,
              cx,
              cy,
              R * 1.03,
            )
            if (p0.z > 0.02 && p1.z > 0.02) {
              routesG.moveTo(p0.x, p0.y)
              routesG.lineTo(p1.x, p1.y)
              routesG.stroke({
                width: doneSeg ? 4.2 : 3,
                color: doneSeg ? 0xe9b83e : 0xfaf3e7,
                alpha: Math.min(p0.z, p1.z) * (doneSeg ? 0.95 : 0.72),
                cap: 'round',
              })
            }
          }
        }

        // 4. Posicionar, escalar por profundidad z y ordenar las 10 mini-islas
        const baseScale = Math.max(0.76, Math.min(1.06, R / 245))
        stopRefs.forEach(ref => {
          const p = projectedStops[ref.idx]
          const visible = p.z > -0.08
          ref.wrap.visible = visible
          ref.wrap.eventMode = p.z > 0.08 ? 'static' : 'none'
          if (!visible) return

          const depthFactor = 0.64 + Math.max(0, p.z) * 0.42
          const hoverBoost = ref.hovered ? 1.12 : 1.0
          ref.wrap.position.set(p.x, p.y + Math.sin(elapsed * 1.8 + ref.idx) * 2)
          ref.wrap.scale.set(baseScale * depthFactor * hoverBoost)
          ref.wrap.alpha = Math.max(0, Math.min(1, (p.z + 0.08) * 3.5))
          ref.wrap.zIndex = Math.round(p.z * 1000)

          if (ref.pulse) {
            const s = 1 + Math.sin(elapsed * 4.2) * 0.07
            ref.pulse.scale.set(s)
            ref.pulse.alpha = 0.65 + Math.sin(elapsed * 4.2) * 0.3
          }
          if (ref.axi) {
            ref.axi.rotation = Math.sin(elapsed * 3) * 0.06
          }
        })
      }

      drawStaticGlobe()
      app.renderer.on('resize', drawStaticGlobe)

      let elapsed = 0
      app.ticker.add(ticker => {
        const dt = ticker.deltaMS / 1000
        elapsed += dt

        if (!dragging) {
          if (targetRotLon !== null && targetRotLat !== null) {
            let diff = targetRotLon - rotLon
            while (diff > Math.PI) diff -= Math.PI * 2
            while (diff < -Math.PI) diff += Math.PI * 2
            rotLon += diff * Math.min(1, dt * 6)
            rotLat += (targetRotLat - rotLat) * Math.min(1, dt * 6)
            if (Math.abs(diff) < 0.01 && Math.abs(targetRotLat - rotLat) < 0.01) {
              targetRotLon = null
              targetRotLat = null
            }
          } else {
            rotLon += velLon
            rotLat = Math.max(-0.68, Math.min(0.75, rotLat + velLat))
            velLon *= 0.93
            velLat *= 0.93
            // Rotación orbital muy suave cuando está en reposo
            if (Math.abs(velLon) < 0.0004) rotLon += dt * 0.045
          }
        }

        renderRotatedGlobe(elapsed)

        const vw = app.screen.width || 1100
        clouds.forEach(c => {
          c.g.x += c.speed * dt
          if (c.g.x > vw + 100) c.g.x = -100
        })
      })
    }

    init().catch(err => console.error('WorldMap2D init error:', err))

    return () => {
      disposed = true
      globeApiRef.current = null
      if (appInstance) {
        appInstance.destroy(true, { children: true })
        appInstance = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsSig, currentCard?.code])

  return (
    <div className="relative w-full h-[calc(100vh-56px)] min-h-[620px] overflow-hidden select-none flex flex-col bg-[#CBE8F3]">
      {/* Canvas PixiJS del Globo 2D giratorio 360° a pantalla completa */}
      <div ref={hostRef} className="w-full flex-1 min-h-[480px]" />

      {/* Encabezado de métricas compacto */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5">
        <div className="flex items-center gap-3 rounded-2xl border-2 border-[#2D2A26] bg-[#FAF3E7]/95 px-4 py-2 shadow-[0_3px_0_#2D2A26]">
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-[0.16em] text-[#E76F51]">
              Tu ruta México → York
            </p>
            <p className="text-sm font-black text-[#2D2A26]">
              {completedCount} de 10 paradas · {globalPct}% del trayecto
            </p>
          </div>
          <div className="h-7 w-[1.5px] bg-[#2D2A26]/15" />
          <div>
            <p className="text-[9.5px] font-black uppercase tracking-[0.14em] text-[#6B8E6A]">
              Meta de hoy
            </p>
            <p className="text-xs font-extrabold text-[#2D2A26]">
              {todayMinutes} / {targetMinutes} min ({goalPct}%)
            </p>
          </div>
        </div>
        <span className="pointer-events-none inline-flex items-center gap-1 rounded-full border border-[#2D2A26]/20 bg-[#FAF3E7]/85 px-2.5 py-0.5 text-[10px] font-bold text-[#2D2A26]/75 w-fit">
          <MS name="360" className="!text-[13px]" /> Arrastra el planeta para girarlo
        </span>
      </div>

      {/* Controles superiores derechos */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenRepaso}
          className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D2A26] bg-[#FAF3E7]/95 hover:bg-[#6B8E6A] hover:text-white px-3.5 py-1.5 text-xs font-extrabold text-[#2D2A26] shadow-[0_3px_0_#2D2A26] transition-colors cursor-pointer"
        >
          <MS name="autorenew" className="!text-[16px]" />
          <span>Repaso</span>
          {dueReviews > 0 && (
            <span className="rounded-full bg-[#E76F51] px-1.5 text-[10px] font-black text-white">
              {dueReviews}
            </span>
          )}
        </button>

        {currentCard && (
          <button
            type="button"
            onClick={() => onOpenModule(currentCard.code)}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-[#2D2A26] bg-[#E9B83E] hover:bg-[#E76F51] hover:text-white px-4 py-1.5 text-xs font-black text-[#2D2A26] shadow-[0_3px_0_#2D2A26] transition-colors cursor-pointer"
          >
            <MS name="explore" className="!text-[16px]" />
            <span>Ir a Isla {ROMAN[currentCard.index - 1]} ({currentCard.level})</span>
          </button>
        )}
      </div>

      {/* Tooltip flotante */}
      {hovered && !previewMod && (
        <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div
            className={`rounded-2xl border-2 px-5 py-2 text-center shadow-[0_4px_0_#2D2A26] min-w-[260px] ${hovered.card?.unlocked || hovered.mod.index === 1
                ? 'border-[#2D2A26] bg-[#FAF3E7]/96 text-[#2D2A26]'
                : 'border-[#4A4A4A] bg-[#EAEAEA]/96 text-[#333] grayscale'
              }`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#E76F51]">
              {hovered.mod.index}. {hovered.stopName} · {hovered.mod.level}
            </p>
            <p className="text-sm font-black mt-0.5">{hovered.mod.title}</p>
            <p className="text-[11px] font-semibold opacity-80 mt-0.5">
              {hovered.card?.unlocked || hovered.mod.index === 1
                ? `${hovered.card?.done || 0} de ${hovered.card?.total || hovered.mod.lessons.length} niveles (${hovered.card?.pct || 0}%) · Clic para entrar`
                : '🔒 Bloqueada · Clic para vista previa en gris'}
            </p>
          </div>
        </div>
      )}

      {/* Chips de paradas: giran el planeta hacia la isla o abren la vista */}
      <div className="relative z-10 bg-[#FAF3E7]/92 border-t border-[#2D2A26]/12 px-4 py-2.5 flex flex-wrap items-center justify-center gap-1.5">
        {COURSE_MODULES.map((mod, i) => {
          const c = cards.find(x => x.code === mod.code)
          const unlocked = c ? c.unlocked : mod.index === 1
          const done = c?.state === 'completed'
          const isCur = mod.code === currentCard?.code
          return (
            <button
              key={mod.code}
              type="button"
              onClick={() => {
                globeApiRef.current?.rotateToStop(i)
              }}
              onDoubleClick={() => (unlocked ? onOpenModule(mod.code) : setPreviewMod(mod))}
              title="Clic para girar el planeta a esta parada · Doble clic para abrir"
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold border transition-all cursor-pointer ${isCur
                ? 'border-[#2D2A26] bg-[#E9B83E] text-[#2D2A26] shadow-[0_2px_0_#2D2A26]'
                : done
                  ? 'border-[#6B8E6A] bg-[#6B8E6A]/15 text-[#2D2A26] hover:bg-[#6B8E6A]/25'
                  : unlocked
                    ? 'border-[#2D2A26]/25 bg-white text-[#2D2A26] hover:border-[#E76F51]'
                    : 'border-[#2D2A26]/12 bg-[#EAE4D9]/70 text-[#7A746C] hover:bg-[#E0D9CC]'
                }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{
                  background: done
                    ? '#14A085'
                    : isCur
                      ? '#E76F51'
                      : unlocked
                        ? '#6B8E6A'
                        : '#B8B0A4',
                }}
              />
              <span>
                {i + 1}. {ROUTE_STOP_NAMES[i]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Modal de vista previa en gris */}
      {previewMod && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]"
          onClick={() => setPreviewMod(null)}
        >
          <div
            className="w-full max-w-xl max-h-[88%] overflow-y-auto rounded-2xl border-2 border-[#4A4A4A] bg-[#F0F0F0] text-[#2E2E2E] shadow-[0_10px_0_#3A3A3A] p-5 grayscale"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b-2 border-dashed border-[#9A9A9A] pb-3">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#5A5A5A] bg-[#DCDCDC] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#3A3A3A]">
                  <MS name="lock" className="!text-[12px]" />
                  <span>Vista previa en gris · Parada {previewMod.index}</span>
                </div>
                <h3 className="mt-1.5 text-lg font-black text-[#222]">
                  {ROUTE_STOP_NAMES[previewMod.index - 1]} · {previewMod.level} — {previewMod.title}
                </h3>
                <p className="text-xs text-[#555] mt-0.5">
                  {previewMod.purpose} · {previewMod.hours} horas estimadas
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMod(null)}
                className="rounded-lg border-2 border-[#4A4A4A] bg-white px-2.5 py-1 text-xs font-extrabold text-[#222] hover:bg-[#E2E2E2] cursor-pointer"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {previewMod.lessons.map((lesson, idx) => (
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
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
