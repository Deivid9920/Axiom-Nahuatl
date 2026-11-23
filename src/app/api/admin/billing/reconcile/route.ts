// R33-c — conciliación de pagos MP vs Payment interno.
// GET — reporte de sólo lectura: consulta /v1/payments/search de Mercado Pago
// (ventana 30 días, últimas 50) y compara contra los registros Payment internos:
// coherentes, con discrepancia de estado (webhook perdido) o sin correspondencia.
// Sin token de MP (dev) responde modo dev_skip con reporte vacío.
// R34-a — POST { providerPaymentId }: acción de reparación que reprocessa el
// webhook perdido de UN pago (misma lógica del webhook real R32-c). Escrita, así
// que exige admin.plans.write (el GET de lectura sigue con admin.plans.read).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { reconcileMpPayments, repairReconciledPayment } from '@/lib/billing/reconcile'
import { audit } from '@/lib/observability'
import { z } from 'zod'

export async function GET(_req: NextRequest) {
  const authCheck = await requirePermission('admin.plans.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const result = await reconcileMpPayments()

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }

  // Auditoría de la corrida de conciliación (trazabilidad del chequeo)
  await audit('billing.reconcile_run', {
    resourceType: 'payment',
    metadata: {
      mode: result.report.mode,
      checked: result.report.checked,
      matched: result.report.matched,
      statusMismatch: result.report.statusMismatch,
      unresolved: result.report.unresolved,
    },
  })

  return NextResponse.json({ ok: true, report: result.report })
}

// R34-a — reparación de un webhook perdido detectado por la conciliación
const repairSchema = z.object({
  providerPaymentId: z.string().min(1).max(40),
})

export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('admin.plans.write')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const parsed = repairSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'providerPaymentId inválido' }, { status: 400 })
  }

  const result = await repairReconciledPayment({ providerPaymentId: parsed.data.providerPaymentId })
  return NextResponse.json({ ok: result.ok, action: result.action ?? null }, { status: result.ok ? 200 : 422 })
}
