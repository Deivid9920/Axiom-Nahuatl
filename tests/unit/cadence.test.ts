// R24 — regresión: resolución de plan + cadence desde el monto del pago.
// Bug original: el webhook buscaba plan por priceMxn === amount, así que un pago anual
// (amount = mensual × 10) no encontraba plan (plan_not_found → ok:false), y los pagos
// mensuales creaban suscripciones con cadence 'monthly' hardcodeada aunque fuera anual.
// R28 — proration mensual→anual: computeAnnualBonusDays acredita los días restantes
// del ciclo mensual al nuevo periodo anual (tope 31 días).
import { describe, it, expect } from 'vitest'
import { resolvePlanAndCadence, ANNUAL_ANCHORS, PLAN_CONFIG, computeAnnualBonusDays, ANNUAL_BONUS_CAP_DAYS, computeRenewalAnchor, computeRenewalNotice, RENEWAL_NOTICE_THRESHOLDS } from '@/lib/billing/plans'

describe('resolvePlanAndCadence (R24)', () => {
  const MONTHLY: Record<string, number> = {
    basico: 19900, pro: 39900, equipo: 149000, enterprise: 590000,
  }
  const ANNUAL: Record<string, number> = Object.fromEntries(
    Object.entries(MONTHLY).map(([k, v]) => [k, v * 10]),
  )

  it('los 4 montos mensuales resuelven su plan con cadence monthly', () => {
    for (const [code, amount] of Object.entries(MONTHLY)) {
      const r = resolvePlanAndCadence(amount, 'monthly')
      expect(r).toEqual({ planCode: code, cadence: 'monthly' })
    }
  })

  it('los 4 montos anuales (×10) resuelven su plan con cadence annual — antes caían en plan_not_found', () => {
    for (const [code, amount] of Object.entries(ANNUAL)) {
      const r = resolvePlanAndCadence(amount, 'annual')
      expect(r).toEqual({ planCode: code, cadence: 'annual' })
    }
  })

  it('respeta la cadence persistida en el Payment (fuente de verdad R24)', () => {
    // Equipo anual: 1490000 centavos
    expect(resolvePlanAndCadence(1490000, 'annual')).toEqual({ planCode: 'equipo', cadence: 'annual' })
    // Enterprise anual: 5900000 centavos (ancla «Desde $59,000/año»)
    expect(resolvePlanAndCadence(5900000, 'annual')).toEqual({ planCode: 'enterprise', cadence: 'annual' })
  })

  it('infiere la cadence por monto para pagos legacy sin cadence persistida', () => {
    expect(resolvePlanAndCadence(199000, null)).toEqual({ planCode: 'basico', cadence: 'annual' })
    expect(resolvePlanAndCadence(39900, undefined)).toEqual({ planCode: 'pro', cadence: 'monthly' })
    expect(resolvePlanAndCadence(1490000, '')).toEqual({ planCode: 'equipo', cadence: 'annual' })
  })

  it('recupera el plan aunque la cadence persistida sea incoherente con el monto', () => {
    // Payment marcado 'annual' pero monto mensual → primer intento falla, segundo acierta
    expect(resolvePlanAndCadence(39900, 'annual')).toEqual({ planCode: 'pro', cadence: 'monthly' })
    // Payment marcado 'monthly' pero monto anual → fallback a annual
    expect(resolvePlanAndCadence(199000, 'monthly')).toEqual({ planCode: 'basico', cadence: 'annual' })
  })

  it('devuelve null para montos desconocidos (cotizaciones a medida fuera de catálogo)', () => {
    expect(resolvePlanAndCadence(12345)).toBeNull()
    expect(resolvePlanAndCadence(0)).toBeNull()
  })

  it('anclas anuales R24 = precio mensual × 10 (2 meses gratis)', () => {
    expect(ANNUAL_ANCHORS.basico).toBe(199000)      // $1,990/año
    expect(ANNUAL_ANCHORS.pro).toBe(399000)         // $3,990/año
    expect(ANNUAL_ANCHORS.equipo).toBe(1490000)     // $14,900/año
    expect(ANNUAL_ANCHORS.enterprise).toBe(5900000) // Desde $59,000/año
    for (const [code, cfg] of Object.entries(PLAN_CONFIG)) {
      expect(ANNUAL_ANCHORS[code as keyof typeof ANNUAL_ANCHORS]).toBe(cfg.priceMxnCents * 10)
    }
  })
})

