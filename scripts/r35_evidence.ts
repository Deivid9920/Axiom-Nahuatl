/**
 * R35 — Evidencia v7: auto-refresco de la vista de conciliación con badge
 * (R35-a) y exportación CSV de la auditoría reciente (R35-b; API + botón con
 * descarga real verificada en disco). La prueba HTTP de la ventana dual de
 * rotación (R35-c) vive en tests/unit/mp-signature-http.test.ts (ambos
 * proyectos) y se documenta en el LEEME.
 * Requiere dev server del proyecto en :3000 (con ENABLE_DEV_BILLING=true).
 * Genera en <OUT>:
 *   01-auditoria-csv-btn.png    — Auditoría reciente con botón CSV (R35-b)
 *   02-auditoria-descargada.csv — CSV descargado VÍA BOTÓN (BOM + cabeceras)
 *   03-csv-audit-btn.png        — captura tras la descarga del CSV
 *   04-conciliacion-auto.png    — conciliación con badge «auto · 30 s» (R35-a)
 * Aserciones: botón visible, CSV text/csv con BOM + cabecera + entrada propia,
 * badge R35 dentro del resultado de conciliación dev_skip.
 * Uso: env -u DATABASE_URL bun scripts/r35_evidence.ts <BASE> <OUT>
 */
import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const [, , BASE = 'http://localhost:3000', OUT = '/tmp/r35'] = process.argv

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('db', 'custom.db')}` } },
})

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
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
    await page.click('button[type="submit"]', { timeout: 20000 })
    await hello.waitFor({ timeout: 60000 })
  }
  console.log('[r35] login ok')

  // ------------------------------------------------ Preparación (entrada dedicada)
  let u = await prisma.user.findUnique({ where: { email: 'r35-evid@axiom.mx' } })
  if (!u) {
    u = await prisma.user.create({
      data: { email: 'r35-evid@axiom.mx', name: 'Evidencia R35', passwordHash: 'evid-no-login', profile: { create: {} } },
    })
  }
  const marca = `r35-evid-${Date.now()}`
  await prisma.auditLog.deleteMany({ where: { resourceId: { startsWith: 'r35-evid-' } } })
  const entrada = await prisma.auditLog.create({
    data: {
      userId: u!.id,
      action: 'billing.reconcile_run',
      resourceType: 'reconcile',
      resourceId: marca,
      metadataJson: JSON.stringify({ mode: 'dev_skip', checked: 0, matched: 0, statusMismatch: 0, unresolved: 0 }),
    },
  })
  console.log('[r35] entrada de auditoría preparada:', entrada.id)

  // ------------------------------------------------ R35-b: botón CSV de la auditoría
  await page.locator('button:has-text("Panel")').first().click({ timeout: 20000 })
  const auditHeading = page.locator('h3:has-text("Auditoría reciente")')
  await auditHeading.waitFor({ timeout: 30000 })
  const btnCsv = page.locator('button[aria-label="Exportar auditoría reciente como CSV"]')
  await btnCsv.waitFor({ timeout: 20000 })
  console.log('[r35] botón CSV de auditoría visible ✔')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/01-auditoria-csv-btn.png`, fullPage: false })
  console.log('[r35] captura 01-auditoria-csv-btn.png')

  // ------------------------------------------------ R35-b: descarga real vía botón
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    btnCsv.click(),
  ])
  const csvPath = `${OUT}/02-auditoria-descargada.csv`
  await download.saveAs(csvPath)
  const csvBody = fs.readFileSync(csvPath, 'utf8')
  console.log('[r35] CSV descargado como', download.suggestedFilename())
  console.log('[r35] cabecera CSV:', csvBody.split('\r\n')[0])
  if (csvBody.charCodeAt(0) !== 0xfeff) throw new Error('el CSV de auditoría no trae BOM')
  if (!csvBody.includes('fecha,accion,usuario,correo,tipo_recurso,recurso_id,metadatos')) throw new Error('cabecera CSV inesperada')
  if (!csvBody.includes(marca)) throw new Error('el CSV no incluye la entrada de evidencia')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/03-csv-audit-btn.png`, fullPage: false })
  console.log('[r35] captura 03-csv-audit-btn.png')

  // CSV filtrado vía API (mismas verificaciones con el filtro vigente)
  const acsv = await page.evaluate(async () => {
    const r = await fetch('/api/admin/audit?format=csv&actions=billing.reconcile_run')
    const buf = await r.arrayBuffer()
    const b = new Uint8Array(buf.slice(0, 3))
    return {
      ct: r.headers.get('content-type'),
      bom: b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf,
      body: new TextDecoder('utf-8').decode(buf),
    }
  })
  if (!acsv.ct?.includes('text/csv') || !acsv.bom) throw new Error('el CSV por API no responde text/csv con BOM')
  console.log('[r35] CSV por API (filtro reconcile_run): filas =', acsv.body.trim().split('\r\n').length)

  // ------------------------------------------------ R35-a: conciliación con badge auto · 30 s
  const metricsHeading = page.locator('h3:has-text("Facturación · ciclo de renovación")')
  await metricsHeading.scrollIntoViewIfNeeded()
  await metricsHeading.waitFor({ timeout: 20000 })
  await page.locator('.r33-reconcile-btn').click({ timeout: 20000 })
  const reconcileResult = page.locator('.r33-reconcile-result')
  await reconcileResult.waitFor({ timeout: 30000 })
  const badge35 = reconcileResult.locator('.r35-auto-badge')
  await badge35.waitFor({ timeout: 20000 })
  const badgeText = await badge35.textContent()
  console.log('[r35] badge conciliación:', badgeText?.trim())
  if (!badgeText?.includes('auto · 30 s')) throw new Error('el badge R35-a no aparece en la conciliación')
  const reconcileText = await reconcileResult.textContent()
  if (!reconcileText?.includes('Sin token de Mercado Pago')) throw new Error('la conciliación no respondió dev_skip')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/04-conciliacion-auto.png`, fullPage: false })
  console.log('[r35] captura 04-conciliacion-auto.png')

  if (errors.length > 0) {
    console.error('[r35] pageerror:', errors)
    process.exitCode = 1
  }

  // Limpieza: dejar la BD demo sin residuos de la evidencia
  await prisma.auditLog.deleteMany({ where: { resourceId: { startsWith: 'r35-evid-' } } })
  await prisma.user.delete({ where: { id: u!.id } }).catch(() => {})
  await browser.close()
  console.log('[r35] evidencia completa ✔')
}

main()
  .catch(e => { console.error(e); process.exitCode = 1 })
