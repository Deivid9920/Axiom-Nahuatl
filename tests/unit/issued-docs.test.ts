// R27 — documentos emitidos: JSON canónico, huella SHA-256, folio, dedupe y verificación
// R28 — panel admin: listado de documentos emitidos y revocación idempotente
import { describe, test, expect } from 'vitest'
import {
  canonicalJson, sha256Hex, buildFolio,
  issueReportDocument, verifyDocumentByFolio, maskEmail,
  listIssuedDocuments, revokeIssuedDocument, reinstateIssuedDocument,
} from '@/lib/issued-docs'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

async function seedHolder(email = 'holder@t.mx', name = 'Titular Prueba') {
  const passwordHash = await hashPassword('ClaveSegura#123')
  return prisma.user.create({ data: { email, name, passwordHash, profile: { create: {} } } })
}

describe('R27 — utilidades puras', () => {
  test('canonicalJson es estable ante reordenamiento de claves (incluido anidado)', () => {
    const a = canonicalJson({ b: 1, a: { d: [3, 1], c: 'x' } })
    const b = canonicalJson({ a: { c: 'x', d: [3, 1] }, b: 1 })
    expect(a).toBe(b)
    expect(a).toBe('{"a":{"c":"x","d":[3,1]},"b":1}')
  })

  test('sha256Hex produce el SHA-256 esperado', () => {
    // SHA-256 de «abc» (vector de prueba estándar)
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })

  test('buildFolio respeta el formato AX-DMR-YYYY-XXXXXX sin caracteres ambiguos', () => {
    for (let i = 0; i < 20; i++) {
      expect(buildFolio()).toMatch(/^AX-DMR-\d{4}-[A-HJ-KM-NP-Z2-9]{6}$/)
    }
  })

  test('maskEmail oculta el local pero conserva el dominio', () => {
    expect(maskEmail('ana.lopez@empresa.mx')).toBe('an' + '•'.repeat(7) + '@empresa.mx')
    expect(maskEmail('a@x.mx')).toBe('a' + '•' + '@x.mx')
  })
})

