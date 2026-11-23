/**
 * R38 — evidencia de la isla vía /lab-isla: capturas por bioma (world view),
 * cascada de cerca (variantes 3/6) y los 5 estados de nodo. Fase y variante
 * se eligen con los botones del laboratorio; la cámara se controla con
 * __d3d (setMode + pose manual para el close del salto).
 * Uso: bun scripts/r38_isla_shots.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3001', OUT = '/tmp/r38isla', TAG = 'isla'] = process.argv

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.addInitScript(() => {
    ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
    ;(Date.prototype as unknown as { getMinutes: () => number }).getMinutes = () => 0
  })

  await page.goto(`${BASE}/lab-isla`, { timeout: 90000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
  await page.waitForTimeout(2800)

  const call = (expr: string) => page.evaluate((src) => {
    const d = (window as unknown as { __d3d?: Record<string, (a: string) => void> }).__d3d
    const [fn, arg] = src.split(':')
    d?.[fn]?.(arg)
  }, expr)
  const pose = (tx: number, ty: number, tz: number, cx: number, cy: number, cz: number) => page.evaluate(([a, b, c, d2, e, f]) => {
    const rig = (window as unknown as {
      __d3d?: { controls: { target: { set: (x: number, y: number, z: number) => void } }; camera: { position: { set: (x: number, y: number, z: number) => void }; lookAt: (t: unknown) => void } }
    }).__d3d
    if (!rig) return
    rig.controls.target.set(a, b, c)
    rig.camera.position.set(d2, e, f)
    rig.camera.lookAt(rig.controls.target)
  }, [tx, ty, tz, cx, cy, cz])
  const stats = () => page.evaluate(() => {
    const d3d = (window as unknown as { __d3d?: { stats?: () => Record<string, unknown> } }).__d3d
    return d3d?.stats?.() ?? null
  })
  const pickBiome = async (v: number, label: string) => {
    await page.getByRole('button', { name: new RegExp(`^${v} ·`) }).click()
    await page.waitForTimeout(2400)
    await call('setMode:world')
    await page.waitForTimeout(5200) // niebla convergencia + transición (SwiftShader)
    await page.screenshot({ path: path.join(OUT, `${TAG}-isla-v${v}.png`) })
    console.log(`[${TAG}] v${v} (${label}):`, JSON.stringify(await stats()))
    await call('setMode:follow')
    await page.waitForTimeout(2200)
  }

  // 1) cascada de cerca (v3 arranca por defecto en el laboratorio): cámara
  //    dentro de la isla mirando de frente a la lámina (+x), fuera de copas
  await pose(24.0, -5.5, -43, 53.0, -1.2, -26.0)
  await page.waitForTimeout(1100)
  await page.screenshot({ path: path.join(OUT, `${TAG}-cascada-v3.png`) })
  console.log(`[${TAG}] cascada v3:`, JSON.stringify(await stats()))

  // 2) los 6 biomas en vista world (isla completa)
  await pickBiome(1, 'pradera')
  await pickBiome(2, 'otoño')
  await pickBiome(3, 'río')
  await pickBiome(4, 'pinos')
  await pickBiome(5, 'niebla')
  await pickBiome(6, 'lago dorado')

  // 3) cascada del lago dorado (v6, río z=-70) de cerca
  await pose(24.0, -5.0, -75, 53.0, -1.4, -58.0)
  await page.waitForTimeout(1100)
  await page.screenshot({ path: path.join(OUT, `${TAG}-cascada-v6.png`) })

  // 4) los 5 estados: follow al nodo disponible del laboratorio (lab-3)
  await page.evaluate(() => {
    const d = (window as unknown as { __d3d?: { nodeWorld?: () => { visuals: { anchor: { x: number; y: number; z: number } }[] } } }).__d3d
    const w = d?.nodeWorld?.()
    if (w) (window as unknown as { __r38anchor?: unknown }).__r38anchor = w.visuals[2]?.anchor
  })
  const anchor = await page.evaluate(() => (window as unknown as { __r38anchor?: { x: number; y: number; z: number } }).__r38anchor)
  if (anchor) await pose(anchor.x, anchor.y, anchor.z, anchor.x - 5.5, anchor.y + 2.6, anchor.z + 7.5)
  await page.waitForTimeout(1100)
  await page.screenshot({ path: path.join(OUT, `${TAG}-estados.png`) })

  if (errors.length) { console.error(`[${TAG}] PAGEERROR:`, errors); process.exitCode = 1 }
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
