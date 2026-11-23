// R38 — cascada de la isla de referencia (prototipo shader aprobado en la
// recomendación técnica, categoría 🟡): donde el río llega al borde de la isla
// el agua se vuelca en una lámina vertical con vetas animadas, espuma en el
// labio y bruma al pie (la isla flota: el agua se disuelve en el aire).
// Sólo para mundos con río (3 y 6); cero texturas, cero peticiones.
import * as THREE from 'three'
import { WATERFALL_VS, WATERFALL_FS, sharedU } from './shaders'
import { islandHalfWidth } from './terrain'
import { glowTexture } from './decor'
import { PHASE_SKY } from '@/lib/world/configs'
import type { WorldCfg, ScenePhase } from '@/lib/world/configs'

export interface Waterfall {
  mat: THREE.ShaderMaterial
  dispose: () => void
}

export function buildWaterfall(cfg: WorldCfg, phase: ScenePhase, group: THREE.Group): Waterfall | null {
  const riv = cfg.river
  if (!riv) return null

  const rimX = islandHalfWidth(riv.z)          // borde de la isla a la altura del río
  const width = riv.w * 1.9                    // un poco más ancha que el cauce (cubre el jitter del corte)
  const height = 9.5

  const geo = new THREE.PlaneGeometry(width, height, 1, 12)
  geo.rotateY(Math.PI / 2)                     // la lámina mira a ±x, avanza en z
  const mat = new THREE.ShaderMaterial({
    vertexShader: WATERFALL_VS, fragmentShader: WATERFALL_FS,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uTime: sharedU.uTime,
      uColA: { value: new THREE.Color(riv.shallow) },
      uColB: { value: new THREE.Color(riv.deep) },
      uSunI: { value: PHASE_SKY[phase].sunI },
    },
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(rimX - 0.55, -0.62 - height / 2, riv.z) // nace justo sobre la lámina (agua a −0.75)
  mesh.renderOrder = 2                         // después del agua (prueba de profundidad contra su superficie)
  group.add(mesh)

  // bruma al pie: dos destellos aditivos donde la lámina se disuelve
  const mistTex = glowTexture()
  const mistMat = new THREE.SpriteMaterial({
    map: mistTex, color: 0xdff2f6, transparent: true, opacity: 0.34,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  const mist1 = new THREE.Sprite(mistMat)
  mist1.position.set(rimX + 1.4, -height + 0.7, riv.z)
  mist1.scale.set(5.6, 2.6, 1)
  mist1.renderOrder = 3
  const mist2 = new THREE.Sprite(mistMat.clone())
  ;(mist2.material as THREE.SpriteMaterial).opacity = 0.22
  mist2.position.set(rimX + 2.4, -height - 0.6, riv.z)
  mist2.scale.set(9, 3.4, 1)
  mist2.renderOrder = 3
  group.add(mist1, mist2)

  return {
    mat,
    dispose: () => { mistTex.dispose(); mistMat.dispose(); (mist2.material as THREE.SpriteMaterial).dispose() },
  }
}
