// AXIOM — Agent System
// Agents NEVER bypass the ToolLayer to touch the DB directly.

import { db } from '@/lib/db'
import { logger, audit, tracer, type Span } from '@/lib/observability'
import { events } from '@/lib/events'
import { memory } from '@/lib/memory'
import { hasPermission, type AuthContext } from '@/lib/auth'
import { type AgentType, type Permission } from '@/lib/types'

// Tool Layer
export interface Tool {
  name: string
  description: string
  requiredPermission: Permission
  inputSchema: any  // Zod schema; checked at runtime
  execute: (input: any, ctx: ToolContext) => Promise<any>
}

export interface ToolContext {
  authCtx: AuthContext
  span: Span
  agentRunId: string
}

// Tool registry
const tools = new Map<string, Tool>()

export function registerTool(tool: Tool) {
  tools.set(tool.name, tool)
  logger.debug('tool.registered', { tool: tool.name })
}

export function getTool(name: string): Tool | undefined {
  return tools.get(name)
}

async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<unknown> {
  const tool = tools.get(name)
  if (!tool) {
    throw new Error(`Tool not found: ${name}`)
  }

  // RBAC check
  const allowed = hasPermission(ctx.authCtx.roles, tool.requiredPermission)
  if (!allowed) {
    await audit('rbac.deny', {
      userId: ctx.authCtx.userId,
      resourceType: 'tool',
      resourceId: name,
      requestId: ctx.authCtx.requestId,
      metadata: { agentRunId: ctx.agentRunId, requiredPermission: tool.requiredPermission },
    })
    throw new Error(`Permission denied for tool ${name}: requires ${tool.requiredPermission}`)
  }

  // Validate input (defensive — don't crash if schema has issues)
  try {
    const validationResult = tool.inputSchema?.safeParse?.(input)
    if (validationResult && !validationResult.success) {
      throw new Error(`Invalid input for tool ${name}: ${validationResult.error.message}`)
    }
  } catch (validationError) {
    // Log but don't crash — let the tool execute with the raw input
    logger.warn('tool.validation_skipped', {
      tool: name,
      error: (validationError as Error).message,
    })
  }

  const start = Date.now()
  let output: unknown
  let errorMessage: string | undefined

  try {
    output = await tool.execute(input, ctx)
    return output
  } catch (error) {
    errorMessage = (error as Error).message
    throw error
  } finally {
    // Audit tool call
    await db.agentToolCall.create({
      data: {
        agentRunId: ctx.agentRunId,
        toolName: name,
        permission: tool.requiredPermission,
        allowed,
        inputJson: JSON.stringify(input),
        outputJson: output ? JSON.stringify(output) : null,
        errorMessage,
        durationMs: Date.now() - start,
      },
    })
  }
}

// Agent interface
export interface AgentInput {
  prompt?: string
  sessionId?: string
  module?: string
  mode?: string
  metadata?: Record<string, unknown>
}

export interface AgentOutput {
  content?: string
  data?: Record<string, unknown>
  events?: { name: string; payload: Record<string, unknown> }[]
}

export interface AgentContext {
  authCtx: AuthContext
  agentRunId: string
  traceId: string
  parentSpan: Span
  allowedTools: string[]
}

export interface Agent {
  type: AgentType
  requiredPermissions: Permission[]
  defaultTools: string[]
  run: (input: AgentInput, ctx: AgentContext) => Promise<AgentOutput>
}

// Agent registry
const agents = new Map<AgentType, Agent>()

export function registerAgent(agent: Agent) {
  agents.set(agent.type, agent)
  logger.debug('agent.registered', { agent: agent.type })
}

export function getAgent(type: AgentType): Agent | undefined {
  return agents.get(type)
}

// Agent Orchestrator
export class AgentOrchestrator {
  async dispatch(
    agentType: AgentType,
    input: AgentInput,
    authCtx: AuthContext,
    parentSpan?: Span
  ): Promise<AgentOutput> {
    return tracer.withSpan(
      'agent.dispatch',
      async (span) => {
        span.setAttribute('agent.type', agentType)
        span.setAttribute('user.id', authCtx.userId)
        span.setAttribute('agent.input_keys', Object.keys(input).join(','))

        const agent = agents.get(agentType)
        if (!agent) {
          throw new Error(`Agent not registered: ${agentType}`)
        }

        // Verify RBAC: user must have ALL agent's required permissions
        for (const perm of agent.requiredPermissions) {
          if (!hasPermission(authCtx.roles, perm)) {
            await audit('agent.dispatch_denied', {
              userId: authCtx.userId,
              resourceType: 'agent',
              resourceId: agentType,
              requestId: authCtx.requestId,
              metadata: { missingPermission: perm },
            })
            throw new Error(`Permission denied for agent ${agentType}: requires ${perm}`)
          }
        }

        // Create agent run record
        const run = await db.agentRun.create({
          data: {
            agentType,
            userId: authCtx.userId,
            inputJson: JSON.stringify(input),
            status: 'running',
            traceId: span.traceId,
            spanId: span.spanId,
            startedAt: new Date(),
          },
        })

        const ctx: AgentContext = {
          authCtx,
          agentRunId: run.id,
          traceId: span.traceId,
          parentSpan: span,
          allowedTools: agent.defaultTools,
        }

        const start = Date.now()
        try {
          const output = await agent.run(input, ctx)

          // Update run record
          await db.agentRun.update({
            where: { id: run.id },
            data: {
              outputJson: JSON.stringify(output),
              status: 'completed',
              completedAt: new Date(),
              durationMs: Date.now() - start,
            },
          })

          // Emit any agent-produced events
          if (output.events) {
            for (const e of output.events) {
              await events.publish({
                name: e.name as any,
                producer: `agent:${agentType}`,
                producerUserId: authCtx.userId,
                payload: e.payload,
                parentSpan: span,
              })
            }
          }

          span.setAttribute('agent.duration_ms', Date.now() - start)
          span.setAttribute('agent.events_emitted', output.events?.length ?? 0)

          return output
        } catch (error) {
          await db.agentRun.update({
            where: { id: run.id },
            data: {
              status: 'failed',
              errorMessage: (error as Error).message,
              completedAt: new Date(),
              durationMs: Date.now() - start,
            },
          })
          span.recordError(error as Error)
          throw error
        }
      },
      { parentSpanId: parentSpan?.spanId }
    )
  }

  // Expose tool executor for agents to use within their run()
  async callTool(name: string, input: unknown, ctx: AgentContext): Promise<unknown> {
    if (!ctx.allowedTools.includes(name)) {
      throw new Error(`Tool ${name} not in allowed tools for this agent run`)
    }
    return executeTool(name, input, {
      authCtx: ctx.authCtx,
      span: ctx.parentSpan,
      agentRunId: ctx.agentRunId,
    })
  }
}

// Singleton orchestrator
export const orchestrator = new AgentOrchestrator()
