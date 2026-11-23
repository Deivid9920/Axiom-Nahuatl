// Depuración: consola y estado del agua 3D en M3
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:3000'

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-MX' })
  const page = await ctx.newPage()
  const msgs: string[] = []
  page.on('console', m => msgs.push(`[${m.type()}] ${m.text().slice(0, 300)}`))
  page.on('pageerror', e => msgs.push('[pageerror] ' + e.message.slice(0, 300)))

  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]')
  await page.waitForSelector('.axiom-hello', { timeout: 60000 })
  const skip = page.locator('button:has-text("Saltar")')
  if (await skip.count()) { await skip.click(); await page.waitForTimeout(400) }

  const card3 = page.locator('.axiom-card', { hasText: 'Módulo 3 ·' }).first()
  await card3.click()
  await card3.locator('.module-cta').click()
  await page.waitForSelector('.scene3d-water canvas', { timeout: 15000 })
  await page.waitForTimeout(2500)

  const info = await page.evaluate(() => {
    const box = document.querySelector('.scene3d-water') as HTMLElement | null
    const cv = document.querySelector('.scene3d-water canvas') as HTMLCanvasElement | null
    const scene = document.querySelector('.path-scene') as HTMLElement | null
    const gl = cv ? (cv.getContext('webgl') || cv.getContext('experimental-webgl')) : null
    return {
      boxRect: box ? { w: box.clientWidth, h: box.clientHeight, top: box.getBoundingClientRect().top } : null,
      canvasRect: cv ? { w: cv.clientWidth, h: cv.clientHeight, wAttr: cv.width, hAttr: cv.height } : null,
      canvasVisible: cv ? getComputedStyle(cv).display : null,
      sceneClass: scene?.className,
      glOnProbe: !!gl,
    }
  })
  console.log(JSON.stringify(info, null, 1))
  console.log('--- consola (últimas 12) ---')
  msgs.slice(-12).forEach(m => console.log(m))
  await browser.close()
}

main().catch(e => { console.error('FALLO:', e); process.exit(1) })
