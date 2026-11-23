// R34-c — vista de auditoría de las operaciones del panel.
// GET /api/admin/audit?actions=emails.retried,billing.reconcile_run&limit=20
// Devuelve las entradas recientes de AuditLog para las acciones operativas que
// el panel expone (reintento manual de correos, corridas y reparaciones de la
// conciliación). Sin `actions` usa la lista por defecto; `limit` acotado 1–100.
// R35-b — format=csv devuelve el mismo listado (mismos filtros) como archivo
// CSV con BOM para Excel (mismo patrón que la exportación de correos R32-d):
// columnas fecha/acción/usuario/correo/tipo de recurso/recurso/metadatos, con
// los metadatos crudos en JSON para auditoría sin pérdida.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'

// R34-c — acciones operativas visibles por defecto (reintentos de correos,
// corrida de conciliación y reparación de webhooks perdidos)
export const AUDIT_DEFAULT_ACTIONS = [
  'emails.retried',
  'billing.reconcile_repair_applied',
  'billing.reconcile_run',
]

// R35-b — escape CSV estándar (idéntico al de la exportación de correos R32-d):
// envuelve en comillas si hay coma/comilla/salto de línea y duplica las internas.
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
  const authCheck = await requirePermission('admin.users.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const url = new URL(req.url)
  const actionsParam = url.searchParams.get('actions')
  const actions = (actionsParam
    ? actionsParam.split(',').map(a => a.trim()).filter(Boolean)
    : AUDIT_DEFAULT_ACTIONS
  ).slice(0, 10)

  // R35-b — con format=csv el tope sube a 1000 filas (exportación completa,
  // mismo criterio que la exportación de correos); en pantalla sigue siendo 100.
  const format = url.searchParams.get('format')
  const limitRaw = parseInt(url.searchParams.get('limit') || '20', 10)
  const limit = Math.min(
    Math.max(Number.isNaN(limitRaw) ? 20 : limitRaw, 1),
    format === 'csv' ? 1000 : 100,
  )

  const entries = await db.auditLog.findMany({
    where: actions.length > 0 ? { action: { in: actions } } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      resourceType: true,
      resourceId: true,
      createdAt: true,
      metadataJson: true,
      user: { select: { name: true, email: true } },
    },
  })

  if (format === 'csv') {
    const rows: (string | null)[][] = [
      ['fecha', 'accion', 'usuario', 'correo', 'tipo_recurso', 'recurso_id', 'metadatos'],
      ...entries.map(e => [
        e.createdAt.toISOString(),
        e.action,
        e.user?.name ?? null,
        e.user?.email ?? null,
        e.resourceType,
        e.resourceId,
        e.metadataJson,
      ]),
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    return csvResponse(rows, `auditoria-${stamp}.csv`)
  }

  return NextResponse.json({ ok: true, actions, entries })
}
