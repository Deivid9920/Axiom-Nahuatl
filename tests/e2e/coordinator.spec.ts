import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

// R25 — E2E del panel de coordinación: grupos, membresías y progreso de sólo lectura.
// Un solo login (rate limiter: 5 intentos / 15 min por IP).
// R29 — añade: aviso de vencimiento + renovación automática en Planes. La
// suscripción se prepara y restaura por BD (mismo estilo que los seeds de R25/R26).

const DEMO_EMAIL = 'admin@axiom.mx'
const DEMO_PASSWORD = 'axiom12345'
const AUTH_DIR = 'tests/e2e/.auth'
const AUTH_FILE = `${AUTH_DIR}/coordinator-state.json`

// BD de desarrollo explícita: el runner de Playwright no carga .env del proyecto
// y la shell puede traer un DATABASE_URL exportado que apunta a otra BD.
const prismaE2E = new PrismaClient({
  datasources: { db: { url: `file:${path.resolve('db', 'custom.db')}` } },
})

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('axiom-onboarding-done', 'true')
  })
}

test.beforeAll(async ({ browser }, testInfo) => {
  testInfo.setTimeout(120000)
  fs.mkdirSync(AUTH_DIR, { recursive: true })
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await ctx.newPage()
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await page.fill('input[type="email"]', DEMO_EMAIL)
  await page.fill('input[type="password"]', DEMO_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  await ctx.storageState({ path: AUTH_FILE })
  await ctx.close()
})

test.use({ storageState: AUTH_FILE })

test('el coordinador ve la sección Coordinación y el grupo demo con progreso', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })

  // Sección Coordinación en el sidebar (visible sólo con el rol; el label puede
  // estar oculto si el sidebar está colapsado — se aserta el botón «Grupos»)
  await expect(page.locator('.sidebar-label:has-text("Coordinación")')).toBeAttached()
  await page.locator('button:has-text("Grupos")').first().click()

  // Panel: encabezado + resumen (el sidebar colapsado oculta sus spans; se aserta el contenido del panel)
  await expect(page.locator('h2:has-text("Coordinación")')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('div:has(> div:text("Miembros"))').first()).toBeVisible()

  // Grupo demo con institución y miembros (R26: el texto también existe en la
  // sección de instituciones → se acota a la tarjeta del grupo)
  await expect(page.locator('text=B1 · Inglés para Nearshoring')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.axiom-card', { hasText: 'B1 · Inglés para Nearshoring' }).locator('text=Academia Axiom Nearshoring')).toBeVisible()
  await expect(page.locator('.r25-member-row')).toHaveCount(3)
  await expect(page.locator('.r25-cefr-chip').first()).toBeVisible()
  await expect(page.locator('text=Luis Alumno')).toBeVisible()
  await expect(page.locator('text=MAESTRO').first()).toBeVisible()

  // Botón de crear grupo disponible
  await expect(page.locator('button:has-text("Crear grupo")')).toBeVisible()
})

test('crear grupo, agregar y remover miembro, eliminar grupo', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  await page.locator('button:has-text("Grupos")').first().click()
  await expect(page.locator('h2:has-text("Coordinación")')).toBeVisible({ timeout: 20000 })

  // Crear grupo
  await page.locator('button:has-text("Crear grupo")').first().click()
  await page.locator('input[placeholder*="Nombre del grupo"]').fill('Grupo E2E R25')
  await page.locator('button:has-text("Crear grupo")').last().click()
  await expect(page.locator('.axiom-card:has-text("Grupo E2E R25")')).toBeVisible({ timeout: 10000 })

  const card = page.locator('.axiom-card', { hasText: 'Grupo E2E R25' })

  // Agregar miembro por correo (alumno3 del seed)
  await card.locator('button:has-text("Agregar miembro")').click()
  await card.locator('input[type="email"]').fill('alumno3@axiom.mx')
  await card.locator('button:has-text("Agregar")').last().click()
  await expect(card.locator('.r25-member-row')).toHaveCount(1, { timeout: 10000 })
  await expect(card.locator('text=Diego Alumno')).toBeVisible()

  // Remover miembro
  await card.locator('.r25-member-row button[aria-label="Remover del grupo"]').click()
  await expect(card.locator('.r25-member-row')).toHaveCount(0, { timeout: 10000 })
  await expect(card.locator('text=Sin miembros todavía')).toBeVisible()

  // Eliminar el grupo con confirmación
  await card.locator('button[aria-label="Eliminar grupo"]').click()
  await card.locator('button:has-text("Eliminar")').click()
  await expect(page.locator('.axiom-card:has-text("Grupo E2E R25")')).toHaveCount(0, { timeout: 10000 })
})

