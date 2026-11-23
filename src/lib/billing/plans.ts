// AXIOM — Configuración de planes (módulo puro, sin BD)
// R24: extraído de billing/index.ts para que resolvePlanAndCadence sea testeable
// en aislamiento (vitest sin Prisma) y reutilizable por UI/API.

import { type PlanCode } from '@/lib/types'

export const PLAN_CONFIG: Record<PlanCode, {
  name: string
  priceMxnCents: number
  priceUsdCents: number
  features: {
    maxSessionsPerMonth: number
    maxDocuments: number
    ragEnabled: boolean
    voiceEnabled: boolean
    teamEnabled: boolean
    adminEnabled: boolean
    prioritySupport: boolean
  }
}> = {
  basico: {
    name: 'Básico',
    priceMxnCents: 19900,    // $199.00 MXN
    priceUsdCents: 1157,
    features: {
      maxSessionsPerMonth: 30,
      maxDocuments: 0,
      ragEnabled: false,
      voiceEnabled: false,
      teamEnabled: false,
      adminEnabled: false,
      prioritySupport: false,
    },
  },
  pro: {
    name: 'Pro',
    priceMxnCents: 39900,    // $399.00 MXN
    priceUsdCents: 2320,
    features: {
      maxSessionsPerMonth: 9999,  // unlimited
      maxDocuments: 50,
      ragEnabled: true,
      voiceEnabled: true,
      teamEnabled: false,
      adminEnabled: false,
      prioritySupport: false,
    },
  },
  equipo: {
    name: 'Equipo',
    priceMxnCents: 149000,   // $1,490.00 MXN (hasta 10 usuarios ≈ $149 por asiento)
    priceUsdCents: 8663,
    features: {
      maxSessionsPerMonth: 9999,
      maxDocuments: 500,
      ragEnabled: true,
      voiceEnabled: true,
      teamEnabled: true,
      adminEnabled: true,
      prioritySupport: true,
    },
  },
  enterprise: {
    name: 'Enterprise',
    priceMxnCents: 590000,   // $5,900.00 MXN+ (desde; cotización a medida)
    priceUsdCents: 34302,
    features: {
      maxSessionsPerMonth: 9999,
      maxDocuments: 9999,
      ragEnabled: true,
      voiceEnabled: true,
      teamEnabled: true,
      adminEnabled: true,
      prioritySupport: true,
    },
  },
}

// Anclas de cotización anual (R24): precio mensual × 10 = «2 meses gratis».
// Básico $1,990/año · Pro $3,990/año · Equipo $14,900/año · Enterprise desde $59,000/año.
export const ANNUAL_ANCHORS: Record<PlanCode, number> = {
  basico: PLAN_CONFIG.basico.priceMxnCents * 10,       // 199000
  pro: PLAN_CONFIG.pro.priceMxnCents * 10,             // 399000
  equipo: PLAN_CONFIG.equipo.priceMxnCents * 10,       // 1490000
  enterprise: PLAN_CONFIG.enterprise.priceMxnCents * 10, // 5900000
}

// R24 — resolver plan + cadence desde el monto del pago.
// El monto anual = precio mensual × 10 (2 meses gratis). Antes el webhook solo buscaba
// priceMxn === amount, así que TODO pago anual caía en plan_not_found, y si el plan
// se encontraba (mensual) la suscripción se creaba con cadence 'monthly' hardcodeada.
export function resolvePlanAndCadence(
  amountMxnCents: number,
  storedCadence?: string | null,
): { planCode: PlanCode; cadence: 'monthly' | 'annual' } | null {
  // Orden de intentos: primero la cadence persistida en el Payment (fuente de verdad
  // desde R24); después la inferencia por monto para pagos previos sin cadence guardada.
  const candidates: Array<'monthly' | 'annual'> =
    storedCadence === 'annual' ? ['annual', 'monthly']
    : storedCadence === 'monthly' ? ['monthly', 'annual']
    : ['monthly', 'annual']

  for (const cadence of candidates) {
    const monthlyEquiv = cadence === 'annual' ? Math.round(amountMxnCents / 10) : amountMxnCents
    const hit = (Object.entries(PLAN_CONFIG) as Array<[PlanCode, { priceMxnCents: number }]>)
      .find(([, c]) => c.priceMxnCents === monthlyEquiv)
    if (hit) return { planCode: hit[0], cadence }
  }
  return null
}

