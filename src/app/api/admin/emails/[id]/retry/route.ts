// R33-b — reintento manual de UN correo concreto desde el panel admin.
// POST /api/admin/emails/[id]/retry
// Re-envía inmediatamente el correo indicado con la misma entrega y contabilidad
// de la cola (retryEmailNow): en éxito la fila pasa a enviada; en fallo se
// re-agenda con el backoff vigente o queda terminal si el calendario se agotó.
// Sólo aplica a correos 'failed' (los enviados no se re-envían).
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { retryEmailNow } from '@/lib/notifications/email'
import { audit } from '@/lib/observability'

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const authCheck = await requirePermission('admin.users.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const { id } = await ctx.params
  if (!id || id.length > 40) {
    return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  }

  const result = await retryEmailNow(id)

  // Auditoría de la operación manual (éxito, re-agendado o rechazo)
  await audit('emails.retried', {
    resourceType: 'email_log',
    resourceId: id,
    metadata: {
      ok: result.ok,
      status: result.ok ? result.status : null,
      error: result.ok ? null : result.error,
      rescheduled: !result.ok && 'rescheduled' in result ? result.rescheduled ?? false : false,
      exhausted: !result.ok && 'exhausted' in result ? result.exhausted ?? false : false,
    },
  })

  if (!result.ok && (result.error === 'not_found' || result.error === 'not_retryable')) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.error === 'not_found' ? 404 : 409 },
    )
  }

  return NextResponse.json(result)
}
