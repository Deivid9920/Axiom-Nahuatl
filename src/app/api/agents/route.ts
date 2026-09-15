import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth'
import { orchestrator } from '@/lib/agents/orchestrator'
import '@/lib/agents/agents'  // side-effect: registers all 5 agents
import '@/lib/agents/tools'   // side-effect: registers all tools
import { type AgentType } from '@/lib/types'
import { logger } from '@/lib/observability'

export async function POST(req: NextRequest) {
  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const schema = z.object({
    agentType: z.enum(['ai_tutor', 'learning', 'analytics', 'product', 'engineering']),
    prompt: z.string().optional(),
    sessionId: z.string().optional(),
    module: z.string().optional(),
    mode: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const agentType = parse.data.agentType as AgentType
  const permissionMap: Record<AgentType, Parameters<typeof requirePermission>[0]> = {
    ai_tutor: 'agent.ai_tutor.dispatch',
    learning: 'agent.learning.dispatch',
    analytics: 'agent.analytics.dispatch',
    product: 'agent.product.dispatch',
    engineering: 'agent.engineering.dispatch',
  }

  const authCheck = await requirePermission(permissionMap[agentType])
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  try {
    const output = await orchestrator.dispatch(agentType, {
      prompt: parse.data.prompt,
      sessionId: parse.data.sessionId,
      module: parse.data.module,
      mode: parse.data.mode,
      metadata: parse.data.metadata,
    }, ctx)

    return NextResponse.json({
      ok: true,
      output: {
        content: output.content,
        data: output.data,
        eventsEmitted: output.events?.length || 0,
      },
    })
  } catch (error) {
    logger.error('agents.dispatch_failed', {
      agent_type: agentType,
      user_id: ctx.userId,
      error: (error as Error).message,
    }, error as Error)
    // SECURITY: Don't expose internal error details
    return NextResponse.json({ error: 'Error al procesar la solicitud del agente' }, { status: 500 })
  }
}