describe('computeAnnualBonusDays (R28 — proration mensual→anual)', () => {
  const NOW = new Date('2026-10-09T12:00:00.000Z')
  const inDays = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000)

  it('sin suscripción previa → 0 días de crédito', () => {
    expect(computeAnnualBonusDays({ previousPeriodEnd: null, previousCadence: 'monthly', now: NOW })).toBe(0)
    expect(computeAnnualBonusDays({ previousPeriodEnd: undefined, previousCadence: 'monthly', now: NOW })).toBe(0)
    expect(computeAnnualBonusDays({ now: NOW })).toBe(0)
  })

  it('suscripción previa anual (renovación) → 0 días de crédito', () => {
    expect(computeAnnualBonusDays({ previousPeriodEnd: inDays(200), previousCadence: 'annual', now: NOW })).toBe(0)
  })

  it('ciclo mensual ya expirado → 0 días de crédito', () => {
    expect(computeAnnualBonusDays({ previousPeriodEnd: inDays(-1), previousCadence: 'monthly', now: NOW })).toBe(0)
    expect(computeAnnualBonusDays({ previousPeriodEnd: NOW, previousCadence: 'monthly', now: NOW })).toBe(0)
  })

  it('acredita los días restantes del ciclo mensual (redondeo hacia arriba)', () => {
    expect(computeAnnualBonusDays({ previousPeriodEnd: inDays(10), previousCadence: 'monthly', now: NOW })).toBe(10)
    // 9.5 días restantes → 10 (se acredita el día parcial)
    expect(computeAnnualBonusDays({ previousPeriodEnd: new Date(NOW.getTime() + 9.5 * 86400000), previousCadence: 'monthly', now: NOW })).toBe(10)
    // 1 día restante
    expect(computeAnnualBonusDays({ previousPeriodEnd: inDays(1), previousCadence: 'monthly', now: NOW })).toBe(1)
  })

  it('acepta fechas en ISO string (formato API)', () => {
    expect(computeAnnualBonusDays({ previousPeriodEnd: inDays(7).toISOString(), previousCadence: 'monthly', now: NOW })).toBe(7)
  })

  it(`tope de crédito: ${ANNUAL_BONUS_CAP_DAYS} días (31)`, () => {
    expect(ANNUAL_BONUS_CAP_DAYS).toBe(31)
    expect(computeAnnualBonusDays({ previousPeriodEnd: inDays(45), previousCadence: 'monthly', now: NOW })).toBe(31)
  })

  it('fecha inválida → 0 (defensivo)', () => {
    expect(computeAnnualBonusDays({ previousPeriodEnd: 'no-es-fecha', previousCadence: 'monthly', now: NOW })).toBe(0)
  })
})

