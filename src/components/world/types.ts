// R36 — tipos compartidos del mundo 3D. D3Node es el contrato entre la app
// (progreso de lecciones) y el gráfico (estructuras físicas sobre el camino).
// R38 — los 5 estados del PDF maestro son representables: bloqueado,
// disponible (desbloqueado en espera), actual (en curso), completado y
// evaluación final (bandera `final`, que combina su propio estado). La app
// hoy envía done/current/locked; 'available' queda listo sin cambiar la
// lógica de desbloqueo (restricción R36–R44).
import type * as THREE from 'three'

export interface D3Node {
  id: string
  title: string
  state: 'done' | 'current' | 'available' | 'locked'
  final?: boolean
}

// Punto de copa registrado por buildTrees: origen del nacimiento de las hojas
export interface CrownPoint { x: number; y: number; z: number; r: number }

// Bolsa de piezas compartidas entre builders (grupo del mundo, copas, área de
// nacimiento de hojas y el muestreador de altura del terreno)
export interface WorldParts {
  group: THREE.Group
  crowns: CrownPoint[]
  leafSpawnArea: { minX: number; maxX: number; zNear: number; zFar: number }
  groundAt: (x: number, z: number) => number
}