test('R26: institución, métricas del grupo e importación masiva', async ({ page }) => {
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  await page.locator('button:has-text("Grupos")').first().click()
  await expect(page.locator('h2:has-text("Coordinación")')).toBeVisible({ timeout: 20000 })

  // Nombre único: si una corrida previa falló antes de limpiar, no colisiona
  const groupName = `Grupo E2E R26 ${Date.now().toString(36)}`

  // — Instituciones: la sección existe y el demo aparece VERIFIED
  await expect(page.locator('.r26-inst-row:has-text("Academia Axiom Nearshoring")')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('.r26-inst-row:has-text("Academia Axiom Nearshoring") .r26-status-badge.verified')).toBeVisible()

  // — Crear grupo para las pruebas de importación y métricas
  await page.locator('button:has-text("Crear grupo")').first().click()
  await page.locator('input[placeholder*="Nombre del grupo"]').fill(groupName)
  await page.locator('button:has-text("Crear grupo")').last().click()
  const card = page.locator('.axiom-card', { hasText: groupName })
  await expect(card).toBeVisible({ timeout: 10000 })

  // — Importación masiva: dos correos del seed (uno con rol explícito) + uno inexistente
  await card.locator('button:has-text("Importar")').click()
  await card.locator('.r26-bulk-area').fill('alumno1@axiom.mx\nalumno2@axiom.mx, maestro\nfantasma@axiom.mx')
  await card.locator('.r26-bulk button:has-text("Importar")').click()
  await expect(card.locator('.r26-bulk-results')).toBeVisible({ timeout: 10000 })
  await expect(card.locator('.r26-bulk-results')).toContainText('2 agregados')
  await expect(card.locator('.r26-bulk-results')).toContainText('1 con problema')
  await expect(card.locator('.r25-member-row')).toHaveCount(2, { timeout: 10000 })

  // — Métricas agregadas: engagement 0% (sin sesiones) + distribución MCER
  await card.locator('button:has-text("Métricas")').click()
  await expect(card.locator('.r26-metrics')).toBeVisible({ timeout: 10000 })
  await expect(card.locator('.r26-metrics')).toContainText('Engagement')
  await expect(card.locator('.r26-metrics')).toContainText('Distribución MCER')

  // — Limpieza: cerrar paneles y eliminar el grupo
  await card.locator('button[aria-label="Eliminar grupo"]').click()
  await card.locator('button:has-text("Eliminar")').click()
  await expect(page.locator('.axiom-card', { hasText: groupName })).toHaveCount(0, { timeout: 10000 })
})

