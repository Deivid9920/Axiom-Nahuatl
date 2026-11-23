// R36 — capa de datos del mundo (PDF maestro: «arquitectura de datos separada
// del gráfico»): las 6 configuraciones de bioma y el cielo por fase viven como
// DATOS puros, sin dependencias de three ni de React. El gráfico (los builders
// de src/components/world) consume estas configuraciones; añadir un bioma
// nuevo empieza aquí, sin tocar el núcleo del render.

export type ScenePhase = 'dawn' | 'day' | 'dusk' | 'night'

// R38 — decoración por bioma: piezas pequeñas características como DATOS (el
// gráfico las consume; añadir un adorno a un bioma empieza aquí, sin tocar
// los builders). colors es la paleta de la pieza (p. ej. sombreros de setas).
export type PropKind = 'mushroom' | 'stump' | 'reed' | 'rockpile' | 'boulder'
export interface WorldProp { kind: PropKind; count: number; colors?: number[] }

export interface WorldCfg {
  groundA: number; groundB: number; dirt: number
  treeKind: 'broad' | 'pine' | 'mix'
  treeCols: number[]; trunkCol: number
  grassCol: number; grassFar: number
  amp: number
  leafCols: number[]; leafCount: number
  river?: { z: number; w: number; deep: number; shallow: number }
  flowers?: number[]; stoneCount: number
  props?: WorldProp[]
  fogNear: number; fogFar: number
  birds: boolean; firefliesAlways: boolean; clouds: number
}

