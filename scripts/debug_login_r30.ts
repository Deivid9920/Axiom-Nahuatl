import { chromium } from '@playwright/test'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('/home/z/my-project/axiom-v7-extracted/db', 'custom.db')}` } },
})

async function main() {
  const demo = await prisma.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  console.log('demo user:', demo?.id)
  const subs = await prisma.subscription.findMany({ where: { userId: demo?.id }, orderBy: { createdAt: 'desc' } })
  for (const s of subs) console.log('sub:', s.status, s.cadence, s.autoRenew, s.currentPeriodEnd.toISOString())
  const roles = await prisma.userRole.findMany({ where: { userId: demo?.id }, include: { role: true } })
  console.log('roles:', roles.map(r => r.role?.name ?? r.roleId))

  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })
  page.on('console', m => { if (m.type() === 'error') console.log('console.error:', m.text().slice(0, 200)) })
  page.on('response', r => { if (r.url().includes('login') || r.url().includes('auth')) console.log('response:', r.status(), r.url()) })
  await page.goto('http://localhost:3000/', { timeout: 60000 })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: '/tmp/debug-0.png' })
  console.log('initial title:', await page.title())
  console.log('email input visible:', await page.locator('input[type="email"]').isVisible().catch(() => false))
  console.log('hello visible:', await page.locator('.axiom-hello').isVisible().catch(() => false))
  await page.fill('input[type="email"]', 'admin@axiom.mx')
  await page.fill('input[type="password"]', 'axiom12345')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(6000)
  await page.screenshot({ path: '/tmp/debug-1.png' })
  console.log('after submit — hello visible:', await page.locator('.axiom-hello').isVisible().catch(() => false))
  console.log('body snippet:', (await page.locator('body').textContent())?.slice(0, 300)?.replace(/\s+/g, ' '))
  await browser.close()
  await prisma.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