test('R28: verificación pública del código de institución y panel de documentos', async ({ page }) => {
  // — Página pública /verificar-inst (no requiere sesión): código demo VERIFIED
  await page.goto('/verificar-inst?code=AX-INST-DEMO', { timeout: 60000 })
  await expect(page.locator('.verify-state.valid')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.verify-state.valid')).toContainText('Academia Axiom Nearshoring')
  await expect(page.locator('.verify-state.valid')).toContainText('VERIFICADA')

  // — Código inexistente → estado «Código no encontrado»
  await page.goto('/verificar-inst?code=AX-INST-NOEXISTE', { timeout: 60000 })
  await expect(page.locator('.verify-state.invalid')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.verify-state.invalid')).toContainText('Código no encontrado')

  // — Panel admin: la sección R28 «Documentos emitidos» renderiza (tabla con folios
  //   o estado vacío en BD limpia — ambas son correctas)
  await skipOnboarding(page)
  await page.goto('/', { timeout: 60000 })
  await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
  await page.locator('button:has-text("Panel")').first().click()
  await expect(page.locator('h2:has-text("Panel de administración")')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('h3:has-text("Documentos emitidos")')).toBeVisible({ timeout: 20000 })
  await expect(page.locator('.r28-docs-table, :text("Aún no se han emitido documentos con folio")').first()).toBeVisible()
  await expect(page.locator('.r28-docs-note')).toContainText('Documento revocado')
})

test('R29: aviso de vencimiento y renovación automática en Planes', async ({ page }) => {
  // — Estado: suscripción del demo a 5 días del vencimiento (nivel warning),
  //   con renovación automática activa. Si no existía, se crea (pro mensual).
  const user = await prismaE2E.user.findUnique({ where: { email: DEMO_EMAIL } })
  expect(user).not.toBeNull()
  let sub = await prismaE2E.subscription.findFirst({
    where: { userId: user!.id, status: { in: ['active', 'trialing'] } },
    orderBy: { createdAt: 'desc' },
  })
  let created = false
  if (!sub) {
    const plan = await prismaE2E.plan.findUnique({ where: { code: 'pro' } })
    expect(plan).not.toBeNull()
    sub = await prismaE2E.subscription.create({
      data: {
        userId: user!.id,
        planId: plan!.id,
        status: 'active',
        cadence: 'monthly',
        currentPeriodStart: new Date(Date.now() - 25 * 86400000),
        currentPeriodEnd: new Date(Date.now() + 5 * 86400000),
        autoRenew: true,
      },
    })
    created = true
  }
  const originalEnd = sub.currentPeriodEnd
  const originalAutoRenew = sub.autoRenew
  await prismaE2E.subscription.update({
    where: { id: sub.id },
    data: { currentPeriodEnd: new Date(Date.now() + 5 * 86400000), autoRenew: true },
  })

  try {
    await skipOnboarding(page)
    await page.goto('/', { timeout: 60000 })
    await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })
    await page.locator('button:has-text("Planes")').first().click()

    // — Franja de vencimiento (warning, con autoRenew activa → mensaje de renovación automática)
    const banner = page.locator('.r29-renewal-banner.warning')
    await expect(banner).toBeVisible({ timeout: 20000 })
    await expect(banner).toContainText('renovará automáticamente')

    // — Fila de renovación automática: activa por defecto
    const row = page.locator('.r29-autorenew-row')
    await expect(row).toBeVisible()
    const sw = row.locator('button[role="switch"]')
    await expect(sw).toHaveAttribute('aria-checked', 'true')
    await expect(row).toContainText('Al final de cada periodo')

    // — Toggle a inactiva: el mensaje de la franja pasa a renovación manual
    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'false', { timeout: 10000 })
    await expect(page.locator('.r29-renewal-banner.warning')).toContainText('vence en 5 días')
    await expect(row).toContainText('Desactivada')

    // — De vuelta a activa (estado por defecto)
    await sw.click()
    await expect(sw).toHaveAttribute('aria-checked', 'true', { timeout: 10000 })
  } finally {
    // — Restaurar el estado previo de la suscripción del demo
    await prismaE2E.subscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: originalEnd, autoRenew: originalAutoRenew },
    })
    if (created) {
      await prismaE2E.subscription.delete({ where: { id: sub.id } }).catch(() => {})
    }
  }
})

