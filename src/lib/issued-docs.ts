// AXIOM — R27: documentos emitidos con folio en BD, huella SHA-256 y verificación pública.
// Fase 2 del documento formal (R23): el folio deja de ser sólo determinista y pasa a
// registrarse en IssuedDocument; el documento impreso lleva QR hacia /verificar/[folio].
// La re-emisión del mismo documento el mismo día reutiliza el folio (dedupeKey).

import { createHash, randomInt } from 'node:crypto'
import { db } from '@/lib/db'
import { logger, audit } from '@/lib/observability'

export const ISSUED_FOLIO_PREFIX = 'AX-DMR' // prefijo del reporte formal, heredado del folio determinista de R23

// ---------------------------------------------------------------- utilidades puras

// JSON canónico: claves ordenadas recursivamente y sin espacios — estable para hashear
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

const FOLIO_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

// Folio tipo AX-DMR-2026-K7M3XQ (base32 sin caracteres ambiguos)
export function buildFolio(): string {
  const year = new Date().getFullYear()
  let suffix = ''
  for (let i = 0; i < 6; i++) suffix += FOLIO_ALPHABET[randomInt(FOLIO_ALPHABET.length)]
  return `${ISSUED_FOLIO_PREFIX}-${year}-${suffix}`
}

// ---------------------------------------------------------------- emisión

export interface IssueReportDocResult {
  ok: true
  folio: string
  issuedAt: string
  reused: boolean
  verifyPath: string
}

export async function issueReportDocument(opts: {
  userId: string
  holderName: string
  holderEmail: string
  windowDays: number
  snapshot: Record<string, unknown>
  issuedBy: string
}): Promise<IssueReportDocResult | { ok: false; error: string }> {
  if (!opts.holderEmail) return { ok: false, error: 'Falta el correo del titular' }
  const ymd = new Date().toISOString().slice(0, 10)
  const dedupeKey = `report:${opts.userId}:${opts.windowDays}:${ymd}`

  // Re-emisión el mismo día → mismo folio (imprimir dos veces no genera dos documentos)
  const existing = await db.issuedDocument.findUnique({ where: { dedupeKey } })
  const payloadJson = canonicalJson(opts.snapshot)
  const payloadHash = sha256Hex(payloadJson)

  if (existing) {
    // Si cambió el contenido (p. ej. más sesiones hoy), se actualiza el snapshot
    // manteniendo el folio: el documento del día refleja el estado al imprimirse.
    await db.issuedDocument.update({
      where: { id: existing.id },
      data: { payloadJson, payloadHash },
    })
    logger.info('docs.reissued', { folio: existing.folio, dedupe_key: dedupeKey })
    return {
      ok: true,
      folio: existing.folio,
      issuedAt: existing.issuedAt.toISOString(),
      reused: true,
      verifyPath: `/verificar/${existing.folio}`,
    }
  }

  // Folio único con reintentos ante colisión (espacio de 32^6 ≈ 1.07e9)
  for (let attempt = 0; attempt < 5; attempt++) {
    const folio = buildFolio()
    const clash = await db.issuedDocument.findUnique({ where: { folio } })
    if (clash) continue
    try {
      const doc = await db.issuedDocument.create({
        data: {
          folio,
          dedupeKey,
          kind: 'report',
          holderName: opts.holderName || opts.holderEmail,
          holderEmail: opts.holderEmail,
          userId: opts.userId,
          issuedBy: opts.issuedBy,
          payloadJson,
          payloadHash,
        },
      })
      await audit('documents.issued', {
        userId: opts.issuedBy,
        resourceType: 'issued_document',
        resourceId: doc.id,
        metadata: { folio, holderEmail: opts.holderEmail, windowDays: opts.windowDays },
      })
      logger.info('docs.issued', { folio, dedupe_key: dedupeKey })
      return {
        ok: true,
        folio,
        issuedAt: doc.issuedAt.toISOString(),
        reused: false,
        verifyPath: `/verificar/${folio}`,
      }
    } catch {
      // Carrera (p. ej. doble montaje en dev): otro create pudo ganar con el mismo
      // dedupeKey → devolvemos su folio (idempotente). Si no, colisión de folio → reintenta.
      const raced = await db.issuedDocument.findUnique({ where: { dedupeKey } })
      if (raced) {
        await db.issuedDocument.update({
          where: { id: raced.id },
          data: { payloadJson, payloadHash },
        })
        return {
          ok: true,
          folio: raced.folio,
          issuedAt: raced.issuedAt.toISOString(),
          reused: true,
          verifyPath: `/verificar/${raced.folio}`,
        }
      }
    }
  }
  return { ok: false, error: 'No se pudo asignar un folio único. Reintenta.' }
}

// ---------------------------------------------------------------- verificación

export type IntegrityStatus = 'ok' | 'tampered'

export interface VerificationView {
  found: true
  folio: string
  kind: string
  holderName: string
  holderEmailMasked: string
  issuedAt: string
  revoked: boolean
  integrity: IntegrityStatus
  payloadHash: string
  snapshot: Record<string, unknown>
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, Math.min(2, local.length))
  return `${visible}${'•'.repeat(Math.max(local.length - visible.length, 1))}@${domain}`
}

export type VerifyResult =
  | { found: false }
  | VerificationView

