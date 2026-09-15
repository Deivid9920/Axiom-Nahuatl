// AXIOM — Tool Layer implementations

import { z } from 'zod'
import { db } from '@/lib/db'
import { retrieve } from '@/lib/rag/retrieval'
import { memory } from '@/lib/memory'
import { registerTool, type ToolContext } from './orchestrator'
import { logger } from '@/lib/observability'
import { estimateTheta, fsrsUpdate, type IrtItem, type IrtResponse } from '@/lib/pedagogy'
import { thetaToCefr, type CefrLevel, type Domain } from '@/lib/types'

// Tool: rag.retrieve
// Adaptive RAG retrieval
registerTool({
  name: 'rag.retrieve',
  description: 'Retrieve relevant context from the knowledge base and user documents using adaptive RAG.',
  requiredPermission: 'rag.retrieve',
  inputSchema: z.object({
    query: z.string().min(1).max(500),
    domain: z.string().optional(),
    cefrLevel: z.string().optional(),
    topK: z.number().int().min(1).max(20).optional(),
    useErrorBoost: z.boolean().optional(),
  }),
  async execute(input: z.infer<typeof tools.schemas.ragRetrieve>, ctx: ToolContext) {
    const profile = await db.userProfile.findUnique({ where: { userId: ctx.authCtx.userId } })
    const result = await retrieve({
      query: input.query,
      userId: ctx.authCtx.userId,
      domain: (input.domain || profile?.professionalDomain || 'software_engineering') as Domain,
      cefrLevel: (input.cefrLevel || profile?.cefrCurrent || 'A2') as CefrLevel,
      topK: input.topK,
      useErrorBoost: input.useErrorBoost ?? true,
    }, ctx.span)
    return {
      chunks: result.chunks.map(c => ({
        content: c.payload.content,
        source: c.payload.source,
        sourceId: c.payload.sourceId,
        score: c.score,
        domain: c.payload.domain,
        cefrLevel: c.payload.cefrLevel,
      })),
    }
  },
})

// Tool: memory.write
// Write to long-term agent_memory
registerTool({
  name: 'memory.write',
  description: 'Persist a long-term memory entry for the current agent and user.',
  requiredPermission: 'system.events.emit',  // writing memory is roughly equivalent to event emission
  inputSchema: z.object({
    agentType: z.string(),
    context: z.record(z.string(), z.any()),
    metadata: z.record(z.string(), z.any()).optional(),
  }),
  async execute(input, ctx: ToolContext) {
    const id = await memory.writeLongTerm({
      agentType: input.agentType as any,
      userId: ctx.authCtx.userId,
      context: input.context,
      metadata: input.metadata,
    }, ctx.span)
    return { id }
  },
})

// Tool: memory.read
// Read long-term memories
registerTool({
  name: 'memory.read',
  description: 'Read recent long-term memories for the current agent and user.',
  requiredPermission: 'rag.retrieve',
  inputSchema: z.object({
    agentType: z.string(),
    limit: z.number().int().min(1).max(50).optional(),
    sinceDays: z.number().int().min(1).max(365).optional(),
  }),
  async execute(input, ctx: ToolContext) {
    return memory.readLongTerm({
      agentType: input.agentType as any,
      userId: ctx.authCtx.userId,
      limit: input.limit ?? 10,
      since: input.sinceDays ? new Date(Date.now() - input.sinceDays * 24 * 60 * 60 * 1000) : undefined,
    }, ctx.span)
  },
})

// Tool: progress.update
// Update user's θ (IRT ability estimate) after a session
registerTool({
  name: 'progress.update',
  description: 'Update the user IRT ability estimate (theta) based on item responses.',
  requiredPermission: 'agent.learning.dispatch',
  inputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      a: z.number(),
      b: z.number(),
      c: z.number(),
    })),
    responses: z.array(z.object({
      itemId: z.string(),
      correct: z.boolean(),
    })),
  }),
  async execute(input, ctx: ToolContext) {
    const items: IrtItem[] = input.items
    const responses: IrtResponse[] = input.responses

    const profile = await db.userProfile.findUnique({ where: { userId: ctx.authCtx.userId } })
    const priorTheta = profile?.theta ?? -2.0
    const priorSd = profile?.thetaSE ?? 1.0

    const estimate = estimateTheta(items, responses, {
      priorMean: priorTheta,
      priorSd,
      parentSpan: ctx.span,
    })

    await db.userProfile.update({
      where: { userId: ctx.authCtx.userId },
      data: {
        theta: estimate.theta,
        thetaSE: estimate.se,
        cefrCurrent: estimate.cefrLevel,
        thetaUpdatedAt: new Date(),
      },
    })

    return {
      thetaBefore: priorTheta,
      thetaAfter: estimate.theta,
      se: estimate.se,
      cefrLevel: estimate.cefrLevel,
    }
  },
})

