// Arquitectura por capas 2D estilo Cuphead (PixiJS v8) para los 10 módulos de inglés (A1.1 → B1.2).
// Separa:
//  1) Catálogo de islas recortadas (PNG transparente sin contorno cuadrado) con sus propios caminos.
//  2) Temas atmosféricos (cielo/mar infinito, tinte de acuarela, orientación) distintos por módulo,
//     garantizando que el siguiente nivel SIEMPRE muestre una isla visualmente diferente.

export type IslandAssetKey = 'island-1' | 'island-2'

export interface IslandAssetSpec {
  key: IslandAssetKey
  src: string
  width: number
  height: number
  /** Punto [0..1, 0..1] donde sale el puente hacia la isla vecina */
  bridgeAnchor: [number, number]
  /** 14 puntos normalizados [0..1, 0..1] trazados sobre los caminos pintados de esta isla */
  roadWaypoints: [number, number][]
}

export const ISLAND_ASSETS: Record<IslandAssetKey, IslandAssetSpec> = {
  'island-1': {
    key: 'island-1',
    src: '/assets/overworld/island-1.png',
    width: 1408,
    height: 792,
    bridgeAnchor: [0.91, 0.72],
    roadWaypoints: [
      [0.37, 0.67], // 01 Muelle / inicio
      [0.31, 0.60], // 02 Carpa café
      [0.28, 0.51], // 03 Curva oeste
      [0.32, 0.42], // 04 Curva noroeste
      [0.40, 0.40], // 05 Aldea de cabañas
      [0.47, 0.42], // 06 Entrada al puente de piedra
      [0.53, 0.42], // 07 Puente de piedra sobre el río
      [0.58, 0.45], // 08 Ribera este
      [0.64, 0.52], // 09 Bajo el anfiteatro
      [0.70, 0.57], // 10 Torre del reloj
      [0.74, 0.47], // 11 Sendero este
      [0.77, 0.38], // 12 Subida a la colina
      [0.66, 0.35], // 13 Entrada al castillo
      [0.72, 0.29], // 14 Castillo (Evaluación final)
    ],
  },
  'island-2': {
    key: 'island-2',
    src: '/assets/overworld/island-2.png',
    width: 1280,
    height: 780,
    bridgeAnchor: [0.92, 0.64],
    roadWaypoints: [
      [0.14, 0.78], // 01 Muelle oeste
      [0.21, 0.72], // 02 Sendero empedrado
      [0.26, 0.61], // 03 Puente de arco
      [0.22, 0.47], // 04 Plaza del templo
      [0.19, 0.33], // 05 Sendero norte
      [0.28, 0.44], // 06 Camino central
      [0.35, 0.51], // 07 Fuente central
      [0.41, 0.42], // 08 Anfiteatro
      [0.48, 0.58], // 09 Mirador de pista
      [0.56, 0.48], // 10 Puente a la isla este
      [0.61, 0.39], // 11 Carpa mágica y reloj
      [0.72, 0.37], // 12 Subida a la colina este
      [0.78, 0.27], // 13 Casona de la cima
      [0.84, 0.61], // 14 Puerto final (Evaluación final)
    ],
  },
}

export interface IslandTheme2D {
  moduleIndex: number
  islandName: string
  subtitle: string
  /** Qué isla ilustrada usa este módulo (alterna para que el siguiente nivel sea diferente) */
  assetKey: IslandAssetKey
  /** Espejado horizontal opcional para multiplicar variedad visual entre módulos avanzados */
  flipX?: boolean
  /** Colores de cielo/océano infinito detrás de la isla (gradiente vertical sin bordes) */
  skyTop: number
  oceanMid: number
  oceanBottom: number
  waveColor: number
  /** Ajuste de acuarela con PixiJS ColorMatrixFilter */
  hueShift: number
  saturation: number
  brightness: number
  /** Color de acento para medallón actual */
  accentHex: string
  accentNum: number
  pathColor: number
}

