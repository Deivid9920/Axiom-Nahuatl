// R30-a — disparador del ciclo de renovación automática (para scheduler/cron).
// Autenticación (una de las dos):
//   · Header x-cron-secret === process.env.CRON_SECRET (para schedulers externos)
//   · Sesión admin con el permiso admin.plans.write (disparo manual desde el panel)
// Si CRON_SECRET no está configurado, sólo la vía admin está disponible.
// En desarrollo (ENABLE_DEV_BILLING=true) se acepta { now } para simular la fecha
// del ciclo y poder probar vencimientos; en producción se ignora.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { runRenewalCycle } from '@/lib/billing'
import { processEmailRetries } from '@/lib/notifications/email'
import { audit } from '@/lib/observability'

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')

  let authorizedVia: 'cron_secret' | 'admin' | null = null
  if (cronSecret && provided && provided !== cronSecret) {
    // Secreto explícito pero incorrecto → rechazo inmediato, aunque haya sesión admin
    return NextResponse.json({ error: 'Secreto de cron inválido' }, { status: 401 })
  } else if (cronSecret && provided === cronSecret) {
    authorizedVia = 'cron_secret'
  } else {
    const authCheck = await requirePermission('admin.plans.write')
    if (authCheck.ok) {
      authorizedVia = 'admin'
    } else {
      return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
    }
  }

  let body: { now?: string } = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  // Override de fecha sólo en desarrollo (probar vencimientos sin esperar el reloj)
  let now: Date | undefined
  if (body.now && process.env.ENABLE_DEV_BILLING === 'true') {
    const parsed = new Date(body.now)
    if (!Number.isNaN(parsed.getTime())) now = parsed
  }

  const result = await runRenewalCycle({ now })

  // R32-b — tras el ciclo, procesa la cola de reintentos de correos fallidos
  // (backoff 5/30/120 min). Sin reintentos vencidos es un no-op barato.
  const emailRetries = await processEmailRetries({ now })

  await audit('billing.renewal_cycle_run', {
    resourceType: 'system',
    resourceId: 'billing-cron',
    metadata: { authorizedVia, ...result, emailRetries },
  })

  return NextResponse.json({ ok: true, authorizedVia, ...result, emailRetries })
}