// R28 — proration mensual→anual: los días que le sobran al usuario en su ciclo
// mensual activo se suman a su nuevo periodo anual (crédito de tiempo, hasta 31
// días). Devuelve 0 si no hay suscripción mensual previa, si ya expiró o si la
// suscripción previa era anual (renovación, sin crédito).
export const ANNUAL_BONUS_CAP_DAYS = 31

export function computeAnnualBonusDays(opts: {
  previousPeriodEnd?: Date | string | null
  previousCadence?: string | null
  now?: Date
}): number {
  const now = opts.now ?? new Date()
  if (!opts.previousPeriodEnd || opts.previousCadence !== 'monthly') return 0
  const end = opts.previousPeriodEnd instanceof Date ? opts.previousPeriodEnd : new Date(opts.previousPeriodEnd)
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return 0
  const remainingDays = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  return Math.min(remainingDays, ANNUAL_BONUS_CAP_DAYS)
}

// R29-a / R30-c — ancla de renovación: cuando el pago renueva la MISMA suscripción
// (misma cadence, mismo plan si se conocen ambos ids) todavía vigente, el nuevo
// ciclo arranca al FIN del periodo actual (no se pierden los días ya pagados).
// En cualquier otro caso el periodo arranca ahora:
// · sin suscripción previa → ahora
// · pago con cadence distinta a la vigente (mensual↔anual) → ahora
//   (mensual→anual: el crédito lo maneja la proration R28)
// · upgrade a otro plan → ahora (mismo monto/cadence, plan distinto = alta nueva)
// · suscripción previa ya expirada → ahora
export function computeRenewalAnchor(opts: {
  cadence: 'monthly' | 'annual'
  currentPeriodEnd?: Date | string | null
  currentCadence?: string | null
  currentPlanId?: string | null
  newPlanId?: string | null
  now?: Date
}): Date {
  const now = opts.now ?? new Date()
  if (opts.cadence !== opts.currentCadence || !opts.currentPeriodEnd) return now
  if (opts.currentPlanId && opts.newPlanId && opts.currentPlanId !== opts.newPlanId) return now
  const end = opts.currentPeriodEnd instanceof Date ? opts.currentPeriodEnd : new Date(opts.currentPeriodEnd)
  if (Number.isNaN(end.getTime()) || end.getTime() <= now.getTime()) return now
  return end
}

// R29-c — recordatorio de vencimiento: nivel de aviso según los días que quedan
// del periodo vigente. La UI muestra la franja correspondiente y, con autoRenew
// activo, el mensaje habla de renovación automática en lugar de renovación manual.
export type RenewalLevel = 'none' | 'info' | 'warning' | 'critical' | 'expired'

export const RENEWAL_NOTICE_THRESHOLDS = { info: 14, warning: 7, critical: 3 } as const

export function computeRenewalNotice(opts: {
  currentPeriodEnd?: Date | string | null
  status?: string | null
  now?: Date
}): { daysLeft: number; level: RenewalLevel } {
  const now = opts.now ?? new Date()
  if (!opts.currentPeriodEnd || opts.status === 'canceled') return { daysLeft: 0, level: 'none' }
  const end = opts.currentPeriodEnd instanceof Date ? opts.currentPeriodEnd : new Date(opts.currentPeriodEnd)
  if (Number.isNaN(end.getTime())) return { daysLeft: 0, level: 'none' }
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  if (daysLeft <= 0) return { daysLeft: 0, level: 'expired' }
  if (daysLeft <= RENEWAL_NOTICE_THRESHOLDS.critical) return { daysLeft, level: 'critical' }
  if (daysLeft <= RENEWAL_NOTICE_THRESHOLDS.warning) return { daysLeft, level: 'warning' }
  if (daysLeft <= RENEWAL_NOTICE_THRESHOLDS.info) return { daysLeft, level: 'info' }
  return { daysLeft, level: 'none' }
}
