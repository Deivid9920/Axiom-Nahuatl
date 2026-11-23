import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 940, height: 700 } })
page.on('console', m => console.log('CONSOLE:', m.type(), m.text().slice(0, 300)))
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 400)))
page.on('requestfailed', r => console.log('REQFAIL:', r.url(), r.failure()?.errorText))
const resp = await page.goto('http://localhost:3000/assets/world/meadow/_preview.html?u=/assets/world/meadow/tree_broad_1.glb')
console.log('status:', resp?.status())
await page.waitForTimeout(3000)
const info = await page.evaluate(() => ({
  lbl: document.getElementById('lbl')?.textContent,
  canvases: document.querySelectorAll('canvas').length,
  scripts: document.querySelectorAll('script').length,
}))
console.log('info:', JSON.stringify(info))
await page.screenshot({ path: 'download/evidencia-r40/r40-src-broad1.png' })
await browser.close()
