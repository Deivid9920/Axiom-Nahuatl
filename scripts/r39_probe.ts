/** R39 — sonda de diagnóstico: ¿WebGL? ¿errores de página? ¿__d3d? */
import { chromium } from '@playwright/test'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const URL = process.argv[3] ?? `${BASE}/lab-isla`

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] })
const page = await browser.newPage()
const errs: string[] = []
const logs: string[] = []
page.on('pageerror', e => errs.push(String(e)))
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`${m.type()}: ${m.text().slice(0, 200)}`) })
await page.goto(URL, { timeout: 90000 })
await page.waitForTimeout(12000)
const info = await page.evaluate(() => {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') ?? c.getContext('webgl')
  return {
    webgl: !!gl,
    unmasked: gl ? (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info')?.UNMASKED_RENDERER_WEBGL ?? '' : '',
    d3d: !!(window as unknown as { __d3d?: unknown }).__d3d,
    hasCanvas: !!document.querySelector('.landscape3d canvas'),
    d3dOn: !!document.querySelector('.landscape3d.d3d-on'),
  }
})
console.log('INFO:', JSON.stringify(info))
console.log('PAGEERRORS:', errs.length ? errs.slice(0, 5) : 'none')
console.log('CONSOLE (err/warn):', logs.length ? logs.slice(0, 8) : 'none')
await browser.close()
