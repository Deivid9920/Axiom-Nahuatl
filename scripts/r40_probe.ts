import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 900, height: 600 } })
await page.goto('http://localhost:3000/lab-isla')
await page.waitForTimeout(2000)
await page.getByRole('button', { name: '1 · Pradera' }).click()
await page.waitForTimeout(5000)
const info = await page.evaluate(() => {
  const world = (window as any).__d3d.world
  const meshes: any[] = []
  world.traverse((o: any) => {
    if (o.isInstancedMesh) {
      const m = o.material as any
      const c = m.color ? m.color.getHexString() : '?'
      meshes.push({ kind: 'inst', count: o.count, mat: m.constructor.name, color: c, name: m.name || (m.userData?.n || ''), sway: !!m.onBeforeCompile, y: +o.geometry.boundingSphere.radius.toFixed(2), h: +(o.geometry.boundingBox?.max.y || 0).toFixed(2) })
    } else if (o.isMesh && o.isSkinnedMesh) {
      meshes.push({ kind: 'skinned', parent: o.parent.name })
    } else if (o.isMesh) {
      const m = o.material as any
      meshes.push({ kind: 'mesh', mat: m.constructor.name, color: m.color?.getHexString() })
    }
  })
  return meshes
})
const inst = info.filter(m => m.kind === 'inst')
console.log('total nodos-malla:', info.length, '| instanced:', inst.length, '| skinned:', info.filter(m => m.kind === 'skinned').length)
const agg: any = {}
for (const m of inst) { const k = m.color; agg[k] = (agg[k] || 0) + m.count }
console.log('instancias por color:', JSON.stringify(agg))
const greens = inst.filter(m => m.color === '63a652' || m.color === '4c8a44')
console.log('partes verde (copas):', greens.length, 'con counts', greens.map(g => g.count).slice(0, 12))
console.log('sample:', JSON.stringify(inst.slice(0, 10)))
await browser.close()
