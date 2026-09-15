import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { audit } from '@/lib/observability'

export async function GET() {
  const authCheck = await requirePermission('admin.flags.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }

  const flags = await db.featureFlag.findMany({
    include: { _count: { select: { assignments: true } } },
    orderBy: { key: 'asc' },
  })

  return NextResponse.json({
    ok: true,
    flags: flags.map(f => ({
      id: f.id,
      key: f.key,
      description: f.description,
      enabled: f.enabled,
      rolloutPercent: f.rolloutPercent,
      config: f.configJson ? JSON.parse(f.configJson) : null,
      assignmentsCount: f._count.assignments,
      updatedAt: f.updatedAt,
    })),
  })
}

export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('admin.flags.write')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    key: z.string(),
    description: z.string().optional(),
    enabled: z.boolean(),
    rolloutPercent: z.number().int().min(0).max(100).optional(),
    config: z.record(z.string(), z.any()).optional(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const flag = await db.featureFlag.upsert({
    where: { key: parse.data.key },
    create: {
      key: parse.data.key,
      description: parse.data.description,
      enabled: parse.data.enabled,
      rolloutPercent: parse.data.rolloutPercent ?? 100,
      configJson: parse.data.config ? JSON.stringify(parse.data.config) : null,
    },
    update: {
      description: parse.data.description,
      enabled: parse.data.enabled,
      rolloutPercent: parse.data.rolloutPercent,
      configJson: parse.data.config ? JSON.stringify(parse.data.config) : undefined,
    },
  })

  await audit('admin.flag_changed', {
    userId: ctx.userId,
    resourceType: 'flag',
    resourceId: flag.id,
    metadata: { key: flag.key, enabled: flag.enabled, rollout: flag.rolloutPercent },
  })

  return NextResponse.json({ ok: true, flagId: flag.id })
}