export async function verifyDocumentByFolio(folio: string): Promise<VerifyResult> {
  const normalized = folio.trim().toUpperCase()
  const doc = await db.issuedDocument.findUnique({ where: { folio: normalized } })
  if (!doc) return { found: false }

  // Integridad: la huella guardada debe corresponder al snapshot almacenado.
  // Un cambio directo en la BD del snapshot (sin actualizar la huella) se detecta.
  let integrity: IntegrityStatus = sha256Hex(doc.payloadJson) === doc.payloadHash ? 'ok' : 'tampered'

  let snapshot: Record<string, unknown> = {}
  try {
    snapshot = JSON.parse(doc.payloadJson) as Record<string, unknown>
  } catch {
    integrity = 'tampered'
  }

  return {
    found: true,
    folio: doc.folio,
    kind: doc.kind,
    holderName: doc.holderName,
    holderEmailMasked: maskEmail(doc.holderEmail),
    issuedAt: doc.issuedAt.toISOString(),
    revoked: Boolean(doc.revokedAt),
    integrity,
    payloadHash: doc.payloadHash,
    snapshot,
  }
}

// ---------------------------------------------------------------- panel admin (R28)

export interface IssuedDocRow {
  id: string
  folio: string
  kind: string
  holderName: string
  holderEmail: string
  issuedAt: string
  issuedByName: string | null
  revokedAt: string | null
  revokedReason: string | null
  integrity: IntegrityStatus
}

// Listado reciente de documentos emitidos para el panel admin (con estado de
// integridad calculado contra la huella almacenada — sin exponer el snapshot).
export async function listIssuedDocuments(take = 50): Promise<IssuedDocRow[]> {
  const docs = await db.issuedDocument.findMany({
    orderBy: { issuedAt: 'desc' },
    take: Math.min(Math.max(take, 1), 100),
  })

  const issuerIds = [...new Set(docs.map(d => d.issuedBy).filter((v): v is string => Boolean(v)))]
  const issuers = issuerIds.length
    ? await db.user.findMany({ where: { id: { in: issuerIds } }, select: { id: true, name: true, email: true } })
    : []
  const issuerName = new Map(issuers.map(u => [u.id, u.name || u.email]))

  return docs.map(d => ({
    id: d.id,
    folio: d.folio,
    kind: d.kind,
    holderName: d.holderName,
    holderEmail: d.holderEmail,
    issuedAt: d.issuedAt.toISOString(),
    issuedByName: d.issuedBy ? issuerName.get(d.issuedBy) || null : null,
    revokedAt: d.revokedAt ? d.revokedAt.toISOString() : null,
    revokedReason: d.revokedReason || null,
    integrity: sha256Hex(d.payloadJson) === d.payloadHash ? 'ok' : 'tampered',
  }))
}

// Revocación desde el panel admin (sólo ADMIN, permiso documents.revoke):
// el documento pierde toda validez y la página pública /verificar/[folio] pasa a
// mostrar «Documento revocado». Es idempotente: revocar dos veces no cambia nada.
export async function revokeIssuedDocument(opts: {
  actorId: string
  folio: string
  reason?: string
}): Promise<{ ok: true; alreadyRevoked?: boolean } | { ok: false; error: string }> {
  const normalized = opts.folio.trim().toUpperCase()
  const doc = await db.issuedDocument.findUnique({ where: { folio: normalized } })
  if (!doc) return { ok: false, error: 'Documento no encontrado' }

  if (doc.revokedAt) {
    return { ok: true, alreadyRevoked: true }
  }

  const reason = opts.reason?.trim().slice(0, 200) || null
  await db.issuedDocument.update({
    where: { id: doc.id },
    data: { revokedAt: new Date(), revokedBy: opts.actorId, revokedReason: reason },
  })
  await audit('documents.revoked', {
    userId: opts.actorId,
    resourceType: 'issued_document',
    resourceId: doc.id,
    metadata: { folio: doc.folio, reason: reason || undefined },
  })
  logger.info('docs.revoked', { folio: doc.folio, actor_id: opts.actorId })
  return { ok: true }
}

// R29-b — reversión de revocaciones (un-revoke, sólo ADMIN, permiso documents.revoke):
// el documento recupera su validez y la página pública /verificar/[folio] vuelve a
// mostrar «Documento válido» con la misma huella (el snapshot no se toca). Idempotente:
// reinstaurar un documento vigente no cambia nada.
export async function reinstateIssuedDocument(opts: {
  actorId: string
  folio: string
}): Promise<{ ok: true; wasRevoked: boolean } | { ok: false; error: string }> {
  const normalized = opts.folio.trim().toUpperCase()
  const doc = await db.issuedDocument.findUnique({ where: { folio: normalized } })
  if (!doc) return { ok: false, error: 'Documento no encontrado' }

  if (!doc.revokedAt) {
    return { ok: true, wasRevoked: false }
  }

  await db.issuedDocument.update({
    where: { id: doc.id },
    data: { revokedAt: null, revokedBy: null, revokedReason: null },
  })
  await audit('documents.reinstated', {
    userId: opts.actorId,
    resourceType: 'issued_document',
    resourceId: doc.id,
    metadata: { folio: doc.folio },
  })
  logger.info('docs.reinstated', { folio: doc.folio, actor_id: opts.actorId })
  return { ok: true, wasRevoked: true }
}