test('R30: cobro automático de la renovación + avisos por correo (ciclo de facturación)', async ({ request }) => {
  // — Secreto del cron: el runner no carga .env, se lee del archivo del proyecto
  const envFile = fs.readFileSync('.env', 'utf8')
  const cronSecret = envFile.match(/CRON_SECRET=(\S+)/)?.[1] ?? ''
  expect(cronSecret).not.toBe('')

  // — Usuario dedicado con suscripción mensual Pro VENCIDA hace 1 día y autoRenew
  //   activo: el ciclo debe cobrarla, extenderla 30 días y dejar recibo por correo.
  const plan = await prismaE2E.plan.findUnique({ where: { code: 'pro' } })
  expect(plan).not.toBeNull()
  let u = await prismaE2E.user.findUnique({ where: { email: 'r30-e2e@axiom.mx' } })
  if (!u) {
    u = await prismaE2E.user.create({
      data: { email: 'r30-e2e@axiom.mx', name: 'E2E R30', passwordHash: 'e2e-no-login', profile: { create: {} } },
    })
  }
  await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
  const sub = await prismaE2E.subscription.create({
    data: {
      userId: u!.id,
      planId: plan!.id,
      status: 'active',
      cadence: 'monthly',
      currentPeriodStart: new Date(Date.now() - 31 * 86400000),
      currentPeriodEnd: new Date(Date.now() - 1 * 86400000),
      autoRenew: true,
    },
  })

  try {
    // — Sin secreto válido → rechazado (ni cron ni admin anónimo)
    const bad = await request.post('/api/billing/cron/renewals', {
      headers: { 'x-cron-secret': 'secreto-incorrecto' },
      data: {},
    })
    expect([401, 403]).toContain(bad.status())

    // — Con el secreto del cron → el ciclo corre y cobra la renovación vencida
    const res = await request.post('/api/billing/cron/renewals', {
      headers: { 'x-cron-secret': cronSecret },
      data: {},
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.charged).toBeGreaterThanOrEqual(1)
    expect(body.scannedRenewals).toBeGreaterThanOrEqual(1)

    // — BD: suscripción extendida ~30 días desde hoy, pago succeeded y recibo
    const renewed = await prismaE2E.subscription.findUnique({ where: { id: sub.id } })
    expect(renewed!.status).toBe('active')
    const drift = Math.abs(renewed!.currentPeriodEnd.getTime() - (Date.now() + 30 * 86400000))
    expect(drift).toBeLessThan(60_000)

    const payment = await prismaE2E.payment.findFirst({ where: { userId: u!.id } })
    expect(payment).not.toBeNull()
    expect(payment!.status).toBe('succeeded')
    expect(payment!.amountMxnCents).toBe(39900) // Pro mensual

    const receipt = await prismaE2E.emailLog.findFirst({ where: { userId: u!.id, kind: 'renewal_receipt' } })
    expect(receipt).not.toBeNull()
    expect(receipt!.subject).toContain('renovación confirmada')

    // — Idempotencia del cobro: re-correr el ciclo NO genera un segundo pago
    //   (la suscripción ya no está vencida)
    const res2 = await request.post('/api/billing/cron/renewals', {
      headers: { 'x-cron-secret': cronSecret },
      data: {},
    })
    const body2 = await res2.json()
    expect(body2.ok).toBe(true)
    const paymentsAfter = await prismaE2E.payment.findMany({ where: { userId: u!.id } })
    expect(paymentsAfter).toHaveLength(1)
  } finally {
    // — Limpieza: dejar la BD demo sin residuos del E2E
    await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
  }
})

test('R31: panel de correos enviados, métricas de facturación, dunning y alta de preaprobación MP', async ({ page }) => {
  // — Estado preparado por BD: usuario dedicado con suscripción en dunning
  //   (pago pendiente con reintento agendado) y correo de fallo registrado.
  const plan = await prismaE2E.plan.findUnique({ where: { code: 'pro' } })
  expect(plan).not.toBeNull()
  let u = await prismaE2E.user.findUnique({ where: { email: 'r31-e2e@axiom.mx' } })
  if (!u) {
    u = await prismaE2E.user.create({
      data: { email: 'r31-e2e@axiom.mx', name: 'E2E R31', passwordHash: 'e2e-no-login', profile: { create: {} } },
    })
  }
  await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
  const sub = await prismaE2E.subscription.create({
    data: {
      userId: u!.id,
      planId: plan!.id,
      status: 'past_due',
      cadence: 'monthly',
      currentPeriodStart: new Date(Date.now() - 32 * 86400000),
      currentPeriodEnd: new Date(Date.now() - 2 * 86400000),
      autoRenew: true,
      renewalRetryCount: 1,
      nextRetryAt: new Date(Date.now() + 2 * 86400000),
    },
  })
  await prismaE2E.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: no pudimos procesar la renovación de tu plan Pro',
      kind: 'renewal_failed',
      body: 'Intentamos renovar tu plan Pro pero el cobro no se pudo procesar (el reintento fue rechazado); lo reintentaremos automáticamente.',
      status: 'dev_logged',
      dedupeKey: `e2e-r31:renewal_failed:retry1:${sub.id}`,
      relatedType: 'subscription',
      relatedId: sub.id,
      sentAt: new Date(),
    },
  })

  try {
    await skipOnboarding(page)
    await page.goto('/', { timeout: 60000 })
    await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })

    // — API de correos (sesión admin): devuelve el correo preparado
    const emailsApi = await page.evaluate(async () => {
      const r = await fetch('/api/admin/emails?kind=renewal_failed')
      return r.json()
    })
    expect(emailsApi.ok).toBe(true)
    const row = (emailsApi.emails as Array<{ to: string; kind: string }>).find(e => e.to === 'r31-e2e@axiom.mx')
    expect(row).toBeTruthy()
    expect(row!.kind).toBe('renewal_failed')

    // — API de métricas: dunning en curso refleja la suscripción preparada
    const metricsApi = await page.evaluate(async () => {
      const r = await fetch('/api/admin/billing-metrics')
      return r.json()
    })
    expect(metricsApi.ok).toBe(true)
    expect(metricsApi.dunning.inProgress).toBeGreaterThanOrEqual(1)
    expect(metricsApi.subscriptions.mrrMxnCents).toBeGreaterThan(0)

    // — UI del panel: secciones R31 renderizan con datos
    await page.locator('button:has-text("Panel")').first().click()
    await expect(page.locator('h2:has-text("Panel de administración")')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('h3:has-text("Facturación · ciclo de renovación")')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.r31-metrics-grid')).toBeVisible()
    await expect(page.locator('h3:has-text("Correos enviados")')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.r31-emails-table')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.r31-emails-table')).toContainText('no pudimos procesar la renovación')

    // — Filtro por tipo: la tabla muestra el correo del usuario preparado
    await page.locator('.r31-emails-select').first().selectOption('renewal_failed')
    await page.locator('.r31-emails-apply').first().click()
    await expect(page.locator('.r31-emails-table')).toContainText('r31-e2e@axiom.mx')

    // — UI de planes: fila de alta de preaprobación MP (R31-c, sólo visibilidad)
    await page.locator('button:has-text("Planes")').first().click()
    const prow = page.locator('.r31-preapproval-row')
    await expect(prow).toBeVisible({ timeout: 20000 })
    await expect(prow).toContainText('Cobro automático con Mercado Pago')
  } finally {
    // — Limpieza: dejar la BD demo sin residuos del E2E
    await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
  }
})

