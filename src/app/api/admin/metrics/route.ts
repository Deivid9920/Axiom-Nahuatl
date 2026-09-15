import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const authCheck = await requirePermission('admin.errors.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const url = new URL(req.url)
  const sinceHours = parseInt(url.searchParams.get('sinceHours') || '24')

  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000)

  // Aggregate metrics by name
  const metrics = await db.metricPoint.groupBy({
    by: ['name', 'type', 'unit'],
    where: { recordedAt: { gt: since } },
    _sum: { value: true },
    _count: true,
    _avg: { value: true },
    _max: { value: true },
  })

  // System stats
  const [userCount, sessionCount, agentRunCount, errorCount] = await Promise.all([
    db.user.count(),
    db.learningSession.count({ where: { startedAt: { gt: since } } }),
    db.agentRun.count({ where: { startedAt: { gt: since } } }),
    db.errorEvent.count({ where: { createdAt: { gt: since } } }),
  ])

  return NextResponse.json({
    ok: true,
    period: { sinceHours },
    system: {
      users: userCount,
      sessions: sessionCount,
      agentRuns: agentRunCount,
      errors: errorCount,
    },
    metrics: metrics.map(m => ({
      name: m.name,
      type: m.type,
      unit: m.unit,
      sum: m._sum.value,
      avg: m._avg.value,
      max: m._max.value,
      count: m._count,
    })),
  })
}
