/**
 * R32 — Evidencia: ciclo manual desde el panel (R32-a), cola de reintentos de
 * correos (R32-b) y exportación CSV de correos/métricas (R32-d).
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true).
 * Genera en <OUT>:
 *   01-ciclo-manual.png    — panel admin: botón «Ejecutar ciclo ahora» + resumen del ciclo
 *   02-csv-botones.png     — panel admin: botones «Exportar CSV» (correos + métricas)
 *   03-csv-descargado.png  — el CSV de correos descargado y su contenido en consola
 * Aserciones: el ciclo manual ejecuta y muestra contadores, la fila en cola de
 * reintentos pasa a dev_logged, los CSV responden text/csv con las cabeceras nuevas.
 * Uso: env -u DATABASE_URL bun scripts/r32_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r32'] = process.argv

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('db', 'custom.db')}` } },
})

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
    acceptDownloads: true,
  })
  const page = await ctx.newPage()
  const errors: string[] = []
  page.on('pageerror', e => errors.push(String(e)))
  await page.addInitScript(() => { window.localStorage.setItem('axiom-onboarding-done', 'true') })

  await page.goto(`${BASE}/`, { timeout: 90000 })
  const hello = page.locator('.axiom-hello')
  try {
    await hello.waitFor({ timeout: 8000 })
  } catch {
    await page.fill('input[type="email"]', 'admin@axiom.mx')
    await page.fill('input[type="password"]', 'axiom12345')
    await page.click('button[type="submit"]')
    await hello.waitFor({ timeout: 60000 })
  }
  console.log('[r32] login ok')

  // ------------------------------------------------ Preparación: correo en cola (R32-b)
  let u = await prisma.user.findUnique({ where: { email: 'r32-evid@axiom.mx' } })
  if (!u) {
    u = await prisma.user.create({
      data: { email: 'r32-evid@axiom.mx', name: 'Evidencia R32', passwordHash: 'evid-no-login', profile: { create: {} } },
    })
  }
  await prisma.emailLog.deleteMany({ where: { userId: u!.id } })
  await prisma.subscription.deleteMany({ where: { userId: u!.id } })
  await prisma.payment.deleteMany({ where: { userId: u!.id } })
  const queued = await prisma.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: no pudimos procesar la renovación de tu plan Pro',
      kind: 'renewal_failed',
      body: 'Intentamos renovar tu plan Pro pero el cobro no se pudo procesar (el reintento fue rechazado); lo reintentaremos automáticamente.',
      status: 'failed',
      retryCount: 1,
      nextRetryAt: new Date(Date.now() - 60 * 60000), // vencido hace 1 h → due
      lastError: 'resend_error_500',
      dedupeKey: `evid-r32:failed:${Date.now()}`,
    },
  })
  console.log('[r32] correo en cola preparado:', queued.id)

  // ------------------------------------------------ R32-a: ciclo manual desde el panel
  await page.locator('button:has-text("Panel")').first().click()
  const metricsHeading = page.locator('h3:has-text("Facturación · ciclo de renovación")')
  await metricsHeading.waitFor({ timeout: 30000 })
  const grid = page.locator('.r31-metrics-grid')
  await grid.waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)

  await page.locator('.r32-cycle-btn').click()
  const result = page.locator('.r32-cycle-result')
  await result.waitFor({ timeout: 30000 })
  const resultText = await result.textContent()
  console.log('[r32] resultado del ciclo:', resultText?.trim())
  if (!resultText?.includes('Cobros:')) throw new Error('el resumen del ciclo no apareció')
  if (!resultText?.includes('Correos reintentados: 1')) throw new Error('la cola de reintentos no se procesó (esperado 1)')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/01-ciclo-manual.png`, fullPage: false })
  console.log('[r32] captura 01-ciclo-manual.png')

  // La fila en cola fue re-enviada por el ciclo (dev_logged, fuera de la cola)
  const retried = await prisma.emailLog.findUnique({ where: { id: queued.id } })
  if (!retried || retried.status !== 'dev_logged' || retried.nextRetryAt !== null) {
    throw new Error(`la fila no fue reenviada: status=${retried?.status} nextRetryAt=${retried?.nextRetryAt}`)
  }
  console.log('[r32] fila en cola reenviada (dev_logged, nextRetryAt null) ✔')

  // ------------------------------------------------ R32-d: botones CSV en el panel
  await page.locator('h3:has-text("Correos enviados")').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/02-csv-botones.png`, fullPage: false })
  console.log('[r32] captura 02-csv-botones.png')

  // Descarga real del CSV de correos (botón «Exportar CSV» de la sección)
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.locator('.r32-csv-btn').first().click(),
  ])
  const csvPath = `${OUT}/correos-descargados.csv`
  await download.saveAs(csvPath)
  const csvBody = fs.readFileSync(csvPath, 'utf8')
  console.log('[r32] CSV descargado como', download.suggestedFilename())
  console.log('[r32] cabecera CSV:', csvBody.split('\r\n')[0])
  if (!csvBody.includes('destinatario')) throw new Error('el CSV descargado no trae la cabecera esperada')
  await page.screenshot({ path: `${OUT}/03-csv-descargado.png`, fullPage: false })
  console.log('[r32] captura 03-csv-descargado.png')

  // CSV de métricas vía API (verificación de cabeceras/valores R32-d)
  const mcsv = await page.evaluate(async () => {
    const r = await fetch('/api/admin/billing-metrics?format=csv')
    return { ct: r.headers.get('content-type'), body: await r.text() }
  })
  if (!mcsv.ct?.includes('text/csv')) throw new Error('billing-metrics CSV sin content-type text/csv')
  console.log('[r32] métricas CSV filas:', mcsv.body.trim().split('\n').length, '| mrr presente:', mcsv.body.includes('mrr_mxn_centavos'))

  if (errors.length > 0) {
    console.error('[r32] pageerror:', errors)
    process.exitCode = 1
  }

  // Limpieza: dejar la BD demo sin residuos de la evidencia
  await prisma.emailLog.deleteMany({ where: { userId: u!.id } })
  await prisma.subscription.deleteMany({ where: { userId: u!.id } })
  await prisma.payment.deleteMany({ where: { userId: u!.id } })
  await browser.close()
  console.log('[r32] evidencia completa ✔')
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
