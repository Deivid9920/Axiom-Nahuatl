// R31-a — listado de correos transaccionales (EmailLog) para el panel admin.
// GET /api/admin/emails?kind=renewal_receipt&status=dev_logged&q=maria&limit=50
// Devuelve los últimos correos (avisos de renovación, recibos, fallos de cobro y
// enlaces de pago) sin el cuerpo, con filtros por tipo, estado y búsqueda.
// R32-d — format=csv devuelve el mismo listado (mismos filtros) como archivo CSV
// con BOM para Excel.
// R33-a — la respuesta incluye `queue`: la cola de reintentos programados
// (correos 'failed' con nextRetryAt pendiente) como bloque aparte para el
// dashboard del panel, con su conteo total y los próximos intentos en orden.
import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { db } from '@/lib/db'
import { EMAIL_RETRY_SCHEDULE_MINUTES } from '@/lib/notifications/email'

// R32-d — escape CSV estándar: envuelve en comillas si hay coma/comilla/salto de
// línea y duplica las comillas internas.
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
  const kind = url.searchParams.get('kind') || undefined
  const status = url.searchParams.get('status') || undefined
  const q = url.searchParams.get('q')?.trim() || undefined
  const format = url.searchParams.get('format')
  const limitRaw = parseInt(url.searchParams.get('limit') || '50', 10)
  const limit = Math.min(Math.max(Number.isNaN(limitRaw) ? 50 : limitRaw, 1), format === 'csv' ? 1000 : 200)

  const emails = await db.emailLog.findMany({
    where: {
      ...(kind ? { kind } : {}),
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ to: { contains: q } }, { subject: { contains: q } }] } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      to: true,
      subject: true,
      kind: true,
      status: true,
      dedupeKey: true,
      relatedType: true,
      relatedId: true,
      sentAt: true,
      createdAt: true,
      retryCount: true,
      lastError: true,
      user: { select: { name: true, email: true } },
    },
  })

  // R32-d — exportación CSV con los mismos filtros aplicados
  if (format === 'csv') {
    const rows: (string | null)[][] = [
      ['fecha', 'destinatario', 'nombre', 'asunto', 'tipo', 'estado', 'reintentos', 'ultimo_error'],
      ...emails.map(e => [
        (e.sentAt || e.createdAt).toISOString(),
        e.to,
        e.user?.name ?? null,
        e.subject,
        e.kind,
        e.status,
        String(e.retryCount),
        e.lastError,
      ]),
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    return csvResponse(rows, `correos-${stamp}.csv`)
  }

  // R33-a — cola de reintentos programados (global, sin filtros: es el estado
  // operativo de la cola): failed con nextRetryAt pendiente, ordenados por el
  // intento más próximo. Los 'failed' terminales (nextRetryAt null) no están en
  // cola; se reintentan manualmente desde la tabla (R33-b).
  const [queueCount, queueItems] = await Promise.all([
    db.emailLog.count({ where: { status: 'failed', nextRetryAt: { not: null } } }),
    db.emailLog.findMany({
      where: { status: 'failed', nextRetryAt: { not: null } },
      orderBy: { nextRetryAt: 'asc' },
      take: 10,
      select: {
        id: true,
        to: true,
        subject: true,
        kind: true,
        retryCount: true,
        nextRetryAt: true,
        lastError: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ])

  return NextResponse.json({
    ok: true,
    emails,
    queue: {
      count: queueCount,
      schedule: EMAIL_RETRY_SCHEDULE_MINUTES,
      items: queueItems,
    },
  })
}