// Tool: vocabulary.review
// Apply FSRS update to a user's vocabulary item
registerTool({
  name: 'vocabulary.review',
  description: 'Record a vocabulary review and update FSRS scheduling.',
  requiredPermission: 'agent.learning.dispatch',
  inputSchema: z.object({
    vocabularyItemId: z.string(),
    rating: z.number().int().min(1).max(5),
  }),
  async execute(input, ctx: ToolContext) {
    const item = await db.vocabularyItem.findUnique({
      where: { id: input.vocabularyItemId },
    })
    if (!item || item.userId !== ctx.authCtx.userId) {
      throw new Error('Vocabulary item not found or not owned by user')
    }

    const update = fsrsUpdate({
      term: item.term,
      stability: item.stability,
      difficulty: item.difficulty,
      retrievability: item.retrievability,
      lastReviewedAt: item.lastReviewedAt,
      reviewCount: item.reviewCount,
      lapseCount: item.lapseCount,
    }, {
      rating: input.rating as 1 | 2 | 3 | 4 | 5,
      reviewedAt: new Date(),
    })

    await db.vocabularyItem.update({
      where: { id: item.id },
      data: {
        stability: update.newStability,
        difficulty: update.newDifficulty,
        retrievability: update.newRetrievability,
        lastReviewedAt: new Date(),
        nextReviewAt: update.nextReviewAt,
        reviewCount: update.newReviewCount,
        lapseCount: update.newLapseCount,
      },
    })

    return {
      nextReviewAt: update.nextReviewAt,
      newStability: update.newStability,
      newDifficulty: update.newDifficulty,
    }
  },
})

// Tool: progress.read
// Read user progress metrics
registerTool({
  name: 'progress.read',
  description: 'Read the user progress metrics for the last N days.',
  requiredPermission: 'agent.analytics.dispatch',
  inputSchema: z.object({
    days: z.number().int().min(1).max(90).optional(),
  }),
  async execute(input, ctx: ToolContext) {
    const days = input.days ?? 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [sessions, evaluations, vocab] = await Promise.all([
      db.learningSession.findMany({
        where: { userId: ctx.authCtx.userId, startedAt: { gt: since } },
        orderBy: { startedAt: 'desc' },
        take: 100,
      }),
      db.sessionEvaluation.findMany({
        where: { session: { userId: ctx.authCtx.userId }, createdAt: { gt: since } },
        take: 100,
      }),
      db.vocabularyItem.count({ where: { userId: ctx.authCtx.userId } }),
    ])

    const totalSessions = sessions.length
    const totalMinutes = sessions.reduce((s, sess) => s + (sess.durationSec || 0), 0) / 60
    const avgThetaDelta = evaluations.length > 0
      ? evaluations.reduce((s, e) => s + (e.thetaAfter - e.thetaBefore), 0) / evaluations.length
      : 0

    return {
      totalSessions,
      totalMinutes,
      avgThetaDelta,
      vocabularyCount: vocab,
      currentTheta: (await db.userProfile.findUnique({ where: { userId: ctx.authCtx.userId } }))?.theta ?? -2,
    }
  },
})

