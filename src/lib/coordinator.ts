// AXIOM — R25: Coordinación y grupos (fase 1)
// Service layer para el panel de coordinación: grupos, membresías (estudiante/maestro)
// y progreso de sólo lectura de los miembros. Toda mutación exige groups.manage y
// ownership del grupo (coordinador creador). El maestro observa (groups.read) sin gestionar.

import { db } from '@/lib/db'
import { logger, audit } from '@/lib/observability'
import { type Role } from '@/lib/types'

export type RoleInGroup = 'student' | 'maestro'

export interface MemberProgress {
  userId: string
  name: string | null
  email: string
  controlNumber: string | null
  roleInGroup: RoleInGroup
  sessions30d: number
  lastActivityAt: string | null
  cefrCurrent: string | null
  minutes30d: number
}

export interface CoordinatorGroup {
  id: string
  name: string
  institution: { id: string; name: string; status: string } | null
  canManage: boolean
  createdAt: string
  members: MemberProgress[]
}

// ---------------------------------------------------------------- instituciones (R26)

export interface InstitutionRow {
  id: string
  name: string
  status: string
  verificationCode: string
  verifiedAt: string | null
  createdAt: string
  canVerify: boolean
}

// El coordinador solicita el alta: la institución nace PENDING con su código
// de verificación; un ADMIN la valida con institutions.verify.
export async function createInstitution(opts: {
  requestedById: string
  name: string
}): Promise<{ ok: true; institutionId: string; verificationCode: string } | { ok: false; error: string }> {
  const name = opts.name.trim()
  if (name.length < 3 || name.length > 120) {
    return { ok: false, error: 'El nombre de la institución debe tener entre 3 y 120 caracteres' }
  }

  // Límite defensivo: 20 solicitudes pendientes por solicitante
  const pending = await db.institution.count({ where: { requestedById: opts.requestedById, status: 'PENDING' } })
  if (pending >= 20) {
    return { ok: false, error: 'Tienes 20 instituciones pendientes de verificar. Espera la validación de un administrador.' }
  }

  // Código único tipo AX-INST-XXXXXX (base32 sin caracteres ambiguos)
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  for (let attempt = 0; attempt < 5; attempt++) {
    let suffix = ''
    for (let i = 0; i < 6; i++) suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    const verificationCode = `AX-INST-${suffix}`
    const clash = await db.institution.findUnique({ where: { verificationCode } })
    if (clash) continue

    const inst = await db.institution.create({
      data: { name, verificationCode, status: 'PENDING', requestedById: opts.requestedById },
    })
    await audit('institutions.requested', {
      userId: opts.requestedById,
      resourceType: 'institution',
      resourceId: inst.id,
      metadata: { name, verificationCode },
    })
    logger.info('institutions.requested', { institution_id: inst.id, requester_id: opts.requestedById })
    return { ok: true, institutionId: inst.id, verificationCode }
  }
  return { ok: false, error: 'No se pudo generar un código único. Intenta de nuevo.' }
}

// Admin: lista todas; coordinador/maestro: las VERIFIED + las que él solicitó (PENDING)
export async function listInstitutionsForUser(userId: string, roles: Role[]): Promise<InstitutionRow[]> {
  const isAdmin = roles.includes('ADMIN')
  const insts = await db.institution.findMany({
    where: isAdmin ? {} : { OR: [{ status: 'VERIFIED' }, { requestedById: userId }] },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 100,
  })
  return insts.map(i => ({
    id: i.id,
    name: i.name,
    status: i.status,
    verificationCode: i.verificationCode,
    verifiedAt: i.verifiedAt ? i.verifiedAt.toISOString() : null,
    createdAt: i.createdAt.toISOString(),
    canVerify: isAdmin && i.status === 'PENDING',
  }))
}

