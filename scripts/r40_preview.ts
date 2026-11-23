import { chromium } from '@playwright/test'
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 940, height: 700 } })
for (const [name, u] of [['broad1','tree_broad_1'],['broad3','tree_broad_3'],['birch1','tree_birch_1'],['willow','tree_willow_1']]) {
  await page.goto(`http://localhost:3000/assets/world/meadow/_preview.html?u=/assets/world/meadow/${u}.glb`)
  await page.waitForTimeout(1600)
  await page.screenshot({ path: `download/evidencia-r40/r40-src-${name}.png` })
}
await browser.close()
console.log('OK')
