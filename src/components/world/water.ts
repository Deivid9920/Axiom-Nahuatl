// R36 — agua: plano con olas por shader + paleta por fase. Extraído tal cual
// de landscape3d.tsx (refactor por extracción, sin cambios).
// R38 — el agua se recorta a la silueta de la isla: llega al borde, donde la
// coge la cascada (buildWaterfall) en el lado +x.
import * as THREE from 'three'
import { WATER_VS, WATER_FS, sharedU } from './shaders'
import { islandHalfWidth } from './terrain'
import { PHASE_SKY } from '@/lib/world/configs'
import type { WorldCfg, ScenePhase } from '@/lib/world/configs'

export function buildWater(cfg: WorldCfg, phase: ScenePhase, group: THREE.Group): { mat: THREE.ShaderMaterial } | null {
  const riv = cfg.river
  if (!riv) return null
  const half = islandHalfWidth(riv.z) - 0.5 // llega al borde (jitter del corte ±1.1: puede lamer el borde — la cascada cubre la costura en +x)
  const geo = new THREE.PlaneGeometry(half * 2, riv.w * 2.7, 90, 20)
  geo.rotateX(-Math.PI / 2)
  const mat = new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true,
    uniforms: {
      uTime: sharedU.uTime,
      uDeep: { value: new THREE.Color(riv.deep) },
      uShallow: { value: new THREE.Color(riv.shallow) },
      uSunDir: { value: new THREE.Vector3(...PHASE_SKY[phase].sunDir) },
      uSunI: { value: PHASE_SKY[phase].sunI },
    },
  })
  const mesh = new THREE.Mesh(geo, mat)
  // R38: y=-0.75 — los bordes del plano se meten BAJO el lecho y las orillas
  // (el cauce sólo baja −1.25 en el centro): orilla limpia, sin terreno
  // atravesando la lámina en las vistas a distancia
  mesh.position.set(0, -0.75, riv.z)
  group.add(mesh)
  return { mat }
}