describe('R27 — emisión y verificación', () => {
  test('emitir crea el registro con huella y dedupeKey; re-emitir el mismo día reutiliza el folio', async () => {
    const holder = await seedHolder()
    const issuer = await seedHolder('emisor@t.mx', 'Emisor')
    const snapshot = { windowDays: 30, cefrCurrent: 'B1', sessionsCount: 12 }

    const first = await issueReportDocument({
      userId: holder.id, holderName: 'Titular Prueba', holderEmail: 'holder@t.mx',
      windowDays: 30, snapshot, issuedBy: issuer.id,
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.reused).toBe(false)
    expect(first.folio).toMatch(/^AX-DMR-\d{4}-/)
    expect(first.verifyPath).toBe(`/verificar/${first.folio}`)

    const second = await issueReportDocument({
      userId: holder.id, holderName: 'Titular Prueba', holderEmail: 'holder@t.mx',
      windowDays: 30, snapshot, issuedBy: issuer.id,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.reused).toBe(true)
    expect(second.folio).toBe(first.folio) // imprimir dos veces = un solo documento

    // Ventana distinta el mismo día → folio nuevo
    const other = await issueReportDocument({
      userId: holder.id, holderName: 'Titular Prueba', holderEmail: 'holder@t.mx',
      windowDays: 90, snapshot, issuedBy: issuer.id,
    })
    expect(other.ok).toBe(true)
    if (!other.ok) return
    expect(other.folio).not.toBe(first.folio)

    const rows = await prisma.issuedDocument.findMany({ where: { userId: holder.id } })
    expect(rows).toHaveLength(2)
  })

  test('verifyDocumentByFolio: encontrado con integridad ok, no encontrado, y snapshot alterado detectado', async () => {
    const holder = await seedHolder('verify@t.mx')
    const issued = await issueReportDocument({
      userId: holder.id, holderName: 'Alumno Verificado', holderEmail: 'verify@t.mx',
      windowDays: 15, snapshot: { windowDays: 15, cefrCurrent: 'A2' }, issuedBy: holder.id,
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const okView = await verifyDocumentByFolio(issued.folio)
    expect(okView.found).toBe(true)
    if (!okView.found) return
    expect(okView.integrity).toBe('ok')
    expect(okView.revoked).toBe(false)
    expect(okView.holderName).toBe('Alumno Verificado')
    expect(okView.holderEmailMasked).not.toContain('verify@t.mx') // correo enmascarado

    const missing = await verifyDocumentByFolio('AX-DMR-1999-NOPE00')
    expect(missing).toEqual({ found: false })

    // Alteración directa del snapshot en BD (sin actualizar la huella) → tampered
    const row = await prisma.issuedDocument.findUnique({ where: { folio: issued.folio } })
    expect(row).not.toBeNull()
    await prisma.issuedDocument.update({
      where: { id: row!.id },
      data: { payloadJson: '{"windowDays":15,"cefrCurrent":"C2"}' },
    })
    const tampered = await verifyDocumentByFolio(issued.folio)
    expect(tampered.found).toBe(true)
    if (!tampered.found) return
    expect(tampered.integrity).toBe('tampered')
  })
})

describe('R28 — panel admin: listado y revocación', () => {
  test('revokeIssuedDocument: revoca con motivo, queda reflejado en verify y es idempotente', async () => {
    const holder = await seedHolder('revoke@t.mx', 'Alumno Revocado')
    const admin = await seedHolder('admin-revoca@t.mx', 'Admin Revoca')
    const issued = await issueReportDocument({
      userId: holder.id, holderName: 'Alumno Revocado', holderEmail: 'revoke@t.mx',
      windowDays: 30, snapshot: { windowDays: 30, cefrCurrent: 'B1' }, issuedBy: admin.id,
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const first = await revokeIssuedDocument({ actorId: admin.id, folio: issued.folio, reason: 'Datos incorrectos reportados por la escuela' })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.alreadyRevoked).toBeFalsy()

    const row = await prisma.issuedDocument.findUnique({ where: { folio: issued.folio } })
    expect(row?.revokedAt).not.toBeNull()
    expect(row?.revokedBy).toBe(admin.id)
    expect(row?.revokedReason).toBe('Datos incorrectos reportados por la escuela')

    // La verificación pública refleja el estado revocado (integridad intacta)
    const view = await verifyDocumentByFolio(issued.folio)
    expect(view.found).toBe(true)
    if (!view.found) return
    expect(view.revoked).toBe(true)
    expect(view.integrity).toBe('ok')

    // Idempotente: revocar de nuevo no cambia la fecha ni el motivo
    const second = await revokeIssuedDocument({ actorId: admin.id, folio: issued.folio, reason: 'otro motivo' })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.alreadyRevoked).toBe(true)
    const row2 = await prisma.issuedDocument.findUnique({ where: { folio: issued.folio } })
    expect(row2?.revokedReason).toBe('Datos incorrectos reportados por la escuela')

    // Folio inexistente → error claro
    const missing = await revokeIssuedDocument({ actorId: admin.id, folio: 'AX-DMR-1999-NOPE00' })
    expect(missing).toEqual({ ok: false, error: 'Documento no encontrado' })
  })

  test('listIssuedDocuments: lista con estado de revocación e integridad, emisor resuelto', async () => {
    const holder = await seedHolder('listado@t.mx', 'Alumno Listado')
    const admin = await seedHolder('admin-lista@t.mx', 'Admin Lista')
    const issued = await issueReportDocument({
      userId: holder.id, holderName: 'Alumno Listado', holderEmail: 'listado@t.mx',
      windowDays: 30, snapshot: { windowDays: 30 }, issuedBy: admin.id,
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const rows = await listIssuedDocuments(50)
    const mine = rows.find(r => r.folio === issued.folio)
    expect(mine).toBeDefined()
    expect(mine!.revokedAt).toBeNull()
    expect(mine!.integrity).toBe('ok')
    expect(mine!.issuedByName).toBe('Admin Lista')
    expect(mine!.holderEmail).toBe('listado@t.mx')

    await revokeIssuedDocument({ actorId: admin.id, folio: issued.folio, reason: 'Prueba de listado' })
    const rowsAfter = await listIssuedDocuments(50)
    const mineAfter = rowsAfter.find(r => r.folio === issued.folio)
    expect(mineAfter?.revokedAt).not.toBeNull()
    expect(mineAfter?.revokedReason).toBe('Prueba de listado')
  })
})

describe('R29-b — reversión de revocaciones (un-revoke)', () => {
  test('reinstateIssuedDocument: revocado → válido de nuevo en /verificar, misma huella e integridad', async () => {
    const holder = await seedHolder('reinstate@t.mx', 'Alumno Restaurado')
    const admin = await seedHolder('admin-restaura@t.mx', 'Admin Restaura')
    const issued = await issueReportDocument({
      userId: holder.id, holderName: 'Alumno Restaurado', holderEmail: 'reinstate@t.mx',
      windowDays: 30, snapshot: { windowDays: 30, cefrCurrent: 'B1' }, issuedBy: admin.id,
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    await revokeIssuedDocument({ actorId: admin.id, folio: issued.folio, reason: 'Falsa alarma' })
    const revokedView = await verifyDocumentByFolio(issued.folio)
    expect(revokedView.found).toBe(true)
    if (!revokedView.found) return
    expect(revokedView.revoked).toBe(true)
    const hashWhenRevoked = revokedView.payloadHash

    const r = await reinstateIssuedDocument({ actorId: admin.id, folio: issued.folio })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.wasRevoked).toBe(true)

    // La verificación pública vuelve a «Documento válido» con la MISMA huella
    const view = await verifyDocumentByFolio(issued.folio)
    expect(view.found).toBe(true)
    if (!view.found) return
    expect(view.revoked).toBe(false)
    expect(view.integrity).toBe('ok')
    expect(view.payloadHash).toBe(hashWhenRevoked)

    // En BD no quedan restos de la revocación
    const row = await prisma.issuedDocument.findUnique({ where: { folio: issued.folio } })
    expect(row?.revokedAt).toBeNull()
    expect(row?.revokedBy).toBeNull()
    expect(row?.revokedReason).toBeNull()
  })

  test('reinstate es idempotente (documento vigente → wasRevoked false) y folio inexistente → error', async () => {
    const holder = await seedHolder('reinstate2@t.mx')
    const admin = await seedHolder('admin-restaura2@t.mx')
    const issued = await issueReportDocument({
      userId: holder.id, holderName: 'Titular', holderEmail: 'reinstate2@t.mx',
      windowDays: 30, snapshot: { windowDays: 30 }, issuedBy: admin.id,
    })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    // Nunca revocado → no cambia nada
    const r = await reinstateIssuedDocument({ actorId: admin.id, folio: issued.folio })
    expect(r).toEqual({ ok: true, wasRevoked: false })

    // Reinstaurar dos veces: la segunda ya no encuentra revocación
    await revokeIssuedDocument({ actorId: admin.id, folio: issued.folio, reason: 'x' })
    const first = await reinstateIssuedDocument({ actorId: admin.id, folio: issued.folio })
    expect(first).toEqual({ ok: true, wasRevoked: true })
    const second = await reinstateIssuedDocument({ actorId: admin.id, folio: issued.folio })
    expect(second).toEqual({ ok: true, wasRevoked: false })

    // Folio inexistente → error claro
    const missing = await reinstateIssuedDocument({ actorId: admin.id, folio: 'AX-DMR-1999-NOPE00' })
    expect(missing).toEqual({ ok: false, error: 'Documento no encontrado' })
  })
})
