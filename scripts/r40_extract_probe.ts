// @ts-nocheck — sonda de diagnóstico (fuera del paquete de entrega)
// sonda: extractParts real (sin DOM) sobre los GLB del piloto
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const extract = async (path: string) => {
  const buf = await Bun.file(new URL(path)).arrayBuffer(); const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, "", (g: any) => res(g), (e: any) => rej(e)))
  const root = gltf.scene
  root.updateMatrixWorld(true)
  const byMat = new Map<string, THREE.BufferGeometry[]>()
  const box = new THREE.Box3()
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return
    const src = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()
    src.applyMatrix4(mesh.matrixWorld)
    const matSrc = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as any
    box.expandByObject(mesh)
    const arr = byMat.get(matSrc.name) ?? []
    arr.push(src)
    byMat.set(matSrc.name, arr)
  })
  const h = Math.max(0.001, box.max.y - box.min.y)
  console.log(`\n${path.split('/').pop()}  h=${h.toFixed(2)}`)
  for (const [name, geos] of byMat) {
    let merged: THREE.BufferGeometry | null = null
    try { merged = geos.length === 1 ? geos[0] : mergeGeometries(geos) } catch (e) { console.log('  ', name, 'MERGE THROW', String(e).slice(0, 80)) }
    if (!merged) { console.log('  ', name, `geos=${geos.length} MERGE NULL`); continue }
    const b = new THREE.Box3().setFromBufferAttribute(merged.attributes.position as THREE.BufferAttribute)
    console.log(`  ${name}: geos=${geos.length} verts=${merged.attributes.position.count} y=[${b.min.y.toFixed(2)},${b.max.y.toFixed(2)}] attrs=${Object.keys(merged.attributes).join(',')}`)
  }
}
for (const f of ['tree_broad_1', 'tree_broad_2', 'tree_broad_3', 'tree_broad_4', 'tree_broad_5', 'tree_birch_1', 'tree_willow_1']) {
  await extract(`file://${process.cwd()}/public/assets/world/meadow/${f}.glb`).catch(e => console.log(f, 'ERR', String(e).slice(0, 120)))
}
