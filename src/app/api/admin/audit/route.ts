import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('admin.audit.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const url = new URL(req.url)
  const action = url.searchParams.get('action')
  const userId = url.searchParams.get('userId')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500)

  const logs = await db.auditLog.findMany({
    where: {
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { email: true } } },
  })

  return NextResponse.json({
    ok: true,
    logs: logs.map(l => ({
      id: l.id,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      userEmail: l.user?.email,
      ipAddress: l.ipAddress,
      requestId: l.requestId,
      metadata: l.metadataJson ? JSON.parse(l.metadataJson) : null,
      createdAt: l.createdAt,
    })),
  })
}
