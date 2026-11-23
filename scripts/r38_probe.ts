import { chromium } from '@playwright/test'
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1360, height: 860 } })
const p = await ctx.newPage()
await p.goto('http://localhost:3001/lab-isla', { timeout: 90000 })
await p.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
await p.waitForTimeout(2500)
await p.evaluate(() => { (window as any).__d3d.setMode('world') })
await p.waitForTimeout(4500)
const info = await p.evaluate(() => {
  const d = (window as any).__d3d
  const c = d.camera, t = d.controls.target
  const r = document.querySelector('.landscape3d canvas')?.getBoundingClientRect()
  return {
    proj: d.getProjection(), mode: d.getMode(),
    cam: [c.position.x, c.position.y, c.position.z].map((n: number) => +n.toFixed(1)),
    target: [t.x, t.y, t.z].map((n: number) => +n.toFixed(1)),
    fov: c.fov, zoom: c.zoom,
    canvas: r ? { w: r.width, h: r.height, aspect: +(r.width / r.height).toFixed(2) } : null,
    stats: d.stats(),
  }
})
console.log(JSON.stringify(info, null, 1))
await b.close()
