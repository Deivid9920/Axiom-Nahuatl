// R40 — AssetManager mínimo (categoría 🟢 «adoptar ahora» del plan): carga de
// GLB locales con GLTFLoader + caché por URL. Sin Draco/KTX2 todavía (R44);
// los GLB del piloto son estáticos locales (~4 MB totales) y gzip los sirve
// bien. El fallo de carga NUNCA rompe el mundo: el caller hace fallback al
// gráfico procedural R38.
//
// extractParts(): normaliza una escena GLB a PARTES fusionadas por material
// (geometría con las transformadas de mundo horneadas, base en y=0, centro XZ
// en el origen y altura normalizada a 1). El caller escala a la altura real:
// así un mismo modelo sirve para tamaños distintos con proporciones intactas.
// Los materiales se CLONAN por construcción: la limpieza scene.traverse del
// componente nunca envenena la caché entre montajes.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js'

export interface LoadedGlb { scene: THREE.Group; animations: THREE.AnimationClip[] }
export interface GlbPart { geo: THREE.BufferGeometry; mat: THREE.Material; matName: string }

const loader = new GLTFLoader()
const cache = new Map<string, Promise<LoadedGlb>>()

function loadOnce(url: string): Promise<LoadedGlb> {
  let p = cache.get(url)
  if (!p) {
    p = new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => resolve({ scene: gltf.scene as THREE.Group, animations: gltf.animations ?? [] }),
        undefined,
        () => reject(new Error(`GLB no cargó: ${url}`)),
      )
    })
    cache.set(url, p)
  }
  return p
}

// o.clone — instancia INDEPENDIENTE del GLB cacheado (mascota compartida por
// UI + mundo): SkeletonUtils.clone re-vincula los huesos del skin (un .clone()
// plano los comparte y los mixers pelean), y se clonan además geometría y
// materiales para que el dispose por scene.traverse del componente NUNCA
// envenene la caché (mismo contrato que extractParts, arriba).
export function loadGlb(url: string, o: { clone?: boolean } = {}): Promise<LoadedGlb> {
  if (!o.clone) return loadOnce(url)
  return loadOnce(url).then((g) => {
    const scene = skeletonClone(g.scene)
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        mesh.geometry = mesh.geometry.clone()
        const m = mesh.material as THREE.Material | THREE.Material[]
        mesh.material = Array.isArray(m) ? m.map((x) => x.clone()) : m.clone()
      }
    })
    return { scene: scene as THREE.Group, animations: g.animations }
  })
}

export interface NormalizedGlb { parts: GlbPart[]; h: number }

// R40 — REMAPEO DE PALETA (dirección de arte determinista, documentada):
// los GLB del espejo de Quaternius traen baseColorFactor casi negros
// (Green=#121F0C, Wood=#1F0E0C, metallicFactor=0.4) — ilegibles bajo
// Neutral tone mapping. Este mapa asigna una paleta estilizada brillante
// por nombre de material (sufijo .001 normalizado); cualquier nombre no
// mapeado se ACLARA por HSL (nunca se deja negro).
const PALETTE: Record<string, number> = {
  // vegetación
  green: 0x63a652, darkgreen: 0x4c8a44, cyan: 0x8fc98a,
  // madera / construcción
  wood: 0x7a5230, wood_side: 0x6b4829, woodside: 0x6b4829, wood_light: 0x8f6b42,
  darkwood: 0x5a3d24, plaster: 0xe8dfc8, beige: 0xd9c9a8,
  // piedra
  stone: 0x9aa0a6, stone_light: 0xb8bec4, stone_dark: 0x6d747c, rock: 0x8d9298,
  grey: 0x9aa0a6, white: 0xe8e8e2, black: 0x2a2d33,
  // techos y acentos
  rooftiles: 0xb0553a, rooftiles_red: 0xc05a3c, red: 0xc14b3d, bell: 0xd9a441,
  yellow: 0xe0b34c, windows: 0x9fd8e8, fire: 0xff9a3c, bag: 0xb99a6a,
  // fauna
  main: 0xa8743d, main_light: 0xc99a63, main_dark: 0x6e4a2c, hooves: 0x3a3f47,
  eye_white: 0xffffff, eye_black: 0x1a1a1e, eyes: 0x1a1a1e, eye_lighter: 0x3a3f47,
}

// Aplica la paleta por nombre de material (los animales en escena viva la
// usan también). Devuelve true si hubo color de paleta exacto.
export function applyPalette(matName: string, mat: THREE.Material): boolean {
  const key = matName.toLowerCase().replace(/\.\d+$/, '')
  const std = mat as THREE.MeshLambertMaterial
  if (!std.color) return false
  const hex = PALETTE[key]
  if (hex != null) { std.color.setHex(hex); return true }
  // fallback: aclarar colores imposibles (l < 0.4) conservando el tono
  const hsl = { h: 0, s: 0, l: 0 }
  std.color.getHSL(hsl)
  if (hsl.l < 0.4) std.color.offsetHSL(0, Math.min(0.14, 0.05 + hsl.s * 0.1), 0.42 - hsl.l)
  return false
}

// NOTA R40: los materiales del glTF se convierten a Lambert + paleta propia
// (applyPalette): los packs traen baseColorFactor casi negros y metallic 0.4 —
// sin envMap y bajo Neutral tone mapping se verían negros.
export function extractParts(root: THREE.Object3D): NormalizedGlb {
  root.updateMatrixWorld(true)
  const byMat = new Map<THREE.Material, { name: string; geos: THREE.BufferGeometry[] }>()
  const box = new THREE.Box3()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    src.applyMatrix4(mesh.matrixWorld)
    const matSrc = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial
    // R40 (2ª iteración de evidencia): los Standard del glTF respondían apagado
    // bajo Neutral tone mapping (aldeas y copas casi negras). La conversión a
    // Lambert facetado unifica el estilo low-poly de la escena y responde a la
    // luz con el mismo look que las primitivas R36. Color base del glTF conservado.
    const mat = new THREE.MeshLambertMaterial({ color: matSrc?.color?.clone() ?? new THREE.Color(0xffffff) })
    if (matSrc?.map) mat.map = matSrc.map
    applyPalette(matSrc?.name || '', mat)
    box.expandByObject(mesh)
    const entry = byMat.get(mat) ?? { name: matSrc.name || 'mat', geos: [] }
    entry.geos.push(src)
    byMat.set(mat, entry)
  })
  if (box.isEmpty()) return { parts: [], h: 1 }
  const h = Math.max(0.001, box.max.y - box.min.y)
  // R40 (3ª iteración, BUG de evidencia): la normalización es GLOBAL al modelo
  // — una sola traslación/escala aplicada a TODAS las partes. Normalizar cada
  // parte por su propio bbox destruía los offsets relativos (la copa bajaba a
  // la base del tronco y las ramas sobresalían: árboles «muertos»).
  const cx = (box.min.x + box.max.x) / 2
  const cz = (box.min.z + box.max.z) / 2
  const baseY = box.min.y
  const parts: GlbPart[] = []
  for (const [mat, { name, geos }] of byMat) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos)!
    merged.translate(-cx, -baseY, -cz)
    merged.scale(1 / h, 1 / h, 1 / h)
    merged.computeBoundingSphere()
    merged.computeBoundingBox()
    parts.push({ geo: merged, mat, matName: name })
  }
  // las copas/vientre de hoja van SIEMPRE antes que el tronco (orden estable)
  parts.sort((a, b) => (a.matName === 'Wood' ? 1 : 0) - (b.matName === 'Wood' ? 1 : 0))
  return { parts, h }
}