export async function verifyInstitution(opts: {
  verifierId: string
  institutionId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const inst = await db.institution.findUnique({ where: { id: opts.institutionId } })
  if (!inst) return { ok: false, error: 'Institución no encontrada' }
  if (inst.status === 'VERIFIED') return { ok: false, error: 'La institución ya está verificada' }

  await db.institution.update({
    where: { id: inst.id },
    data: { status: 'VERIFIED', verifiedAt: new Date() },
  })
  await audit('institutions.verified', {
    userId: opts.verifierId,
    resourceType: 'institution',
    resourceId: inst.id,
    metadata: { name: inst.name, verificationCode: inst.verificationCode },
  })
  logger.info('institutions.verified', { institution_id: inst.id, verifier_id: opts.verifierId })
  return { ok: true }
}

// R28 — consulta pública del código de institución (sin sesión, sin PII):
// la escuela puede confirmar que su código AX-INST-XXXXXX está activo antes de
// compartirlo con sus alumnos. Los códigos PENDING no se ocultan por completo:
// se informa que aún no están verificados (útil durante la espera del alta).
export interface PublicInstitutionLookup {
  found: boolean
  name?: string
  status?: 'PENDING' | 'VERIFIED'
  verifiedAt?: string | null
}

export async function lookupInstitutionByCode(code: string): Promise<PublicInstitutionLookup> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return { found: false }
  const inst = await db.institution.findUnique({ where: { verificationCode: normalized } })
  if (!inst) return { found: false }
  return {
    found: true,
    name: inst.name,
    status: inst.status === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
    verifiedAt: inst.verifiedAt ? inst.verifiedAt.toISOString() : null,
  }
}

// ---------------------------------------------------------------- métricas de grupo (R26)

export interface GroupMetrics {
  groupId: string
  name: string
  totalMembers: number
  students: number
  maestros: number
  active30d: number          // miembros con ≥1 sesión en 30 días
  sessions30d: number        // sesiones acumuladas del grupo
  minutes30d: number         // minutos acumulados del grupo
  engagementPct: number      // active30d / alumnos × 100
  avgSessionsPerActive: number
  cefrDistribution: Record<string, number> // A1..C2 + 'Sin nivel'
  lastActivityAt: string | null
}

export async function getGroupMetrics(opts: {
  userId: string
  roles: Role[]
  groupId: string
}): Promise<{ ok: true; metrics: GroupMetrics } | { ok: false; error: string }> {
  const isAdmin = opts.roles.includes('ADMIN')
  const isCoordinator = opts.roles.includes('COORDINADOR') || isAdmin

  const group = await db.group.findUnique({
    where: { id: opts.groupId },
    include: {
      members: {
        include: {
          user: {
            include: {
              profile: { select: { cefrCurrent: true } },
              learningSessions: {
                where: { startedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
                select: { startedAt: true, durationSec: true },
              },
            },
          },
        },
      },
    },
  })
  if (!group) return { ok: false, error: 'Grupo no encontrado' }

  // Coordinador dueño o admin: acceso total; maestro: sólo si es miembro del grupo
  if (isCoordinator) {
    if (group.coordinatorId !== opts.userId && !isAdmin) {
      return { ok: false, error: 'Sólo el coordinador del grupo puede ver sus métricas' }
    }
  } else {
    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: opts.userId } },
    })
    if (!membership) return { ok: false, error: 'No participas en este grupo' }
  }

  const students = group.members.filter(m => m.roleInGroup === 'student')
  let sessions30d = 0
  let minutes30d = 0
  let last: Date | null = null
  const cefrDistribution: Record<string, number> = {}
  for (const m of group.members) {
    sessions30d += m.user.learningSessions.length
    minutes30d += m.user.learningSessions.reduce((acc, s) => acc + Math.round((s.durationSec ?? 0) / 60), 0)
    for (const s of m.user.learningSessions) {
      const t = s.startedAt.getTime()
      if (!last || t > last.getTime()) last = s.startedAt
    }
    const level = m.user.profile?.cefrCurrent || 'Sin nivel'
    cefrDistribution[level] = (cefrDistribution[level] || 0) + 1
  }
  const active30d = group.members.filter(m => m.user.learningSessions.length > 0).length
  const engagementPct = students.length ? Math.round((active30d / students.length) * 100) : 0
  const avgSessionsPerActive = active30d ? Math.round((sessions30d / active30d) * 10) / 10 : 0

  return {
    ok: true,
    metrics: {
      groupId: group.id,
      name: group.name,
      totalMembers: group.members.length,
      students: students.length,
      maestros: group.members.filter(m => m.roleInGroup === 'maestro').length,
      active30d,
      sessions30d,
      minutes30d,
      engagementPct,
      avgSessionsPerActive,
      cefrDistribution,
      lastActivityAt: last ? last.toISOString() : null,
    },
  }
}