test('R32: ciclo manual desde el panel, cola de reintentos de correos y exportación CSV', async ({ page }) => {
  // — Estado preparado por BD: correo fallido con reintento vencido (cola R32-b).
  //   Al ejecutar el ciclo manual (R32-a) la fila debe re-enviarse (dev_logged).
  let u = await prismaE2E.user.findUnique({ where: { email: 'r32-e2e@axiom.mx' } })
  if (!u) {
    u = await prismaE2E.user.create({
      data: { email: 'r32-e2e@axiom.mx', name: 'E2E R32', passwordHash: 'e2e-no-login', profile: { create: {} } },
    })
  }
  await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
  const log = await prismaE2E.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: no pudimos procesar la renovación de tu plan Pro',
      kind: 'renewal_failed',
      body: 'Intentamos renovar tu plan Pro pero el cobro no se pudo procesar.',
      status: 'failed',
      retryCount: 1,
      nextRetryAt: new Date(Date.now() - 60 * 60000), // vencido hace 1 hora → due
      lastError: 'resend_error_500',
      dedupeKey: `e2e-r32:failed:${Date.now()}`,
    },
  })

  try {
    await skipOnboarding(page)
    await page.goto('/', { timeout: 60000 })
    await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })

    // — Panel: botón R32-a ejecuta el ciclo y muestra el resumen con contadores
    await page.locator('button:has-text("Panel")').first().click()
    await expect(page.locator('h3:has-text("Facturación · ciclo de renovación")')).toBeVisible({ timeout: 20000 })
    await page.locator('.r32-cycle-btn').click()
    await expect(page.locator('.r32-cycle-result')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.r32-cycle-result')).toContainText('Cobros:')
    await expect(page.locator('.r32-cycle-result')).toContainText('Correos reintentados: 1')

    // — La fila en cola fue re-enviada por el ciclo (dev_logged, fuera de la cola)
    const retried = await prismaE2E.emailLog.findUnique({ where: { id: log.id } })
    expect(retried).not.toBeNull()
    expect(retried!.status).toBe('dev_logged')
    expect(retried!.nextRetryAt).toBeNull()
    expect(retried!.lastError).toBeNull()

    // — R32-d: exportación CSV de correos (mismos filtros, content-type text/csv)
    const csv = await page.evaluate(async () => {
      const r = await fetch('/api/admin/emails?format=csv&kind=renewal_failed')
      return { ct: r.headers.get('content-type'), body: await r.text() }
    })
    expect(csv.ct).toContain('text/csv')
    expect(csv.body).toContain('destinatario')
    expect(csv.body).toContain('r32-e2e@axiom.mx')

    // — R32-d: exportación CSV de métricas de facturación
    const mcsv = await page.evaluate(async () => {
      const r = await fetch('/api/admin/billing-metrics?format=csv')
      return { ct: r.headers.get('content-type'), body: await r.text() }
    })
    expect(mcsv.ct).toContain('text/csv')
    expect(mcsv.body).toContain('mrr_mxn_centavos')
    expect(mcsv.body).toContain('dunning_en_curso')

    // — Botones CSV visibles (correos + métricas + auditoría R35-b)
    await expect(page.locator('.r32-csv-btn')).toHaveCount(3)
  } finally {
    // — Limpieza: dejar la BD demo sin residuos del E2E
    await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
  }
})

