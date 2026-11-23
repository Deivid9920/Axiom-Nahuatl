/**
 * R39 — evidencia del CUERVO COMPAÑERO:
 *  A) /lab-isla (sólo v7): los 7 estados (idle/look/walk/takeoff/fly/land/
 *     celebrate) con close-ups pilotados por __d3d (setRavenState + perchTo).
 *  B) APP REAL (módulo 1): raven posado junto al nodo vigente, vuelo
 *     sincronizado con la cámara (clic en el nodo final bloqueado = vuelo
 *     sin abrir lección) y llegada a la percha nueva. Stats por captura
 *     (delta de calls/tris contra el baseline R38: 57/17,291).
 * Fase día fijada. Uso: bun scripts/r39_shots.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3001', OUT = '/tmp/r39', TAG = 'r39'] = process.argv

interface Combo { name: string; stats: unknown }

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.addInitScript(() => {
    ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
    ;(Date.prototype as unknown as { getMinutes: () => number }).getMinutes = () => 0
    window.localStorage.setItem('axiom-onboarding-done', 'true')
  })

  const combos: Combo[] = []
  const stats = async (name: string, shot?: string) => {
    const s = await page.evaluate(() => {
      const d3d = (window as unknown as {
        __d3d?: { stats?: () => Record<string, unknown>; getRavenState?: () => string }
      }).__d3d
      if (!d3d?.stats) return null
      return { ...(d3d.stats() as object), raven: d3d.getRavenState?.() }
    })
    combos.push({ name, stats: s })
    console.log(`[${TAG}] ${name}:`, JSON.stringify(s))
    if (shot) await page.screenshot({ path: path.join(OUT, `${TAG}-${shot}.png`) })
  }
  const ravenPos = () => page.evaluate(() => {
    const d = (window as unknown as {
      __d3d?: { raven?: () => { group: { position: { x: number; y: number; z: number } } } }
    }).__d3d
    const r = d?.raven?.()
    return r ? { x: r.group.position.x, y: r.group.position.y, z: r.group.position.z } : null
  })
  // close-up 3/4 del cuervo (framing ≈ 4.9 u; el ave mide ≈ 0.9 u)
  const poseAtRaven = async (side = 1) => {
    const p = await ravenPos()
    if (!p) return
    await page.evaluate(([px, py, pz, s]) => {
      const rig = (window as unknown as {
        __d3d?: {
          controls: { target: { set: (x: number, y: number, z: number) => void } }
          camera: { position: { set: (x: number, y: number, z: number) => void }; lookAt: (t: unknown) => void }
        }
      }).__d3d
      if (!rig) return
      rig.controls.target.set(px, py + 0.45, pz)
      rig.camera.position.set(px + 1.25 * s, py + 1.35, pz + 2.3 * s)
      rig.camera.lookAt(rig.controls.target)
    }, [p.x, p.y, p.z, side])
  }
  const callRaven = (expr: string) => page.evaluate((src) => {
    const d = (window as unknown as {
      __d3d?: {
        setRavenState?: (s: string) => void
        raven?: () => { perchTo: (p: { pos: { x: number; y: number; z: number }; yaw: number }, o?: object) => void }
        curve?: { getPointAt: (u: number) => { x: number; y: number; z: number }; getTangentAt: (u: number) => { x: number; y: number; z: number } }
      }
    }).__d3d
    const [fn, arg] = src.split(':')
    if (fn === 'state') d?.setRavenState?.(arg)
  }, expr)
  // percha lejana sobre la curva (suelo junto al camino ≈ 0; ribera aplanada)
  const farPerch = (u: number) => page.evaluate((uu) => {
    const d = (window as unknown as {
      __d3d?: { curve?: { getPointAt: (u: number) => { x: number; y: number; z: number }; getTangentAt: (u: number) => { x: number; y: number; z: number } } }
    }).__d3d
    const c = d?.curve
    if (!c) return null
    const p = c.getPointAt(uu)
    const tan = c.getTangentAt(uu)
    const pl = Math.hypot(tan.x, tan.z) || 1
    const off = -0.95
    return { pos: { x: p.x - (tan.z / pl) * off, y: 0.1, z: p.z + (tan.x / pl) * off }, yaw: Math.atan2(tan.x, tan.z) }
  }, u)

  /* ===== A) /lab-isla: los 7 estados ===== */
  await page.goto(`${BASE}/lab-isla`, { timeout: 90000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
  await page.waitForTimeout(3200) // posado inicial + cámara al nodo vigente

  await poseAtRaven(1)
  await page.waitForTimeout(900)
  await stats('lab-idle', 'lab-idle')

  await callRaven('state:look')
  await page.waitForTimeout(950)
  await poseAtRaven(1)
  await page.waitForTimeout(350)
  await stats('lab-look', 'lab-look')

  // walk: percha cercana (d<2.6 → saltitos)
  await page.evaluate(() => {
    const d = (window as unknown as {
      __d3d?: { raven?: () => { perchTo: (p: { pos: { x: number; y: number; z: number }; yaw: number }, o?: object) => void; group: { position: { x: number; y: number; z: number } } } }
    }).__d3d
    const r = d?.raven?.()
    if (!r) return
    r.perchTo({ pos: { x: r.group.position.x + 1.35, y: r.group.position.y, z: r.group.position.z + 0.55 }, yaw: 0.7 })
  })
  await page.waitForTimeout(620)
  await poseAtRaven(1)
  await page.waitForTimeout(250)
  await stats('lab-walk', 'lab-walk')
  await page.waitForTimeout(1600) // termina de llegar

  // takeoff → fly → land (cadena completa, dur 2.6 s): se espera ACTIVAMENTE
  // a cada fase vía getRavenState (el timing fijo es lotería a 2-4 fps)
  const fp = await farPerch(0.85)
  await poseAtRaven(1) // el despegue ocurre en la percha actual
  await page.evaluate((p: { pos: { x: number; y: number; z: number }; yaw: number }) => {
    const d = (window as unknown as {
      __d3d?: { raven?: () => { perchTo: (p: { pos: { x: number; y: number; z: number }; yaw: number }, o?: object) => void } }
    }).__d3d
    d?.raven?.()?.perchTo({ pos: p.pos, yaw: p.yaw }, { dur: 2.6 })
  }, { pos: fp!.pos, yaw: fp!.yaw })
  const waitState = (s: string) => page.waitForFunction(
    (st: string) => (window as unknown as { __d3d?: { getRavenState?: () => string } }).__d3d?.getRavenState?.() === st,
    s, { timeout: 9000 },
  ).catch(() => console.log(`[r39] fase ${s} no observada (timing)`))
  await waitState('takeoff')
  await stats('lab-takeoff', 'lab-takeoff')
  await waitState('fly')
  await poseAtRaven(1)
  await page.waitForTimeout(220)
  await stats('lab-fly', 'lab-fly')
  await waitState('land')
  await poseAtRaven(1)
  await page.waitForTimeout(160)
  await stats('lab-land', 'lab-land')
  await page.waitForTimeout(1300) // aterrizado

  await callRaven('state:celebrate')
  await page.waitForTimeout(520)
  await poseAtRaven(1)
  await page.waitForTimeout(250)
  await stats('lab-celebrate', 'lab-celebrate')

  /* ===== B) APP REAL: integración ===== */
  await page.goto(`${BASE}/`, { timeout: 90000 })
  const hello = page.locator('.axiom-hello')
  try {
    await hello.waitFor({ timeout: 8000 })
  } catch {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]', { timeout: 20000 })
    await hello.waitFor({ timeout: 60000 })
  }
  const card = page.locator('.axiom-card', { hasText: 'Módulo 1' }).first()
  await card.waitFor({ timeout: 30000 })
  await page.waitForTimeout(600)
  await card.click()
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 45000 })
  await page.waitForTimeout(3400) // vuelo de cámara inicial + cuervo posado

  await stats('app-follow', 'app-follow')

  // clic en el nodo más lejano cuyo hit-sphere proyecte DENTRO del canvas
  // (el final puede quedar fuera de cuadro tras el banner) → vuelo sin abrir lección
  const hit = await page.evaluate(() => {
    const d = (window as unknown as {
      __d3d?: {
        nodeWorld?: () => { visuals: { anchor: { x: number; y: number; z: number } }[]; hits: { userData: { d3dId: string } }[] }
        camera: unknown
        controls: { target: { constructor: new (x: number, y: number, z: number) => { project: (c: unknown) => { x: number; y: number; z: number } } }; domElement: HTMLCanvasElement }
      }
    }).__d3d
    const w = d?.nodeWorld?.()
    if (!w || !d) return null
    const V = d.controls.target.constructor
    const r = d.controls.domElement.getBoundingClientRect()
    for (let i = w.visuals.length - 1; i >= 0; i--) {
      const v = w.visuals[i]
      const p = new V(v.anchor.x, v.anchor.y - 1.2, v.anchor.z).project(d.camera)
      const x = r.left + (p.x * 0.5 + 0.5) * r.width
      const y = r.top + (-p.y * 0.5 + 0.5) * r.height
      if (x > r.left + 12 && x < r.right - 12 && y > r.top + 12 && y < r.bottom - 12) return { x, y }
    }
    return null
  })
  if (hit) {
    await page.mouse.click(hit.x, hit.y)
    await page.waitForTimeout(700)
    await stats('app-fly', 'app-fly') // cámara y cuervo en vuelo sincronizado
    await page.waitForTimeout(2600)
    await stats('app-arrived', 'app-arrived')
  }

  fs.writeFileSync(path.join(OUT, `${TAG}-stats.json`), JSON.stringify(combos, null, 2))
  if (errors.length) { console.error(`[${TAG}] PAGEERROR:`, errors); process.exitCode = 1 }
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