export const ISLAND_THEMES_2D: IslandTheme2D[] = [
  {
    moduleIndex: 1,
    islandName: 'Isla I · Puerto Primeros Pasos',
    subtitle: 'A1.1 · Supervivencia lingüística',
    assetKey: 'island-1',
    skyTop: 0xb7dce2,
    oceanMid: 0x8cc2cc,
    oceanBottom: 0x6ba5b5,
    waveColor: 0xeaf6f7,
    hueShift: 0,
    saturation: 0.04,
    brightness: 1.0,
    accentHex: '#E76F51',
    accentNum: 0xe76f51,
    pathColor: 0xfaf3e7,
  },
  {
    moduleIndex: 2,
    islandName: 'Isla II · Villa Cotidiana',
    subtitle: 'A1.2 · Rutinas y compras',
    assetKey: 'island-2',
    skyTop: 0xc2dce8,
    oceanMid: 0x8eb8d0,
    oceanBottom: 0x6794b2,
    waveColor: 0xedf5fa,
    hueShift: -8,
    saturation: 0.06,
    brightness: 1.01,
    accentHex: '#E9B83E',
    accentNum: 0xe9b83e,
    pathColor: 0xfaf3e7,
  },
  {
    moduleIndex: 3,
    islandName: 'Isla III · Estación de Viajes',
    subtitle: 'A1+ · Experiencias y pasado',
    assetKey: 'island-1',
    flipX: true,
    skyTop: 0xd9d2c3,
    oceanMid: 0x99b8bf,
    oceanBottom: 0x6c93a1,
    waveColor: 0xf5f0e4,
    hueShift: -22,
    saturation: 0.1,
    brightness: 1.01,
    accentHex: '#E76F51',
    accentNum: 0xe76f51,
    pathColor: 0xf7efe2,
  },
  {
    moduleIndex: 4,
    islandName: 'Isla IV · Colinas del Mañana',
    subtitle: 'A1+ · Futuro y transición a A2',
    assetKey: 'island-2',
    flipX: true,
    skyTop: 0xc6e0d4,
    oceanMid: 0x88b8b2,
    oceanBottom: 0x5d9091,
    waveColor: 0xebf7f4,
    hueShift: 14,
    saturation: 0.05,
    brightness: 1.0,
    accentHex: '#E9B83E',
    accentNum: 0xe9b83e,
    pathColor: 0xfaf3e7,
  },
  {
    moduleIndex: 5,
    islandName: 'Isla V · Mercado del Puerto',
    subtitle: 'A2.1 · Interacción social',
    assetKey: 'island-1',
    skyTop: 0xe6d3bc,
    oceanMid: 0xa2b6bd,
    oceanBottom: 0x6f8d9c,
    waveColor: 0xfaf0e2,
    hueShift: -34,
    saturation: 0.12,
    brightness: 1.0,
    accentHex: '#D96846',
    accentNum: 0xd96846,
    pathColor: 0xf6ebd8,
  },
  {
    moduleIndex: 6,
    islandName: 'Isla VI · Distrito Oficina',
    subtitle: 'A2.2 · Trabajo y servicio',
    assetKey: 'island-2',
    skyTop: 0xc5d4e6,
    oceanMid: 0x87a6c4,
    oceanBottom: 0x5d7ea1,
    waveColor: 0xecf3fa,
    hueShift: 22,
    saturation: -0.02,
    brightness: 0.99,
    accentHex: '#E9B83E',
    accentNum: 0xe9b83e,
    pathColor: 0xf5ede0,
  },
  {
    moduleIndex: 7,
    islandName: 'Isla VII · Boulevard Central',
    subtitle: 'A2+ · Autonomía cotidiana',
    assetKey: 'island-1',
    flipX: true,
    skyTop: 0xd4dec2,
    oceanMid: 0x8eb8b0,
    oceanBottom: 0x61918f,
    waveColor: 0xf0f7ec,
    hueShift: 18,
    saturation: 0.06,
    brightness: 1.0,
    accentHex: '#E76F51',
    accentNum: 0xe76f51,
    pathColor: 0xfaf3e7,
  },
  {
    moduleIndex: 8,
    islandName: 'Isla VIII · Puente Profesional',
    subtitle: 'A2+ · Transición a B1',
    assetKey: 'island-2',
    flipX: true,
    skyTop: 0xe0d2c8,
    oceanMid: 0x9aaec2,
    oceanBottom: 0x6c849e,
    waveColor: 0xf5efe9,
    hueShift: -18,
    saturation: 0.08,
    brightness: 1.0,
    accentHex: '#E9B83E',
    accentNum: 0xe9b83e,
    pathColor: 0xf4ece0,
  },
  {
    moduleIndex: 9,
    islandName: 'Isla IX · Mirador Ejecutivo',
    subtitle: 'B1.1 · Argumentación y proyectos',
    assetKey: 'island-1',
    skyTop: 0xc2d1e3,
    oceanMid: 0x809eb8,
    oceanBottom: 0x567694,
    waveColor: 0xeaf1f8,
    hueShift: 10,
    saturation: 0.04,
    brightness: 0.99,
    accentHex: '#E76F51',
    accentNum: 0xe76f51,
    pathColor: 0xfaf3e7,
  },
  {
    moduleIndex: 10,
    islandName: 'Isla X · Cumbre B1.2',
    subtitle: 'B1.2 · Consolidación profesional',
    assetKey: 'island-2',
    skyTop: 0xebd9be,
    oceanMid: 0x9bb7c4,
    oceanBottom: 0x698ca1,
    waveColor: 0xfcf4e6,
    hueShift: -12,
    saturation: 0.12,
    brightness: 1.03,
    accentHex: '#E9B83E',
    accentNum: 0xe9b83e,
    pathColor: 0xfdf5e6,
  },
]

export function getIslandTheme2D(moduleIndex: number): IslandTheme2D {
  return ISLAND_THEMES_2D[(Math.max(1, moduleIndex) - 1) % ISLAND_THEMES_2D.length]
}

export function getIslandAssetForModule(moduleIndex: number): IslandAssetSpec {
  const theme = getIslandTheme2D(moduleIndex)
  return ISLAND_ASSETS[theme.assetKey]
}