test('R33: cola de reintentos en el panel, reintento manual de un correo y conciliación MP', async ({ page }) => {
  // — Estado preparado por BD (usuario dedicado r33-e2e):
  //   correo A: failed con nextRetryAt a futuro → aparece en la cola R33-a y se
  //   reenvía manualmente desde la fila de cola («Enviar ahora», R33-b).
  //   correo B: failed terminal (calendario agotado, nextRetryAt null) → sólo se
  //   reenvía con el botón «Reintentar» de la tabla (R33-b).
  let u = await prismaE2E.user.findUnique({ where: { email: 'r33-e2e@axiom.mx' } })
  if (!u) {
    u = await prismaE2E.user.create({
      data: { email: 'r33-e2e@axiom.mx', name: 'E2E R33', passwordHash: 'e2e-no-login', profile: { create: {} } },
    })
  }
  await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
  const enCola = await prismaE2E.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: aviso de renovación (en cola)',
      kind: 'renewal_notice',
      body: 'Tu plan vence pronto.',
      status: 'failed',
      retryCount: 1,
      nextRetryAt: new Date(Date.now() + 30 * 60000), // a futuro → visible en la cola, no tocado por el ciclo
      lastError: 'resend_error_500',
      dedupeKey: `e2e-r33:queue:${Date.now()}`,
    },
  })
  const terminal = await prismaE2E.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: recibo de renovación (terminal)',
      kind: 'renewal_receipt',
      body: 'Renovación confirmada.',
      status: 'failed',
      retryCount: 3, // calendario 5/30/120 agotado
      nextRetryAt: null, // terminal: ya no está en la cola programada
      lastError: 'resend_error_503',
      dedupeKey: `e2e-r33:terminal:${Date.now()}`,
    },
  })

  try {
    await skipOnboarding(page)
    await page.goto('/', { timeout: 60000 })
    await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })

    // — R33-a: la cola de reintentos aparece como fila aparte en Correos enviados
    await page.locator('button:has-text("Panel")').first().click()
    await expect(page.locator('h3:has-text("Correos enviados")')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.r33-mail-queue')).toBeVisible({ timeout: 20000 })
    await expect(page.locator('.r33-mail-queue')).toContainText('Cola de reintentos')
    // La fila muestra el nombre del usuario (con fallback al correo) y el asunto
    await expect(page.locator('.r33-mail-queue')).toContainText('E2E R33')
    await expect(page.locator('.r33-mail-queue')).toContainText('Axiom: aviso de renovación (en cola)')
    await expect(page.locator('.r33-mail-queue')).toContainText('Próximo intento 2 de 3')

    // — R33-b: «Enviar ahora» desde la fila de cola reenvía el correo A
    // (acotado a SU fila: en paralelo el test R34 mantiene otra fila en cola)
    const filaColaR33 = page.locator('.r33-queue-row', { has: page.locator('text=Axiom: aviso de renovación (en cola)') })
    await filaColaR33.locator('.r33-retry-btn').click()
    // Señal UI: la fila sale de la cola tras el refresco posterior al reintento
    // (el POST es asíncrono: esperar la UI antes de asertar la BD, patrón R29)
    await expect(filaColaR33).toHaveCount(0, { timeout: 20000 })
    const retriedA = await prismaE2E.emailLog.findUnique({ where: { id: enCola.id } })
    expect(retriedA).not.toBeNull()
    expect(retriedA!.status).toBe('dev_logged')
    expect(retriedA!.nextRetryAt).toBeNull()
    expect(retriedA!.lastError).toBeNull()

    // — R33-b: el correo terminal (no está en cola) se reenvía desde la tabla
    const filaTerminal = page.locator('tr', { has: page.locator('text=Axiom: recibo de renovación (terminal)') })
    await expect(filaTerminal).toBeVisible()
    await filaTerminal.locator('.r33-retry-btn').click()
    // Señal UI: el chip de estado de la fila pasa a «Registrado (demo)»
    await expect(filaTerminal.locator('span.r31-email-status.dev_logged')).toBeVisible({ timeout: 20000 })
    const retriedB = await prismaE2E.emailLog.findUnique({ where: { id: terminal.id } })
    expect(retriedB).not.toBeNull()
    expect(retriedB!.status).toBe('dev_logged')
    expect(retriedB!.nextRetryAt).toBeNull()

    // — R33-c: conciliación MP desde Facturación (sin token → resumen dev_skip)
    await expect(page.locator('h3:has-text("Facturación · ciclo de renovación")')).toBeVisible({ timeout: 20000 })
    await page.locator('.r33-reconcile-btn').click()
    await expect(page.locator('.r33-reconcile-result')).toBeVisible({ timeout: 30000 })
    await expect(page.locator('.r33-reconcile-summary')).toContainText('Sin token de Mercado Pago')
  } finally {
    // — Limpieza: dejar la BD demo sin residuos del E2E
    await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.subscription.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.payment.deleteMany({ where: { userId: u!.id } })
  }
})