// ---------------------------------------------------------------- importación masiva (R26)

export interface BulkEntryResult {
  email: string
  status: 'added' | 'updated' | 'exists' | 'error'
  message: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Parser de la lista pegada (R26): un correo por línea, opcionalmente
// "correo,student|maestro" o "correo;maestro" o "correo maestro".
// Sin rol explícito → student. Marca las líneas malformadas para avisar sin abortar.
export function parseBulkText(text: string): Array<{ email: string; roleInGroup: RoleInGroup; invalid?: string }> {
  return text
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const parts = line.split(/[,;\s]+/).filter(Boolean)
      const email = (parts[0] || '').toLowerCase()
      const roleRaw = (parts[1] || '').toLowerCase()
      if (!EMAIL_RE.test(email)) {
        return { email, roleInGroup: 'student' as RoleInGroup, invalid: 'Correo inválido' }
      }
      if (roleRaw && roleRaw !== 'student' && roleRaw !== 'maestro' && roleRaw !== 'estudiante') {
        return { email, roleInGroup: 'student' as RoleInGroup, invalid: `Rol desconocido «${roleRaw}» (usa student o maestro)` }
      }
      const roleInGroup: RoleInGroup = roleRaw === 'maestro' ? 'maestro' : 'student'
      return { email, roleInGroup }
    })
}

// Núcleo compartido por addMember (individual) y bulkAddMembers: sin chequeo de
// ownership (el llamador ya lo validó) — mantiene el resto idéntico.
async function addMemberCore(opts: {
  actorId: string
  groupId: string
  email: string
  roleInGroup: RoleInGroup
}): Promise<{ ok: true; memberId: string; status: 'added' | 'updated' } | { ok: false; error: string; status: 'exists' | 'error' }> {
  const email = opts.email.toLowerCase().trim()
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return { ok: false, status: 'error', error: `No existe una cuenta con el correo ${email}` }

  // Límite defensivo: 200 miembros por grupo
  const count = await db.groupMember.count({ where: { groupId: opts.groupId } })
  if (count >= 200) {
    return { ok: false, status: 'error', error: 'El grupo alcanzó el límite de 200 miembros' }
  }

  const existing = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: opts.groupId, userId: user.id } },
  })
  if (existing) {
    // Idempotente amable: actualizar el rol si cambió
    if (existing.roleInGroup !== opts.roleInGroup) {
      await db.groupMember.update({
        where: { id: existing.id },
        data: { roleInGroup: opts.roleInGroup },
      })
      await audit('groups.member_role_updated', {
        userId: opts.actorId,
        resourceType: 'group_member',
        resourceId: existing.id,
        metadata: { groupId: opts.groupId, roleInGroup: opts.roleInGroup },
      })
      return { ok: true, memberId: existing.id, status: 'updated' }
    }
    return { ok: false, status: 'exists', error: 'Ese correo ya pertenece al grupo' }
  }

  const member = await db.groupMember.create({
    data: {
      groupId: opts.groupId,
      userId: user.id,
      roleInGroup: opts.roleInGroup,
    },
  })

  await audit('groups.member_added', {
    userId: opts.actorId,
    resourceType: 'group_member',
    resourceId: member.id,
    metadata: { groupId: opts.groupId, memberEmail: email, roleInGroup: opts.roleInGroup },
  })
  logger.info('groups.member_added', { group_id: opts.groupId, member_user_id: user.id })

  return { ok: true, memberId: member.id, status: 'added' }
}

