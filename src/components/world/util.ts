// R36 — utilidades del mundo: PRNG determinista, suavizado, camino y ruido.
// Extraídas tal cual de landscape3d.tsx (refactor por extracción, sin cambios).
import * as THREE from 'three'

// PRNG determinista (mulberry32): mismo bosque para el mismo mundo
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

// Centro del camino serpenteante (ancho de banda ±4.4) para cualquier z
export function pathX(z: number): number {
  return 3.3 * Math.sin(z * 0.075) + 1.1 * Math.sin(z * 0.031 + 2.0)
}

// Curva 3D REAL del camino (CatmullRom) muestreada de pathX: sobre ella viven
// los nodos de las lecciones y los vuelos de cámara (R21)
export function buildPathCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  // el extremo se queda DENTRO del terreno (éste llega a z=-106): el portal
  // del final nunca flota sobre el vacío
  for (let z = 12; z >= -100; z -= 6.18) pts.push(new THREE.Vector3(pathX(z), 0, z))
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
}

// Ruido de valor 2D suave (colinas)
export function vnoise2(x: number, z: number): number {
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
    return s - Math.floor(s)
  }
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf)
  return h(xi, zi) * (1 - u) * (1 - w) + h(xi + 1, zi) * u * (1 - w) + h(xi, zi + 1) * (1 - u) * w + h(xi + 1, zi + 1) * u * w
}