test('R34: auto-refresco de la cola, auditoría reciente del panel y API de auditoría', async ({ page }) => {
  // — Estado preparado por BD (usuario dedicado r34-e2e, paralelo-seguro):
  //   un correo failed con nextRetryAt a futuro entra en la cola; el reintento
  //   manual deja entrada emails.retried en AuditLog y la sección R34-c la
  //   muestra filtrada. El badge R34-b (auto · 30 s) acompaña a Correos enviados.
  let u = await prismaE2E.user.findUnique({ where: { email: 'r34-e2e@axiom.mx' } })
  if (!u) {
    u = await prismaE2E.user.create({
      data: { email: 'r34-e2e@axiom.mx', name: 'E2E R34', passwordHash: 'e2e-no-login', profile: { create: {} } },
    })
  }
  await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
  await prismaE2E.auditLog.deleteMany({ where: { resourceId: u!.id, action: 'emails.retried' } })
  const enCola = await prismaE2E.emailLog.create({
    data: {
      userId: u!.id,
      to: u!.email,
      subject: 'Axiom: aviso R34 (en cola)',
      kind: 'renewal_notice',
      body: 'Tu plan vence pronto.',
      status: 'failed',
      retryCount: 0,
      nextRetryAt: new Date(Date.now() + 30 * 60000),
      lastError: 'resend_error_500',
      dedupeKey: `e2e-r34:queue:${Date.now()}`,
    },
  })

  try {
    await skipOnboarding(page)
    await page.goto('/', { timeout: 60000 })
    await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })

    await page.locator('button:has-text("Panel")').first().click()
    await expect(page.locator('h3:has-text("Correos enviados")')).toBeVisible({ timeout: 20000 })

    // — R34-b: el badge de auto-refresco acompaña al título de Correos enviados
    await expect(page.locator('.r34-auto-badge')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('.r34-auto-badge')).toContainText('auto · 30 s')

    // — R34-c: la sección Auditoría reciente se renderiza en el panel
    await expect(page.locator('h3:has-text("Auditoría reciente")')).toBeVisible({ timeout: 20000 })

    // — Reintento manual (misma mecánica R33-b, acotado a MI fila paralelo-seguro)
    const miFila = page.locator('.r33-queue-row', { has: page.locator('text=Axiom: aviso R34 (en cola)') })
    await expect(miFila).toBeVisible({ timeout: 20000 })
    await miFila.locator('.r33-retry-btn').click()
    await expect(miFila).toHaveCount(0, { timeout: 20000 }) // señal UI: reenviado y refresco hecho

    // La operación quedó auditada (emails.retried con resourceId = correo)
    const audited = await prismaE2E.auditLog.findFirst({ where: { action: 'emails.retried', resourceId: enCola.id } })
    expect(audited).toBeTruthy()

    // — R34-c: el filtro por acción muestra la entrada del reintento
    await page.locator('select[aria-label="Filtrar por acción"]').selectOption('emails.retried')
    await page.locator('button:has-text("Aplicar")').last().click()
    const tablaAudit = page.locator('.r34-audit-table')
    await expect(tablaAudit).toBeVisible({ timeout: 20000 })
    await expect(tablaAudit.locator('.r34-audit-chip').first()).toContainText('Correo reintentado')

    // Filtro sin eventos (ningún E2E reparó webhooks: no hay token MP) → estado vacío
    await page.locator('select[aria-label="Filtrar por acción"]').selectOption('billing.reconcile_repair_applied')
    await page.locator('button:has-text("Aplicar")').last().click()
    await expect(page.locator('text=Sin eventos registrados para este filtro.')).toBeVisible({ timeout: 20000 })
  } finally {
    // — Limpieza: dejar la BD demo sin residuos del E2E
    await prismaE2E.emailLog.deleteMany({ where: { userId: u!.id } })
    await prismaE2E.auditLog.deleteMany({ where: { action: 'emails.retried', resourceId: enCola.id } })
  }
})