describe('computeRenewalAnchor (R29-a anual + R30-c mensual — renovación al fin del periodo vigente)', () => {
  const NOW = new Date('2026-10-09T12:00:00.000Z')
  const inDays = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000)

  it('sin suscripción previa → el periodo arranca ahora', () => {
    expect(computeRenewalAnchor({ cadence: 'annual', currentPeriodEnd: null, currentCadence: null, now: NOW })).toEqual(NOW)
    expect(computeRenewalAnchor({ cadence: 'annual', now: NOW })).toEqual(NOW)
  })

  it('renovación anual vigente → el nuevo ciclo arranca al fin del periodo actual (no se pierden días pagados)', () => {
    const end = inDays(200)
    expect(computeRenewalAnchor({ cadence: 'annual', currentPeriodEnd: end, currentCadence: 'annual', now: NOW })).toEqual(end)
    // Antes: 365 días desde el pago (los 200 días restantes se perdían)
  })

  it('suscripción anual ya expirada → arranca ahora', () => {
    expect(computeRenewalAnchor({ cadence: 'annual', currentPeriodEnd: inDays(-1), currentCadence: 'annual', now: NOW })).toEqual(NOW)
    expect(computeRenewalAnchor({ cadence: 'annual', currentPeriodEnd: NOW, currentCadence: 'annual', now: NOW })).toEqual(NOW)
  })

  it('pago mensual sobre suscripción de otra cadence → arranca ahora', () => {
    expect(computeRenewalAnchor({ cadence: 'monthly', currentPeriodEnd: inDays(200), currentCadence: 'annual', now: NOW })).toEqual(NOW)
  })

  it('R30-c — renovación mensual vigente → el nuevo ciclo arranca al fin del periodo actual (antes: siempre ahora)', () => {
    const end = inDays(10)
    expect(computeRenewalAnchor({ cadence: 'monthly', currentPeriodEnd: end, currentCadence: 'monthly', now: NOW })).toEqual(end)
    // R29: este caso devolvía NOW; R30-c extiende el ancla a la renovación mensual
  })

  it('R30-c — guard por plan: mismo monto/cadence pero plan distinto (upgrade) → arranca ahora', () => {
    const end = inDays(10)
    expect(computeRenewalAnchor({
      cadence: 'monthly', currentPeriodEnd: end, currentCadence: 'monthly',
      currentPlanId: 'plan_basico', newPlanId: 'plan_pro', now: NOW,
    })).toEqual(NOW)
    // mismo plan → ancla al fin vigente
    expect(computeRenewalAnchor({
      cadence: 'monthly', currentPeriodEnd: end, currentCadence: 'monthly',
      currentPlanId: 'plan_pro', newPlanId: 'plan_pro', now: NOW,
    })).toEqual(end)
    // ids desconocidos (null) → no bloquea el ancla (comportamiento R29)
    expect(computeRenewalAnchor({
      cadence: 'monthly', currentPeriodEnd: end, currentCadence: 'monthly',
      currentPlanId: null, newPlanId: null, now: NOW,
    })).toEqual(end)
  })

  it('suscripción mensual vigente + pago anual → arranca ahora (el crédito lo maneja la proration R28)', () => {
    expect(computeRenewalAnchor({ cadence: 'annual', currentPeriodEnd: inDays(10), currentCadence: 'monthly', now: NOW })).toEqual(NOW)
  })

  it('acepta fechas en ISO string (formato API)', () => {
    expect(computeRenewalAnchor({ cadence: 'annual', currentPeriodEnd: inDays(90).toISOString(), currentCadence: 'annual', now: NOW })).toEqual(inDays(90))
  })

  it('fecha inválida → arranca ahora (defensivo)', () => {
    expect(computeRenewalAnchor({ cadence: 'annual', currentPeriodEnd: 'no-es-fecha', currentCadence: 'annual', now: NOW })).toEqual(NOW)
  })
})

describe('computeRenewalNotice (R29-c — recordatorios de vencimiento)', () => {
  const NOW = new Date('2026-10-09T12:00:00.000Z')
  const inDays = (d: number) => new Date(NOW.getTime() + d * 24 * 60 * 60 * 1000)

  it('umbral none: más de 14 días no genera aviso', () => {
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(30), now: NOW }).level).toBe('none')
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(15), now: NOW }).level).toBe('none')
  })

  it(`umbral info (≤ ${RENEWAL_NOTICE_THRESHOLDS.info} días)`, () => {
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(14), now: NOW }).level).toBe('info')
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(8), now: NOW }).level).toBe('info')
  })

  it(`umbral warning (≤ ${RENEWAL_NOTICE_THRESHOLDS.warning} días)`, () => {
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(7), now: NOW }).level).toBe('warning')
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(4), now: NOW }).level).toBe('warning')
  })

  it(`umbral critical (≤ ${RENEWAL_NOTICE_THRESHOLDS.critical} días)`, () => {
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(3), now: NOW }).level).toBe('critical')
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(1), now: NOW }).level).toBe('critical')
  })

  it('periodo terminado → expired (días negativos o cero)', () => {
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(0), now: NOW }).level).toBe('expired')
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(-5), now: NOW }).level).toBe('expired')
  })

  it('sin suscripción, cancelada o fecha inválida → none', () => {
    expect(computeRenewalNotice({ currentPeriodEnd: null, now: NOW }).level).toBe('none')
    expect(computeRenewalNotice({ currentPeriodEnd: inDays(3), status: 'canceled', now: NOW }).level).toBe('none')
    expect(computeRenewalNotice({ currentPeriodEnd: 'no-es-fecha', now: NOW }).level).toBe('none')
  })

  it('daysLeft acompaña al nivel y acepta ISO string', () => {
    const r = computeRenewalNotice({ currentPeriodEnd: inDays(5).toISOString(), now: NOW })
    expect(r.daysLeft).toBe(5)
    expect(r.level).toBe('warning')
  })
})
