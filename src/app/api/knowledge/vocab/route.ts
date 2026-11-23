import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission, getAuthContext } from '@/lib/auth'
import { indexChunk } from '@/lib/rag/vector-store'
import { logger, audit } from '@/lib/observability'

// List vocabulary entries with optional filtering
export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const url = new URL(req.url)
  const domain = url.searchParams.get('domain')
  const cefrLevel = url.searchParams.get('cefr')
  const search = url.searchParams.get('q')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)

  const entries = await db.vocabularyEntry.findMany({
    where: {
      ...(domain ? { domain: { code: domain } } : {}),
      ...(cefrLevel ? { cefrLevel } : {}),
      ...(search ? { term: { contains: search } } : {}),
    },
    include: { domain: true },
    take: limit,
    orderBy: { term: 'asc' },
  })

  return NextResponse.json({
    ok: true,
    entries: entries.map(e => ({
      id: e.id,
      term: e.term,
      pos: e.pos,
      phonetic: e.phonetic,
      definitionEn: e.definitionEn,
      definitionEs: e.definitionEs,
      cefrLevel: e.cefrLevel,
      difficultyScore: e.difficultyScore,
      domain: e.domain.code,
      examples: e.examplesJson ? JSON.parse(e.examplesJson) : [],
      synonyms: e.synonymsJson ? JSON.parse(e.synonymsJson) : [],
    })),
  })
}

// Admin: add a vocabulary entry
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('admin.plans.write')  // reuse admin permission
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
    domainCode: z.string(),
    term: z.string().min(1),
    pos: z.string().optional(),
    phonetic: z.string().optional(),
    definitionEn: z.string(),
    definitionEs: z.string(),
    cefrLevel: z.string(),
    difficultyScore: z.number().min(0).max(1).optional(),
    examples: z.array(z.string()).optional(),
    synonyms: z.array(z.string()).optional(),
  })

  const parse = schema.safeParse(body)
  if (!parse.success) {
    return NextResponse.json({ error: parse.error.issues[0].message }, { status: 400 })
  }

  const entry = await db.vocabularyEntry.create({
    data: {
      domainId: parse.data.domainCode,  // domain code is the ID for MVP (or look up)
      term: parse.data.term,
      pos: parse.data.pos,
      phonetic: parse.data.phonetic,
      definitionEn: parse.data.definitionEn,
      definitionEs: parse.data.definitionEs,
      cefrLevel: parse.data.cefrLevel,
      difficultyScore: parse.data.difficultyScore ?? 0.5,
      examplesJson: parse.data.examples ? JSON.stringify(parse.data.examples) : null,
      synonymsJson: parse.data.synonyms ? JSON.stringify(parse.data.synonyms) : null,
    },
  })

  // Index in vector store
  await indexChunk({
    chunkId: `vocab_${entry.id}`,
    content: `${parse.data.term}: ${parse.data.definitionEn} ${parse.data.definitionEs}`,
    domain: parse.data.domainCode,
    cefrLevel: parse.data.cefrLevel,
    source: 'vocabulary',
    sourceId: entry.id,
    difficultyScore: parse.data.difficultyScore ?? 0.5,
  })

  await audit('knowledge.vocab_added', {
    userId: ctx.userId,
    resourceType: 'vocabulary',
    resourceId: entry.id,
    metadata: { term: parse.data.term },
  })

  return NextResponse.json({ ok: true, entryId: entry.id })
}
