import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 940, height: 700 } })
page.on('console', m => console.log('CONSOLE:', m.text().slice(0, 200)))
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 300)))
await page.goto('http://localhost:3000/assets/world/meadow/_preview.html?u=/assets/world/meadow/tree_broad_1.glb')
await page.waitForTimeout(2500)
await page.screenshot({ path: 'download/evidencia-r40/r40-src-broad1.png' })
await browser.close()
