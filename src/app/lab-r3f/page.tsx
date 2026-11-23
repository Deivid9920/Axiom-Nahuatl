'use client'

/*
 * R38 — PROTOTIPO R3F AISLADO (recomendación técnica: «evaluar R3F sin
 * migrar»). Ruta de laboratorio fuera de la navegación: /lab-r3f. Monta una
 * mini-isla equivalente a un recorte del diorama (discos + árboles
 * instanciados + gema animada + OrbitControls) con la MISMA escena resuelta
 * en vanilla three en src/components/world — sirve para comparar ERGONOMÍA de
 * código, bundle y draw calls, no para migrar. Decisión y datos en
 * download/evidencia-r38/.
 *
 * Qué se evalúa aquí (y se anota en la evidencia):
 *  · LOC de la misma mini-escena vs vanilla.
 *  · Bundle de la ruta (build) vs ruta vanilla.
 *  · draw calls / tris del mismo número de instancias.
 *  · Integración con React (estado → escena) y controls propios existentes.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* ── mini-escena: isla + 60 árboles instanciados + gema ─────────────── */

function Controls() {
  const { camera, gl } = useThree()
  // patrón R3F: el objeto imperativo se crea UNA vez en el inicializador de
  // estado (no durante el render de un ref) y se libera al desmontar
  const [controls] = useState(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true
    c.enablePan = false
    c.enableZoom = true
    c.maxPolarAngle = Math.PI * 0.47
    c.target.set(0, 0.5, 0)
    return c
  })
  useFrame(() => controls.update())
  useEffect(() => () => controls.dispose(), [controls])
  return null
}

function Trees({ count = 60 }: { count?: number }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  // R3F: los refs existen tras el montaje — las matrices se aplican en
  // useLayoutEffect (en useMemo los refs aún son null y las instancias
  // colapsan en el origen).
  useLayoutEffect(() => {
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 * 3.2
      const r = 4.5 + (i % 5) * 1.35
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r * 0.8
      const s = 0.8 + ((i * 37) % 10) / 12
      dummy.position.set(x, 0, z)
      dummy.rotation.set(0, i, 0)
      dummy.scale.setScalar(s)
      dummy.updateMatrix()
      trunks.current?.setMatrixAt(i, dummy.matrix)
      dummy.position.y = 2.1 * s
      dummy.updateMatrix()
      crowns.current?.setMatrixAt(i, dummy.matrix)
      const col = new THREE.Color().setHSL(0.33, 0.42, 0.32 + ((i * 13) % 7) / 40)
      crowns.current?.setColorAt(i, col)
    }
    if (trunks.current) trunks.current.instanceMatrix.needsUpdate = true
    if (crowns.current) {
      crowns.current.instanceMatrix.needsUpdate = true
      if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true
    }
  }, [count])
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, count]} castShadow>
        <cylinderGeometry args={[0.13, 0.22, 1.8, 6]} />
        <meshLambertMaterial color="#7a5230" flatShading />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, count]} castShadow>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </group>
  )
}

function Gem() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ref.current) {
      ref.current.position.y = 1.6 + Math.sin(t * 1.35) * 0.16
      ref.current.rotation.y = t * 0.8
    }
  })
  return (
    <mesh ref={ref} position={[0, 1.6, 0]}>
      <octahedronGeometry args={[0.4, 0]} />
      <meshLambertMaterial color="#f5b942" emissive="#8a5a10" flatShading />
    </mesh>
  )
}

function Island() {
  return (
    <group>
      <mesh receiveShadow>
        <cylinderGeometry args={[9, 10.5, 1.2, 10]} />
        <meshLambertMaterial color="#8fbf72" flatShading />
      </mesh>
      <mesh position={[0, -3.4, 0]}>
        <coneGeometry args={[10, 5.6, 10, 3, true]} />
        <meshLambertMaterial color="#6e6152" flatShading side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Stats({ onTick }: { onTick: (s: { calls: number; tris: number }) => void }) {
  const { gl } = useThree()
  const acc = useRef(0)
  useFrame((_, dt) => {
    acc.current += dt
    if (acc.current > 0.5) {
      acc.current = 0
      onTick({ calls: gl.info.render.calls, tris: gl.info.render.triangles })
    }
  })
  return null
}

export default function LabR3F() {
  const [stats, setStats] = useState({ calls: 0, tris: 0 })
  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ea', padding: 16 }}>
      <h1 style={{ fontSize: 15, fontWeight: 800, color: '#1f2937', margin: '0 0 4px' }}>
        Laboratorio R3F (prototipo aislado — evaluación, no migración)
      </h1>
      <p style={{ fontSize: 12, color: '#555', margin: '0 0 8px' }}>
        Mini-isla declarativa: draw calls {stats.calls} · tris {stats.tris}. Comparación y decisión en
        download/evidencia-r38. La app real NO usa R3F.
      </p>
      <div style={{ height: '76vh', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.12)' }}>
        <Canvas shadows camera={{ fov: 55, position: [0, 14, 19] }} onCreated={({ gl }) => {
          gl.toneMapping = THREE.NeutralToneMapping
          gl.setClearColor('#dcecd8')
        }}>
          <Stats onTick={setStats} />
          <hemisphereLight args={['#f2f7ec', '#6fa85a', 0.85]} />
          <directionalLight position={[8, 14, -6]} intensity={1.1} castShadow shadow-mapSize={[1024, 1024]} />
          <ambientLight intensity={0.22} />
          <Island />
          <Trees />
          <Gem />
          <Controls />
        </Canvas>
      </div>
    </div>
  )
}
