import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'

export async function GET() {
  const authCheck = await requirePermission('admin.users.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      lastLoginAt: true,
      profile: true,
      userRoles: { include: { role: true } },
      _count: {
        select: {
          learningSessions: true,
          payments: true,
          agentMemories: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({
    ok: true,
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      cefrCurrent: u.profile?.cefrCurrent,
      professionalDomain: u.profile?.professionalDomain,
      theta: u.profile?.theta,
      roles: u.userRoles.map(r => r.role.name),
      stats: {
        sessionsCount: u._count.learningSessions,
        paymentsCount: u._count.payments,
        agentMemoriesCount: u._count.agentMemories,
      },
    })),
  })
}
