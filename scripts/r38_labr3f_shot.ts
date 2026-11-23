/** R38 — captura del prototipo R3F (/lab-r3f) + stats leídos del gl.info */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
const OUT = process.argv[2] ?? '/tmp/r38r3f'
fs.mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1.5 })
const p = await ctx.newPage()
const errs: string[] = []
p.on('pageerror', e => errs.push(String(e)))
await p.goto('http://localhost:3001/lab-r3f', { timeout: 90000 })
await p.waitForTimeout(4000)
await p.screenshot({ path: `${OUT}/r3f-mini-isla.png` })
const txt = await p.locator('p').first().textContent()
console.log('[r3f]', txt, '| pageerrors:', errs.length)
await b.close()
if (errs.length) process.exit(1)