// Tool: errors.cluster
// Engineering Agent clusters errors by fingerprint
registerTool({
  name: 'errors.cluster',
  description: 'Cluster recent errors by fingerprint and assign cluster IDs.',
  requiredPermission: 'agent.engineering.dispatch',
  inputSchema: z.object({
    sinceHours: z.number().int().min(1).max(168).optional(),
  }),
  async execute(input, ctx: ToolContext) {
    const since = new Date(Date.now() - (input.sinceHours ?? 24) * 60 * 60 * 1000)
    const errors = await db.errorEvent.findMany({
      where: { createdAt: { gt: since }, status: 'new' },
      take: 500,
    })

    // Group by fingerprint
    const clusters = new Map<string, typeof errors>()
    for (const err of errors) {
      const arr = clusters.get(err.fingerprint) || []
      arr.push(err)
      clusters.set(err.fingerprint, arr)
    }

    // Assign cluster IDs
    let clusterIdx = 0
    const clusterAssignments: { clusterId: string; count: number; fingerprint: string; sample: any }[] = []
    for (const [fingerprint, errs] of clusters.entries()) {
      const clusterId = `cluster_${Date.now()}_${clusterIdx++}`
      await db.errorEvent.updateMany({
        where: { id: { in: errs.map(e => e.id) } },
        data: { clusterId, status: 'clustered' },
      })
      clusterAssignments.push({
        clusterId,
        count: errs.length,
        fingerprint,
        sample: {
          name: errs[0].name,
          message: errs[0].message,
          requestUrl: errs[0].requestUrl,
        },
      })
    }

    return { clusters: clusterAssignments, totalErrors: errors.length }
  },
})

// Tool: feature_flags.get
// Product Agent exposes feature flag evaluation
registerTool({
  name: 'feature_flags.get',
  description: 'Evaluate feature flags for a user.',
  requiredPermission: 'agent.product.dispatch',
  inputSchema: z.object({
    flagKeys: z.array(z.string()),
  }),
  async execute(input, ctx: ToolContext) {
    const result: Record<string, boolean> = {}
    for (const key of input.flagKeys) {
      const flag = await db.featureFlag.findUnique({ where: { key } })
      if (!flag) {
        result[key] = false
        continue
      }
      // Check override
      const assignment = await db.featureFlagAssignment.findUnique({
        where: { flagId_userId: { flagId: flag.id, userId: ctx.authCtx.userId } },
      })
      if (assignment) {
        result[key] = assignment.enabled
      } else {
        // Rollout percent: hash(userId + flagKey) % 100 < rolloutPercent
        const hash = simpleHash(ctx.authCtx.userId + key)
        result[key] = flag.enabled && (hash % 100) < flag.rolloutPercent
      }
    }
    return result
  },
})

// Tool: experiments.assign
// Product Agent assigns users to experiment variants
registerTool({
  name: 'experiments.assign',
  description: 'Assign the user to an experiment variant deterministically.',
  requiredPermission: 'agent.product.dispatch',
  inputSchema: z.object({
    experimentKey: z.string(),
  }),
  async execute(input, ctx: ToolContext) {
    const experiment = await db.experiment.findUnique({
      where: { key: input.experimentKey },
      include: { variants: true },
    })
    if (!experiment || experiment.status !== 'running' || experiment.variants.length === 0) {
      return { assigned: false }
    }

    // Check existing assignment
    const existing = await db.experimentAssignment.findUnique({
      where: { experimentId_userId: { experimentId: experiment.id, userId: ctx.authCtx.userId } },
      include: { variant: true },
    })
    if (existing) {
      return { assigned: true, variant: existing.variant.key, config: existing.variant.configJson }
    }

    // Deterministic assignment: hash(userId + experimentKey) % totalWeight
    const totalWeight = experiment.variants.reduce((s, v) => s + v.weight, 0)
    const hash = simpleHash(ctx.authCtx.userId + experiment.key)
    let bucket = hash % totalWeight
    let chosen = experiment.variants[0]
    for (const v of experiment.variants) {
      bucket -= v.weight
      if (bucket < 0) {
        chosen = v
        break
      }
    }

    await db.experimentAssignment.create({
      data: {
        experimentId: experiment.id,
        userId: ctx.authCtx.userId,
        variantId: chosen.id,
      },
    })

    return { assigned: true, variant: chosen.key, config: chosen.configJson }
  },
})

// Helper
function simpleHash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h * 16777619) >>> 0
  }
  return h
}

// Schema namespace for type inference
export const tools = {
  schemas: {
    ragRetrieve: z.object({
      query: z.string().min(1).max(500),
      domain: z.string().optional(),
      cefrLevel: z.string().optional(),
      topK: z.number().int().min(1).max(20).optional(),
      useErrorBoost: z.boolean().optional(),
    }),
  },
}