test('R35: auto-refresco de la conciliación, exportación CSV de la auditoría y puerta de firma HTTP', async ({ page }) => {
  // — Estado preparado por BD (usuario dedicado r35-e2e, paralelo-seguro):
  //   una entrada de auditoría propia para verificar el CSV con contenido.
  //   R35-a se verifica en UI (badge tras conciliar, modo dev sin token MP) y
  //   R35-c (puerta de firma a nivel HTTP) ya está cubierta por
  //   tests/unit/mp-signature-http.test.ts (ambos proyectos).
  let u = await prismaE2E.user.findUnique({ where: { email: 'r35-e2e@axiom.mx' } })
  if (!u) {
    u = await prismaE2E.user.create({
      data: { email: 'r35-e2e@axiom.mx', name: 'E2E R35', passwordHash: 'e2e-no-login', profile: { create: {} } },
    })
  }
  const marca = `r35-e2e-${Date.now()}`
  await prismaE2E.auditLog.deleteMany({ where: { resourceId: { startsWith: 'r35-e2e-' } } })
  const entrada = await prismaE2E.auditLog.create({
    data: {
      userId: u!.id,
      action: 'billing.reconcile_run',
      resourceType: 'reconcile',
      resourceId: marca,
      metadataJson: JSON.stringify({ mode: 'dev_skip', checked: 0, matched: 0, statusMismatch: 0, unresolved: 0 }),
    },
  })

  try {
    await skipOnboarding(page)
    await page.goto('/', { timeout: 60000 })
    await expect(page.locator('.axiom-hello')).toBeVisible({ timeout: 30000 })

    await page.locator('button:has-text("Panel")').first().click()
    await expect(page.locator('h3:has-text("Auditoría reciente")')).toBeVisible({ timeout: 20000 })

    // — R35-b: botón CSV de la auditoría visible (3.er botón CSV del panel)
    const btnAuditCsv = page.locator('button[aria-label="Exportar auditoría reciente como CSV"]')
    await expect(btnAuditCsv).toBeVisible({ timeout: 20000 })

    // — R35-b: el CSV de auditoría lleva BOM (bytes EF BB BF: r.text() lo consume
    // por spec, se verifican los bytes crudos), cabeceras propias y MI entrada
    const acsv = await page.evaluate(async () => {
      const r = await fetch(`/api/admin/audit?format=csv&actions=billing.reconcile_run&limit=100`)
      const buf = await r.arrayBuffer()
      const b = new Uint8Array(buf.slice(0, 3))
      return {
        ct: r.headers.get('content-type'),
        bom: b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf,
        body: new TextDecoder('utf-8').decode(buf),
      }
    })
    expect(acsv.ct).toContain('text/csv')
    expect(acsv.bom).toBe(true) // BOM para Excel
    expect(acsv.body).toContain('fecha,accion,usuario,correo,tipo_recurso,recurso_id,metadatos')
    expect(acsv.body).toContain(marca)
    expect(acsv.body).toContain('billing.reconcile_run')

    // — R35-a: al conciliar (dev sin token → dev_skip) aparece el badge auto · 30 s
    await page.locator('button[aria-label="Conciliar pagos de Mercado Pago con los registros internos"]').click()
    const resultado = page.locator('.r33-reconcile-result')
    await expect(resultado).toBeVisible({ timeout: 20000 })
    await expect(resultado.locator('.r35-auto-badge')).toContainText('auto · 30 s')
    await expect(resultado).toContainText('Sin token de Mercado Pago')
  } finally {
    // — Limpieza: dejar la BD demo sin residuos del E2E
    await prismaE2E.auditLog.deleteMany({ where: { id: entrada.id } })
  }
})
