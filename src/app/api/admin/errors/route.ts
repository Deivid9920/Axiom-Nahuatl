import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('admin.errors.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('status')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)

  const errors = await db.errorEvent.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { email: true } } },
  })

  return NextResponse.json({
    ok: true,
    errors: errors.map(e => ({
      id: e.id,
      fingerprint: e.fingerprint,
      name: e.name,
      message: e.message,
      statusCode: e.statusCode,
      requestUrl: e.requestUrl,
      requestMethod: e.requestMethod,
      clusterId: e.clusterId,
      status: e.status,
      userEmail: e.user?.email,
      createdAt: e.createdAt,
      resolvedAt: e.resolvedAt,
    })),
  })
}
