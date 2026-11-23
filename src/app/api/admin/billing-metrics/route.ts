// R31-d — métricas del ciclo de facturación para el panel admin.
// GET /api/admin/billing-metrics → suscripciones por estado/plan, MRR/ARR
// normalizados, cobros de los últimos 30 días, estado del dunning (R31-b) y
// correos enviados por tipo (R31-a).
// R32-d — format=csv exporta el mismo resumen como CSV clave;valor (BOM Excel).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { PLAN_CONFIG } from '@/lib/billing'
import { type PlanCode } from '@/lib/types'

const DAY_MS = 24 * 60 * 60 * 1000

// R32-d — escape CSV estándar (comillas si hay coma/comilla/salto de línea).
function csvField(value: string | null | undefined): string {
  const v = value ?? ''
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function csvResponse(rows: (string | null)[][], filename: string): NextResponse {
  const body = '\ufeff' + rows.map(r => r.map(csvField).join(',')).join('\r\n')
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

export async function GET(req: NextRequest) {
  const format = new URL(req.url).searchParams.get('format')
  const authCheck = await requirePermission('admin.plans.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const now = new Date()
  const since30 = new Date(now.getTime() - 30 * DAY_MS)

  const subs = await db.subscription.findMany({
    where: { status: { in: ['active', 'trialing', 'past_due'] } },
    select: {
      status: true, cadence: true, planId: true,
      autoRenew: true, nextRetryAt: true, renewalRetryCount: true,
    },
  })
  const plans = await db.plan.findMany()
  const planById = new Map(plans.map(p => [p.id, p]))

  const byStatus: Record<string, number> = { active: 0, trialing: 0, past_due: 0 }
  const byPlan: Record<string, { name: string; monthly: number; annual: number }> = {}
  let mrrMxnCents = 0
  for (const s of subs) {
    byStatus[s.status] = (byStatus[s.status] || 0) + 1
    const p = planById.get(s.planId)
    const key = p?.code || 'desconocido'
    byPlan[key] ??= { name: p?.name || key, monthly: 0, annual: 0 }
    byPlan[key][s.cadence === 'annual' ? 'annual' : 'monthly']++
    // MRR normalizado: mensual = precio del plan; anual = ancla anual (×10) / 12
    const planCode = p?.code as PlanCode | undefined
    const cfg = planCode ? PLAN_CONFIG[planCode] : undefined
    if (cfg) {
      const monthlyNorm = s.cadence === 'annual'
        ? Math.round((cfg.priceMxnCents * 10) / 12)
        : cfg.priceMxnCents
      mrrMxnCents += monthlyNorm
    }
  }

  // R31-b — dunning en curso (reintento agendado) vs agotado (terminal)
  const dunning = {
    inProgress: subs.filter(s => s.status === 'past_due' && s.nextRetryAt).length,
    exhausted: subs.filter(s => s.status === 'past_due' && !s.nextRetryAt && s.renewalRetryCount > 0).length,
  }

  const payments30 = await db.payment.groupBy({
    by: ['status'],
    where: { createdAt: { gte: since30 } },
    _count: { _all: true },
    _sum: { amountMxnCents: true },
  })
  const pick = (status: string) => payments30.find(p => p.status === status)
  const renewals30d = {
    succeeded: pick('succeeded')?._count._all ?? 0,
    failed: pick('failed')?._count._all ?? 0,
    pending: pick('pending')?._count._all ?? 0,
    revenueMxnCents: pick('succeeded')?._sum.amountMxnCents ?? 0,
  }

  const emails30 = await db.emailLog.groupBy({
    by: ['kind'],
    where: { createdAt: { gte: since30 } },
    _count: { _all: true },
  })
  const emailsByKind: Record<string, number> = Object.fromEntries(emails30.map(e => [e.kind, e._count._all]))

  // R32-d — exportación CSV (resumen clave;valor)
  if (format === 'csv') {
    const rows: (string | null)[][] = [
      ['metrica', 'valor'],
      ['generado', now.toISOString()],
      ['suscripciones_activas', String(byStatus.active ?? 0)],
      ['suscripciones_trialing', String(byStatus.trialing ?? 0)],
      ['suscripciones_pago_pendiente', String(byStatus.past_due ?? 0)],
      ['renovacion_automatica_activa', String(subs.filter(s => s.autoRenew).length)],
      ['mrr_mxn_centavos', String(mrrMxnCents)],
      ['arr_mxn_centavos', String(mrrMxnCents * 12)],
      ['cobros_30d', String(renewals30d.succeeded)],
      ['cobros_fallidos_30d', String(renewals30d.failed)],
      ['cobros_pendientes_30d', String(renewals30d.pending)],
      ['ingresos_30d_mxn_centavos', String(renewals30d.revenueMxnCents)],
      ['dunning_en_curso', String(dunning.inProgress)],
      ['dunning_agotado', String(dunning.exhausted)],
      ...Object.entries(emailsByKind).map(([k, n]) => [`correos_30d_${k}`, String(n)]),
    ]
    const stamp = now.toISOString().slice(0, 10)
    return csvResponse(rows, `metricas-facturacion-${stamp}.csv`)
  }

  return NextResponse.json({
    ok: true,
    generatedAt: now.toISOString(),
    subscriptions: {
      byStatus,
      byPlan,
      autoRenewOn: subs.filter(s => s.autoRenew).length,
      mrrMxnCents,
      arrMxnCents: mrrMxnCents * 12,
    },
    renewals30d,
    dunning,
    emails30d: emailsByKind,
  })
}
