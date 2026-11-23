/**
 * R41 — evidencia del LÉMUR COMPAÑERO:
 *  A) /lab-isla (sólo v7): estados idle/look/run/celebrate con close-ups
 *     pilotados por __d3d (setLemurState + perchTo) y espera ACTIVA por
 *     getLemurState (el timing fijo es lotería a 2-4 fps de SwiftShader).
 *  B) APP REAL (módulo 1): lémur junto al nodo vigente, carrera sincronizada
 *     con la cámara (clic en nodo lejano) y llegada; mascota UI (canvas GLB).
 * Fase día fijada. Uso: bun scripts/r41_shots.ts <BASE> <OUT> <TAG>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const [, , BASE = 'http://localhost:3001', OUT = '/tmp/r41', TAG = 'r41'] = process.argv

interface Combo { name: string; stats: unknown }

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors: string[] = []
    page.on('console', m => { if (m.text().includes('R41-diag')) console.log('[diag]', m.text().slice(0, 400)) })
  page.on('pageerror', e => errors.push(`[paso ${step}] ${String(e)}\n${(e as Error).stack ?? ''}`))
  await page.addInitScript(() => {
    ;(Date.prototype as unknown as { getHours: () => number }).getHours = () => 12
    ;(Date.prototype as unknown as { getMinutes: () => number }).getMinutes = () => 0
    window.localStorage.setItem('axiom-onboarding-done', 'true')
  })

  const combos: Combo[] = []
  let step = 'inicio'
  const stats = async (name: string, shot?: string) => {
    step = name
    const s = await page.evaluate(() => {
      const d3d = (window as unknown as {
        __d3d?: { stats?: () => Record<string, unknown>; getLemurState?: () => string | null }
      }).__d3d
      if (!d3d?.stats) return null
      return { ...(d3d.stats() as object), lemur: d3d.getLemurState?.() ?? 'cargando' }
    })
    combos.push({ name, stats: s })
    console.log(`[${TAG}] ${name}:`, JSON.stringify(s))
    if (shot) await page.screenshot({ path: path.join(OUT, `${TAG}-${shot}.png`) })
  }
  const lemurPos = () => page.evaluate(() => {
    const d = (window as unknown as {
      __d3d?: { lemur?: () => { group: { position: { x: number; y: number; z: number } } } | null }
    }).__d3d
    const r = d?.lemur?.()
    return r ? { x: r.group.position.x, y: r.group.position.y, z: r.group.position.z } : null
  })
  // close-up 3/4 del lémur (framing ≈ 4.5 u; mide 0.82 u)
  const poseAtLemur = async (side = 1) => {
    const p = await lemurPos()
    if (!p) return
    await page.evaluate(([px, py, pz, s]) => {
      const rig = (window as unknown as {
        __d3d?: {
          controls: { target: { set: (x: number, y: number, z: number) => void } }
          camera: { position: { set: (x: number, y: number, z: number) => void }; lookAt: (t: unknown) => void }
        }
      }).__d3d
      if (!rig) return
      rig.controls.target.set(px, py + 0.4, pz)
      rig.camera.position.set(px + 1.2 * s, py + 1.25, pz + 2.2 * s)
      rig.camera.lookAt(rig.controls.target)
    }, [p.x, p.y, p.z, side])
  }
  const callLemur = (expr: string) => page.evaluate((src) => {
    const d = (window as unknown as {
      __d3d?: {
        setLemurState?: (s: string) => void
        lemur?: () => { perchTo: (p: { pos: { x: number; y: number; z: number }; yaw: number }, o?: object) => void; celebrate: () => void } | null
      }
    }).__d3d
    const [fn, arg] = src.split(':')
    if (fn === 'state') d?.setLemurState?.(arg)
    if (fn === 'celebrate') d?.lemur?.()?.celebrate()
  }, expr)
  // puesto relativo: u de curva más cercano al lémur + delta (suelo junto al camino)
  const farPerch = (delta: number) => page.evaluate((dd: number) => {
    const d = (window as unknown as {
      __d3d?: {
        lemur?: () => { group: { position: { x: number; z: number } } } | null
        curve?: { getPointAt: (u: number) => { x: number; y: number; z: number }; getTangentAt: (u: number) => { x: number; z: number } }
      }
    }).__d3d
    const c = d?.curve
    const r = d?.lemur?.()
    if (!c || !r) return null
    let bu = 0.08; let bd = Infinity
    for (let i = 1; i < 100; i++) {
      const u = i / 100
      const p = c.getPointAt(u)
      const dist = Math.hypot(p.x - r.group.position.x, p.z - r.group.position.z)
      if (dist < bd) { bd = dist; bu = u }
    }
    const u = Math.min(0.9, bu + dd)
    const p = c.getPointAt(u)
    const tan = c.getTangentAt(u)
    const pl = Math.hypot(tan.x, tan.z) || 1
    const off = -0.95
    return { pos: { x: p.x - (tan.z / pl) * off, y: 0.1, z: p.z + (tan.x / pl) * off }, yaw: Math.atan2(tan.x, tan.z) }
  }, delta)

  /* ===== A) /lab-isla: estados del lémur ===== */
  await page.goto(`${BASE}/lab-isla`, { timeout: 90000 })
  await page.locator('.landscape3d.d3d-on').waitFor({ timeout: 60000 })
  // el rig es asíncrono (GLB): espera activa a que exista
  await page.waitForFunction(
    () => (window as unknown as { __d3d?: { getLemurState?: () => string | null } }).__d3d?.getLemurState?.() != null,
    null, { timeout: 30000 },
  ).catch(() => console.log(`[${TAG}] lémur no cargó en 30 s`))
  await page.waitForTimeout(2800) // posado inicial + cámara al nodo vigente

  await stats('lab-follow', 'lab-follow') // plano general: isla + lémur junto al nodo
  await poseAtLemur(1)
  await page.waitForTimeout(900)
  await stats('lab-idle', 'lab-idle')

  await callLemur('state:look')
  await page.waitForTimeout(950)
  await poseAtLemur(1)
  await page.waitForTimeout(350)
  await stats('lab-look', 'lab-look')

  // run: carrera a un puesto cercano (+0.10 de curva ≈ 12 u — llegada ≈ 2.45 s
  // de juego; con distancias largas el speed-cap 4.6 no llega ni en 60 s a
  // 1-2 fps de SwiftShader) — captura EN CARRERA y llegada
  const fp = await farPerch(0.10)
  await page.evaluate((p: { pos: { x: number; y: number; z: number }; yaw: number }) => {
    const d = (window as unknown as {
      __d3d?: { lemur?: () => { perchTo: (p: { pos: { x: number; y: number; z: number }; yaw: number }, o?: object) => void } | null }
    }).__d3d
    d?.lemur?.()?.perchTo({ pos: p.pos, yaw: p.yaw }, { dur: 2.6 })
  }, { pos: fp!.pos, yaw: fp!.yaw })
  const waitState = (s: string, timeout = 9000) => page.waitForFunction(
    (st: string) => (window as unknown as { __d3d?: { getLemurState?: () => string | null } }).__d3d?.getLemurState?.() === st,
    s, { timeout },
  ).catch(() => console.log(`[${TAG}] fase ${s} no observada (timing)`))
  await waitState('run')
  await page.waitForTimeout(520) // mitad de la carrera, clip run visible
  await poseAtLemur(1)
  await page.waitForTimeout(250)
  await stats('lab-run', 'lab-run')
  // llegada REAL a idle (SwiftShader: dt cap 0.05 → el tiempo de juego corre
  // al ~10% del real; un timeout fijo es lotería) — espera activa
  await waitState('idle', 60000)
  await poseAtLemur(1)
  await page.waitForTimeout(250)
  await stats('lab-arrived', 'lab-arrived')

  // celebrate: AttackMelee (brazo alzado) + saltitos — captura en el pico
  await callLemur('celebrate')
  await waitState('celebrate', 15000)
  await page.waitForTimeout(620)
  await poseAtLemur(1)
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
  await page.waitForFunction(
    () => (window as unknown as { __d3d?: { getLemurState?: () => string | null } }).__d3d?.getLemurState?.() != null,
    null, { timeout: 30000 },
  ).catch(() => {})
  await page.waitForTimeout(3200) // vuelo de cámara inicial + lémur posado

  await stats('app-follow', 'app-follow')

  // mascota UI (canvas GLB del lémur) — recorte del widget
  const mascot = page.locator('.mascota').first()
  if (await mascot.count()) {
    await page.waitForTimeout(1200) // idle clip asentado
    await mascot.screenshot({ path: path.join(OUT, `${TAG}-mascota.png`) })
  }

  // clic en el nodo más lejano visible → carrera sincronizada con la cámara
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
    await page.waitForTimeout(750)
    await stats('app-run', 'app-run') // cámara y lémur moviéndose sincronizados
    await waitState('idle', 60000) // llegada real del compañero al nodo
    await stats('app-arrived', 'app-arrived')
  }

  fs.writeFileSync(path.join(OUT, `${TAG}-stats.json`), JSON.stringify(combos, null, 2))
  if (errors.length) { console.error(`[${TAG}] PAGEERROR:`, errors); process.exitCode = 1 }
  await browser.close()
}

main().catch(e => { console.error(e); process.exit(1) })
