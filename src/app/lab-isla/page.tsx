'use client'

/*
 * R38 — LABORATORIO DE LA ISLA (sólo evidencia; fuera de la navegación).
 * Monta Landscape3D directamente con variant/fase/nodos sintéticos para
 * capturar: el corte de isla flotante en los 6 biomas, la cascada (variantes
 * 3 y 6) y los 5 estados de nodo (incluido 'available', que la app todavía
 * no envía). No toca progreso, desbloqueos ni la lógica educativa: es un
 * visor aislado del mundo 3D. Ruta sin enlaces: /lab-isla
 */

import { useState } from 'react'
import { Landscape3D } from '@/components/landscape3d'
import type { D3Node } from '@/components/landscape3d'
import type { ScenePhase } from '@/lib/world/configs'

const BIOMAS: Record<number, string> = {
  1: 'Pradera', 2: 'Otoño', 3: 'Río (cascada)', 4: 'Pinos', 5: 'Niebla', 6: 'Lago dorado (cascada)',
}
const FASES: ScenePhase[] = ['dawn', 'day', 'dusk', 'night']

// los 5 estados del PDF maestro sobre un mismo camino
const NODOS: D3Node[] = [
  { id: 'lab-1', title: 'Nodo completado', state: 'done' },
  { id: 'lab-2', title: 'Nodo en curso', state: 'current' },
  { id: 'lab-3', title: 'Nodo disponible', state: 'available' },
  { id: 'lab-4', title: 'Nodo bloqueado', state: 'locked' },
  { id: 'lab-5', title: 'Evaluación final', state: 'current', final: true },
]

export default function LabIsla() {
  const [variant, setVariant] = useState(3)
  const [phase, setPhase] = useState<ScenePhase>('day')
  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', padding: 16 }}>
      <h1 style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', margin: '0 0 8px' }}>
        Laboratorio R38 · isla de referencia (evidencia, fuera de la navegación)
      </h1>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        {[1, 2, 3, 4, 5, 6].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setVariant(v)}
            style={{
              padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: variant === v ? '2px solid #14A085' : '1px solid #d1cabc',
              background: variant === v ? '#14A085' : '#fff', color: variant === v ? '#fff' : '#444',
            }}
          >
            {v} · {BIOMAS[v]}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {FASES.map(f => (
          <button
            key={f}
            type="button"
            onClick={() => setPhase(f)}
            style={{
              padding: '3px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: phase === f ? '2px solid #e9a23b' : '1px solid #d1cabc',
              background: phase === f ? '#e9a23b' : '#fff', color: phase === f ? '#fff' : '#444',
            }}
          >
            {f}
          </button>
        ))}
      </div>
      <div style={{ height: '78vh', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.12)' }}>
        <Landscape3D variant={variant} phase={phase} nodes={NODOS} />
      </div>
    </div>
  )
}