export const WORLDS: Record<number, WorldCfg> = {
  1: { // pradera
    groundA: 0x8fbf72, groundB: 0x6fa85a, dirt: 0xc9b48a,
    treeKind: 'broad', treeCols: [0x4e8a4a, 0x6faf62, 0x3f7a4c], trunkCol: 0x7a5230,
    grassCol: 0x7fb75e, grassFar: 0x699a52, amp: 1.0,
    leafCols: [0x6faf62, 0x8fcb74, 0xe0c36a], leafCount: 90,
    flowers: [0xf4a38a, 0xf3e3c2, 0xe9a23b], stoneCount: 7,
    props: [
      { kind: 'mushroom', count: 10, colors: [0xc4573d, 0xb8703f, 0xd08a4a] },
      { kind: 'stump', count: 4 },
    ],
    fogNear: 24, fogFar: 100, birds: false, firefliesAlways: false, clouds: 4,
  },
  2: { // otoño
    groundA: 0xd9a75b, groundB: 0xc08a45, dirt: 0xb08a55,
    treeKind: 'broad', treeCols: [0xc97b2d, 0xe0a044, 0xb85c22], trunkCol: 0x6e4a26,
    grassCol: 0xc9a45c, grassFar: 0xa8854a, amp: 1.15,
    leafCols: [0xd9822b, 0xe0a044, 0xc9682b], leafCount: 140,
    stoneCount: 8,
    props: [
      { kind: 'stump', count: 6 },
      { kind: 'mushroom', count: 8, colors: [0xa8542e, 0xc46a3a] },
    ],
    fogNear: 22, fogFar: 95, birds: false, firefliesAlways: false, clouds: 3,
  },
  3: { // río
    groundA: 0x9cc08a, groundB: 0x7faf6f, dirt: 0xbfae86,
    treeKind: 'mix', treeCols: [0x3f7a4c, 0x5c9b60, 0x4e8a4a], trunkCol: 0x6b4a2e,
    grassCol: 0x6faa5e, grassFar: 0x5c9450, amp: 0.9,
    leafCols: [0x5c9b60, 0x7ab56a, 0x9bc48a], leafCount: 60,
    river: { z: -38, w: 5.5, deep: 0x2a6fa8, shallow: 0x8fd0e0 },
    stoneCount: 16,
    props: [
      { kind: 'reed', count: 16, colors: [0x5c9450, 0x6faa5e] },
      { kind: 'rockpile', count: 5 },
    ],
    fogNear: 24, fogFar: 100, birds: false, firefliesAlways: false, clouds: 3,
  },
  4: { // colinas de pinos
    groundA: 0xa8c08b, groundB: 0x8fae76, dirt: 0xb9a67e,
    treeKind: 'pine', treeCols: [0x2f6b57, 0x3d7d63, 0x35705c], trunkCol: 0x6b4a2e,
    grassCol: 0x8fae6a, grassFar: 0x7c9a58, amp: 2.1,
    leafCols: [0x3d7d63, 0x4c8a6a], leafCount: 46,
    stoneCount: 10,
    props: [
      { kind: 'boulder', count: 7 },
      { kind: 'stump', count: 5 },
    ],
    fogNear: 26, fogFar: 105, birds: false, firefliesAlways: false, clouds: 5,
  },
  5: { // bosque con niebla
    groundA: 0x7fa98a, groundB: 0x6b9578, dirt: 0xa39a78,
    treeKind: 'pine', treeCols: [0x245a46, 0x2e6b52, 0x1f5040], trunkCol: 0x4a4038,
    grassCol: 0x6a9a70, grassFar: 0x58855e, amp: 1.5,
    leafCols: [0x2e6b52, 0x3a7a5c], leafCount: 52,
    stoneCount: 12,
    props: [
      { kind: 'mushroom', count: 14, colors: [0xd8d2c0, 0xb8a98a, 0xc9bfa4] },
      { kind: 'rockpile', count: 6 },
    ],
    fogNear: 11, fogFar: 56, birds: false, firefliesAlways: true, clouds: 2,
  },
  6: { // atardecer dorado junto al lago
    groundA: 0xc9a96e, groundB: 0xb2914f, dirt: 0xb1915e,
    treeKind: 'mix', treeCols: [0x54635a, 0x6b7d6a, 0x4a5c50], trunkCol: 0x5a4a34,
    grassCol: 0xbfa25c, grassFar: 0xa08744, amp: 0.8,
    leafCols: [0xe9b45c, 0xd99a48, 0x8a9a6a], leafCount: 80,
    river: { z: -70, w: 8.5, deep: 0x2a5f98, shallow: 0xe8b47c },
    flowers: [0xe9a23b, 0xd9822b], stoneCount: 12,
    props: [
      { kind: 'reed', count: 16, colors: [0x8a9a4a, 0xa08744] },
      { kind: 'stump', count: 4 },
    ],
    fogNear: 24, fogFar: 100, birds: true, firefliesAlways: false, clouds: 3,
  },
}

// Cielo y luz por fase (top/horizonte de R16-R17; luz de R18)
export const PHASE_SKY: Record<ScenePhase, { top: number; hor: number; fog: number; sunDir: [number, number, number]; orb: number; orbScale: number; sunI: number; sunCol: number; ambI: number }> = {
  dawn: { top: 0xa9c7de, hor: 0xf7e3b8, fog: 0xead9b8, sunDir: [-60, 14, -120], orb: 0xffdfa0, orbScale: 26, sunI: 0.95, sunCol: 0xffd9a8, ambI: 0.72 },
  day: { top: 0xbcdfee, hor: 0xf2f7ec, fog: 0xe8f0e6, sunDir: [35, 95, -140], orb: 0xffe9a8, orbScale: 24, sunI: 1.15, sunCol: 0xfff4e0, ambI: 0.82 },
  dusk: { top: 0x6b5a92, hor: 0xefb27c, fog: 0xd9a583, sunDir: [70, 16, -120], orb: 0xffc98f, orbScale: 28, sunI: 0.8, sunCol: 0xffb27c, ambI: 0.55 },
  night: { top: 0x0c1330, hor: 0x26335f, fog: 0x1b2547, sunDir: [-30, 70, -120], orb: 0xf5f7e8, orbScale: 15, sunI: 0.42, sunCol: 0x9fb2e8, ambI: 0.42 },
}
