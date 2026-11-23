import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/auth'
import { checkFeatureAccess } from '@/lib/billing'
import { indexChunk, getVectorStore } from '@/lib/rag/vector-store'
import { chunkText } from '@/lib/rag/retrieval'
import { logger, audit } from '@/lib/observability'
import { events } from '@/lib/events'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs/promises'

// Upload a document for RAG
export async function POST(req: NextRequest) {
  const authCheck = await requirePermission('rag.documents.upload')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const access = await checkFeatureAccess(ctx.userId, 'ragEnabled')
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const title = formData.get('title') as string | null
  const domain = formData.get('domain') as string | null

  if (!file) {
    return NextResponse.json({ error: 'Archivo no proporcionado' }, { status: 400 })
  }

  // SECURITY: File size limit (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'El archivo excede 10MB' }, { status: 400 })
  }

  // SECURITY: Validate file type by extension AND content (magic bytes)
  const ALLOWED_EXTENSIONS = new Set(['txt', 'md', 'pdf', 'docx', 'csv', 'json'])
  const ext = path.extname(file.name).slice(1).toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: `Tipo de archivo no permitido. Extensiones válidas: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}` },
      { status: 400 }
    )
  }

  // SECURITY: Validate MIME type from file content (magic bytes), not just extension
  const buffer = Buffer.from(await file.arrayBuffer())
  const MAGIC_BYTES: Record<string, number[]> = {
    pdf: [0x25, 0x50, 0x44, 0x46],  // %PDF
    // docx is a ZIP file (PK)
    docx: [0x50, 0x4B, 0x03, 0x04],
  }
  if (MAGIC_BYTES[ext]) {
    const expected = MAGIC_BYTES[ext]
    const matches = expected.every((byte, i) => buffer[i] === byte)
    if (!matches) {
      return NextResponse.json(
        { error: 'El contenido del archivo no coincide con su extensión' },
        { status: 400 }
      )
    }
  }

  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex')

  // Dedup check
  const existing = await db.userDocument.findFirst({
    where: { userId: ctx.userId, contentHash },
  })
  if (existing) {
    return NextResponse.json({ ok: true, documentId: existing.id, deduped: true })
  }

  // SECURITY: Sanitize filename — use content hash + sanitized extension only
  // Never trust user-supplied filename for filesystem operations
  const safeExt = ext.replace(/[^a-z0-9]/g, '')  // only alphanumeric
  const safeUserId = ctx.userId.replace(/[^a-zA-Z0-9_-]/g, '')  // strip path traversal chars
  const filename = `${Date.now()}-${contentHash.slice(0, 8)}.${safeExt}`

  // SECURITY: Use path.join with explicit directory (prevents path traversal)
  const storageDir = path.join(process.cwd(), 'storage', 'documents', safeUserId)
  await fs.mkdir(storageDir, { recursive: true })
  const storagePath = path.join(storageDir, filename)

  // SECURITY: Verify the resolved path is within the storage directory
  const resolvedPath = path.resolve(storagePath)
  const resolvedDir = path.resolve(storageDir)
  if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
    return NextResponse.json({ error: 'Path traversal detectado' }, { status: 400 })
  }

  // SECURITY: Sanitize title for display (strip HTML/control chars)
  const safeTitle = (title || file.name)
    .replace(/[<>'"&\x00-\x1f]/g, '')
    .slice(0, 255)  // max 255 chars

  await fs.writeFile(storagePath, buffer)

  // Create document record
  const doc = await db.userDocument.create({
    data: {
      userId: ctx.userId,
      title: safeTitle,
      fileType: safeExt,
      sizeBytes: file.size,
      contentHash,
      storagePath,
      status: 'processing',
    },
  })

  // Process document (synchronous for MVP; in prod this would be a background job)
  try {
    // Extract text (simple: assume text-like file; in prod use pdfplumber/python-docx via worker)
    let text: string
    if (['txt', 'md'].includes(ext.slice(1).toLowerCase())) {
      text = buffer.toString('utf-8')
    } else {
      // For non-text files, store metadata only (PDF/DOCX require OCR pipeline)
      text = `[Binary file: ${file.name}. Text extraction not available in MVP sandbox.]`
    }

    // Chunk
    const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 50 })

    // Save chunks + index embeddings
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const chunkRecord = await db.documentChunk.create({
        data: {
          documentId: doc.id,
          content: chunk.content,
          chunkIndex: chunk.index,
          tokenCount: Math.ceil(chunk.content.length / 4),
          domain: domain || null,
        },
      })
      await indexChunk({
        chunkId: chunkRecord.id,
        content: chunk.content,
        documentId: doc.id,
        domain: domain || undefined,
        source: 'user_document',
        sourceId: doc.id,
        metadata: { title: doc.title, fileType: doc.fileType },
      })
    }

    await db.userDocument.update({
      where: { id: doc.id },
      data: { status: 'ready', processedAt: new Date() },
    })

    await audit('document.uploaded', {
      userId: ctx.userId,
      resourceType: 'document',
      resourceId: doc.id,
      metadata: { title: doc.title, chunks: chunks.length, sizeBytes: file.size },
    })

    return NextResponse.json({
      ok: true,
      documentId: doc.id,
      chunks: chunks.length,
    })
  } catch (error) {
    logger.error('documents.process_failed', { document_id: doc.id, error: (error as Error).message }, error as Error)
    await db.userDocument.update({
      where: { id: doc.id },
      data: { status: 'failed', processingError: (error as Error).message },
    })
    return NextResponse.json({ error: 'Error procesando documento' }, { status: 500 })
  }
}

// List user's documents
export async function GET() {
  const authCheck = await requirePermission('rag.documents.read')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const docs = await db.userDocument.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { chunks: true } } },
  })

  return NextResponse.json({
    ok: true,
    documents: docs.map(d => ({
      id: d.id,
      title: d.title,
      fileType: d.fileType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      chunksCount: d._count.chunks,
      createdAt: d.createdAt,
      processedAt: d.processedAt,
    })),
  })
}

// Delete a document
export async function DELETE(req: NextRequest) {
  const authCheck = await requirePermission('rag.documents.delete')
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status })
  }
  const { ctx } = authCheck

  const url = new URL(req.url)
  const docId = url.searchParams.get('id')
  if (!docId) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 })
  }

  const doc = await db.userDocument.findUnique({ where: { id: docId } })
  if (!doc || doc.userId !== ctx.userId) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  // Delete chunks from vector store
  const store = getVectorStore()
  await store.deleteByDocumentId(doc.id)

  // Delete file
  try {
    await fs.unlink(doc.storagePath)
  } catch {}

  // Delete DB records (cascades to chunks)
  await db.userDocument.delete({ where: { id: doc.id } })

  await audit('document.deleted', {
    userId: ctx.userId,
    resourceType: 'document',
    resourceId: doc.id,
  })

  return NextResponse.json({ ok: true })
}