// ---------------------------------------------------------------- listar

export async function listGroupsForUser(userId: string, roles: Role[]): Promise<CoordinatorGroup[]> {
  const canManage = roles.includes('COORDINADOR') || roles.includes('ADMIN')

  const groups = await db.group.findMany({
    where: canManage
      ? { coordinatorId: userId }
      : { members: { some: { userId, roleInGroup: 'maestro' } } },
    include: {
      institution: true,
      members: {
        include: {
          user: {
            include: {
              profile: true,
              learningSessions: {
                where: { startedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
                select: { startedAt: true, durationSec: true },
              },
            },
          },
        },
        orderBy: { addedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return groups.map(g => ({
    id: g.id,
    name: g.name,
    institution: g.institution
      ? { id: g.institution.id, name: g.institution.name, status: g.institution.status }
      : null,
    canManage,
    createdAt: g.createdAt.toISOString(),
    members: g.members.map(m => {
      const started = m.user.learningSessions.map(s => s.startedAt)
      const lastActivity = started.length ? new Date(Math.max(...started.map(d => d.getTime()))) : null
      const minutes = m.user.learningSessions.reduce((acc, s) => acc + Math.round((s.durationSec ?? 0) / 60), 0)
      return {
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        controlNumber: m.user.controlNumber,
        roleInGroup: (m.roleInGroup === 'maestro' ? 'maestro' : 'student') as RoleInGroup,
        sessions30d: m.user.learningSessions.length,
        lastActivityAt: lastActivity ? lastActivity.toISOString() : null,
        cefrCurrent: m.user.profile?.cefrCurrent ?? null,
        minutes30d: minutes,
      }
    }),
  }))
}

// ---------------------------------------------------------------- crear / eliminar

export async function createGroup(opts: {
  coordinatorId: string
  name: string
  institutionId?: string | null
}): Promise<{ ok: true; groupId: string } | { ok: false; error: string }> {
  const name = opts.name.trim()
  if (name.length < 2 || name.length > 80) {
    return { ok: false, error: 'El nombre del grupo debe tener entre 2 y 80 caracteres' }
  }

  if (opts.institutionId) {
    const inst = await db.institution.findUnique({ where: { id: opts.institutionId } })
    if (!inst) return { ok: false, error: 'Institución no encontrada' }
  }

  // Límite defensivo: 40 grupos por coordinador
  const count = await db.group.count({ where: { coordinatorId: opts.coordinatorId } })
  if (count >= 40) {
    return { ok: false, error: 'Alcanzaste el límite de 40 grupos. Elimina uno para crear otro.' }
  }

  const group = await db.group.create({
    data: {
      name,
      coordinatorId: opts.coordinatorId,
      institutionId: opts.institutionId ?? null,
    },
  })

  await audit('groups.created', {
    userId: opts.coordinatorId,
    resourceType: 'group',
    resourceId: group.id,
    metadata: { name },
  })
  logger.info('groups.created', { group_id: group.id, coordinator_id: opts.coordinatorId })

  return { ok: true, groupId: group.id }
}

export async function deleteGroup(opts: {
  coordinatorId: string
  groupId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const group = await db.group.findUnique({ where: { id: opts.groupId } })
  if (!group) return { ok: false, error: 'Grupo no encontrado' }
  if (group.coordinatorId !== opts.coordinatorId) {
    await audit('groups.delete_denied', {
      userId: opts.coordinatorId,
      resourceType: 'group',
      resourceId: opts.groupId,
    })
    return { ok: false, error: 'Sólo el coordinador del grupo puede eliminarlo' }
  }

  await db.group.delete({ where: { id: opts.groupId } }) // members en cascada
  await audit('groups.deleted', {
    userId: opts.coordinatorId,
    resourceType: 'group',
    resourceId: opts.groupId,
  })
  return { ok: true }
}

// ---------------------------------------------------------------- membresías

export async function addMember(opts: {
  coordinatorId: string
  groupId: string
  email: string
  roleInGroup: RoleInGroup
}): Promise<{ ok: true; memberId: string } | { ok: false; error: string }> {
  const group = await db.group.findUnique({ where: { id: opts.groupId } })
  if (!group) return { ok: false, error: 'Grupo no encontrado' }
  if (group.coordinatorId !== opts.coordinatorId) {
    return { ok: false, error: 'Sólo el coordinador del grupo puede agregar miembros' }
  }

  const result = await addMemberCore({
    actorId: opts.coordinatorId,
    groupId: opts.groupId,
    email: opts.email,
    roleInGroup: opts.roleInGroup,
  })
  if (!result.ok) return { ok: false, error: result.error }
  return { ok: true, memberId: result.memberId }
}

// Importación masiva (R26): alta de muchos miembros en una sola operación.
// Devuelve el resultado por entrada; nunca aborta por un error individual.
export async function bulkAddMembers(opts: {
  coordinatorId: string
  groupId: string
  entries: Array<{ email: string; roleInGroup: RoleInGroup }>
}): Promise<{ ok: true; results: BulkEntryResult[]; added: number; updated: number; failed: number } | { ok: false; error: string }> {
  const group = await db.group.findUnique({ where: { id: opts.groupId } })
  if (!group) return { ok: false, error: 'Grupo no encontrado' }
  if (group.coordinatorId !== opts.coordinatorId) {
    return { ok: false, error: 'Sólo el coordinador del grupo puede importar miembros' }
  }
  if (opts.entries.length === 0) return { ok: false, error: 'La lista está vacía' }
  if (opts.entries.length > 100) {
    return { ok: false, error: 'Máximo 100 correos por importación. Divide la lista.' }
  }

  const results: BulkEntryResult[] = []
  let added = 0, updated = 0, failed = 0
  for (const entry of opts.entries) {
    const r = await addMemberCore({
      actorId: opts.coordinatorId,
      groupId: opts.groupId,
      email: entry.email,
      roleInGroup: entry.roleInGroup,
    })
    if (r.ok) {
      results.push({ email: entry.email.toLowerCase().trim(), status: r.status, message: r.status === 'added' ? 'Agregado' : 'Rol actualizado' })
      if (r.status === 'added') added++; else updated++
    } else {
      results.push({ email: entry.email.toLowerCase().trim(), status: r.status === 'exists' ? 'exists' : 'error', message: r.error })
      failed++
    }
  }

  await audit('groups.bulk_import', {
    userId: opts.coordinatorId,
    resourceType: 'group',
    resourceId: opts.groupId,
    metadata: { total: opts.entries.length, added, updated, failed },
  })
  logger.info('groups.bulk_import', { group_id: opts.groupId, added, updated, failed })

  return { ok: true, results, added, updated, failed }
}

export async function removeMember(opts: {
  coordinatorId: string
  groupId: string
  userId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const group = await db.group.findUnique({ where: { id: opts.groupId } })
  if (!group) return { ok: false, error: 'Grupo no encontrado' }
  if (group.coordinatorId !== opts.coordinatorId) {
    return { ok: false, error: 'Sólo el coordinador del grupo puede remover miembros' }
  }

  const member = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId: opts.groupId, userId: opts.userId } },
  })
  if (!member) return { ok: false, error: 'Ese usuario no pertenece al grupo' }

  await db.groupMember.delete({ where: { id: member.id } })
  await audit('groups.member_removed', {
    userId: opts.coordinatorId,
    resourceType: 'group_member',
    resourceId: member.id,
    metadata: { groupId: opts.groupId, removedUserId: opts.userId },
  })
  return { ok: true }
}

// ---------------------------------------------------------------- instituciones (lectura para el panel)

export async function listVerifiedInstitutions(): Promise<Array<{ id: string; name: string; status: string }>> {
  const insts = await db.institution.findMany({
    where: { status: 'VERIFIED' },
    orderBy: { name: 'asc' },
  })
  return insts.map(i => ({ id: i.id, name: i.name, status: i.status }))
}
