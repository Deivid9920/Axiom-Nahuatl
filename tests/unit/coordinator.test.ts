// R25 — coordinación y grupos: permisos por rol + service layer con BD de pruebas
// Nota: tests/setup.ts limpia TODAS las tablas en beforeEach, así que cada test
// siembra su propio fixture con seedFixture() al inicio.
import { describe, test, expect } from 'vitest'
import { hasPermission, registerUser } from '@/lib/auth'
import {
  listGroupsForUser, createGroup, deleteGroup, addMember, removeMember,
  createInstitution, listInstitutionsForUser, verifyInstitution,
  getGroupMetrics, bulkAddMembers, parseBulkText, lookupInstitutionByCode,
} from '@/lib/coordinator'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

async function seedFixture() {
  for (const name of ['STUDENT', 'COORDINADOR', 'MAESTRO', 'ADMIN']) {
    await prisma.role.upsert({ where: { name }, create: { name }, update: {} })
  }
  const passwordHash = await hashPassword('axiom12345')

  async function makeUser(email: string, name: string, roleNames: string[], controlNumber?: string, cefr = 'A2') {
    return prisma.user.create({
      data: {
        email, name, passwordHash, controlNumber,
        profile: { create: { cefrCurrent: cefr, cefrInitial: cefr } },
        ...(roleNames.length ? { userRoles: { create: roleNames.map(r => ({ role: { connect: { name: r } } })) } } : {}),
      },
    })
  }

  const coordinator = await makeUser('coord@t.mx', 'Coord T', ['STUDENT', 'COORDINADOR'])
  const maestro = await makeUser('maestro@t.mx', 'Maestro T', ['STUDENT', 'MAESTRO'], undefined, 'C1')
  const alumno = await makeUser('alumno@t.mx', 'Alumno T', ['STUDENT'], 'AX-T-001')
  const other = await makeUser('other@t.mx', 'Other T', ['STUDENT'])
  const inst = await prisma.institution.create({
    data: { name: 'Inst Test', verificationCode: 'AX-T-INST', status: 'VERIFIED', verifiedAt: new Date() },
  })
  return { coordinatorId: coordinator.id, maestroId: maestro.id, alumnoId: alumno.id, otherId: other.id, institutionId: inst.id }
}

describe('permisos por rol (R25)', () => {
  test('COORDINADOR: groups.read + groups.manage + progress.read, sin admin.*', () => {
    expect(hasPermission(['COORDINADOR'], 'groups.read')).toBe(true)
    expect(hasPermission(['COORDINADOR'], 'groups.manage')).toBe(true)
    expect(hasPermission(['COORDINADOR'], 'groups.progress.read')).toBe(true)
    expect(hasPermission(['COORDINADOR'], 'admin.users.read')).toBe(false)
  })

  test('MAESTRO: groups.read + progress.read pero SIN groups.manage (sólo lectura)', () => {
    expect(hasPermission(['MAESTRO'], 'groups.read')).toBe(true)
    expect(hasPermission(['MAESTRO'], 'groups.progress.read')).toBe(true)
    expect(hasPermission(['MAESTRO'], 'groups.manage')).toBe(false)
  })

  test('STUDENT: sin permisos de grupos', () => {
    expect(hasPermission(['STUDENT'], 'groups.read')).toBe(false)
    expect(hasPermission(['STUDENT'], 'groups.manage')).toBe(false)
  })

  test('ADMIN: hereda todo el bloque de grupos', () => {
    expect(hasPermission(['ADMIN'], 'groups.read')).toBe(true)
    expect(hasPermission(['ADMIN'], 'groups.manage')).toBe(true)
  })
})

describe('service de grupos (R25)', () => {
  test('crear grupo con y sin institución; nombre inválido rechazado', async () => {
    const fx = await seedFixture()

    const ok = await createGroup({ coordinatorId: fx.coordinatorId, name: 'B1 · Ventas', institutionId: fx.institutionId })
    expect(ok.ok).toBe(true)

    const ok2 = await createGroup({ coordinatorId: fx.coordinatorId, name: '  B2 · Entrevistas  ' })
    expect(ok2.ok).toBe(true)

    const bad = await createGroup({ coordinatorId: fx.coordinatorId, name: 'x' })
    expect(bad).toEqual({ ok: false, error: expect.stringContaining('2 y 80') })

    const badInst = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo válido', institutionId: 'noexiste' })
    expect(badInst).toEqual({ ok: false, error: 'Institución no encontrada' })
  })

  test('listar: el coordinador ve sus grupos gestionables; el maestro sólo los suyos', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo A', institutionId: fx.institutionId })
    if (!created.ok) throw new Error('setup grupo falló')
    await addMember({ coordinatorId: fx.coordinatorId, groupId: created.groupId, email: 'maestro@t.mx', roleInGroup: 'maestro' })
    await addMember({ coordinatorId: fx.coordinatorId, groupId: created.groupId, email: 'alumno@t.mx', roleInGroup: 'student' })

    // Otro grupo de otro coordinador donde el maestro NO participa
    const otherGroup = await createGroup({ coordinatorId: fx.otherId, name: 'Grupo ajeno' })
    if (!otherGroup.ok) throw new Error('setup grupo ajeno falló')

    const asCoordinator = await listGroupsForUser(fx.coordinatorId, ['STUDENT', 'COORDINADOR'])
    expect(asCoordinator.map(g => g.name)).toContain('Grupo A')
    expect(asCoordinator.map(g => g.name)).not.toContain('Grupo ajeno')
    const ga = asCoordinator.find(g => g.name === 'Grupo A')!
    expect(ga.canManage).toBe(true)
    expect(ga.institution?.name).toBe('Inst Test')
    expect(ga.members).toHaveLength(2)

    const asMaestro = await listGroupsForUser(fx.maestroId, ['STUDENT', 'MAESTRO'])
    expect(asMaestro.map(g => g.name)).toEqual(['Grupo A'])
    expect(asMaestro[0].canManage).toBe(false) // observación sólo lectura
    const m = asMaestro[0].members.find(x => x.userId === fx.alumnoId)!
    expect(m.roleInGroup).toBe('student')
    expect(m.controlNumber).toBe('AX-T-001')
    expect(m.cefrCurrent).toBe('A2')

    // Un alumno sin membresías no ve nada
    const asOther = await listGroupsForUser(fx.otherId, ['STUDENT'])
    expect(asOther).toHaveLength(0)
  })

  test('addMember: usuario inexistente, duplicado amable y actualización de rol', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo B' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId

    const missing = await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'nadie@t.mx', roleInGroup: 'student' })
    expect(missing.ok).toBe(false)

    const first = await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })
    expect(first.ok).toBe(true)

    const dup = await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })
    expect(dup).toEqual({ ok: false, error: 'Ese correo ya pertenece al grupo' })

    // mismo correo con rol distinto → actualiza en vez de rechazar
    const promoted = await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'maestro' })
    expect(promoted.ok).toBe(true)
    const g = (await listGroupsForUser(fx.coordinatorId, ['COORDINADOR'])).find(x => x.id === gid)!
    expect(g.members[0].roleInGroup).toBe('maestro')
  })

  test('ownership: otro coordinador no puede agregar/remover/eliminar', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo C' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId

    const foreign = await addMember({ coordinatorId: fx.otherId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })
    expect(foreign).toEqual({ ok: false, error: expect.stringContaining('coordinador') })

    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })
    const foreignRemove = await removeMember({ coordinatorId: fx.otherId, groupId: gid, userId: fx.alumnoId })
    expect(foreignRemove).toEqual({ ok: false, error: expect.stringContaining('coordinador') })

    const foreignDelete = await deleteGroup({ coordinatorId: fx.otherId, groupId: gid })
    expect(foreignDelete).toEqual({ ok: false, error: expect.stringContaining('coordinador') })
  })

  test('removeMember elimina la membresía y deleteGroup hace cascada', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo D' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId
    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })

    const rm = await removeMember({ coordinatorId: fx.coordinatorId, groupId: gid, userId: fx.alumnoId })
    expect(rm.ok).toBe(true)
    const g1 = (await listGroupsForUser(fx.coordinatorId, ['COORDINADOR'])).find(x => x.id === gid)!
    expect(g1.members).toHaveLength(0)

    // re-agregar y eliminar el grupo completo
    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })
    const del = await deleteGroup({ coordinatorId: fx.coordinatorId, groupId: gid })
    expect(del.ok).toBe(true)
    expect(await prisma.groupMember.count({ where: { groupId: gid } })).toBe(0)
    expect(await prisma.group.count({ where: { id: gid } })).toBe(0)
  })

  test('progreso de actividad: sesiones y minutos de los últimos 30 días', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo E' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId
    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })

    await prisma.learningSession.create({
      data: {
        userId: fx.alumnoId, module: 'chat', mode: 'tutor', domain: 'general', cefrTarget: 'A2',
        scenarioTitle: 'T', startedAt: new Date(Date.now() - 86400000), endedAt: new Date(),
        durationSec: 1200, messagesCount: 5, status: 'completed',
      },
    })

    const g = (await listGroupsForUser(fx.coordinatorId, ['COORDINADOR'])).find(x => x.id === gid)!
    const m = g.members[0]
    expect(m.sessions30d).toBe(1)
    expect(m.minutes30d).toBe(20)
    expect(m.lastActivityAt).not.toBeNull()
  })
})

// ===================== R26 — fase 2: instituciones, métricas, importación masiva =====================

describe('R26 — instituciones escolares', () => {
  test('createInstitution nace PENDING con código AX-INST-XXXXXX; nombre inválido rechazado', async () => {
    const fx = await seedFixture()

    const bad = await createInstitution({ requestedById: fx.coordinatorId, name: 'ab' })
    expect(bad).toEqual({ ok: false, error: expect.stringContaining('3 y 120') })

    const ok = await createInstitution({ requestedById: fx.coordinatorId, name: 'Colegio Nuevo Horizonte' })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    expect(ok.verificationCode).toMatch(/^AX-INST-[A-Z2-9]{6}$/)
    const row = await prisma.institution.findUnique({ where: { id: ok.institutionId } })
    expect(row?.status).toBe('PENDING')
    expect(row?.requestedById).toBe(fx.coordinatorId)
  })

  test('listInstitutionsForUser: admin ve todas; coordinador ve VERIFIED + propias', async () => {
    const fx = await seedFixture()
    const mine = await createInstitution({ requestedById: fx.coordinatorId, name: 'Institución Propia' })
    if (!mine.ok) throw new Error('setup falló')

    const asAdmin = await listInstitutionsForUser(fx.otherId, ['ADMIN'])
    expect(asAdmin.length).toBeGreaterThanOrEqual(2) // Inst Test (fixture) + propia
    expect(asAdmin.some(i => i.id === mine.institutionId && i.status === 'PENDING')).toBe(true)

    const asCoord = await listInstitutionsForUser(fx.coordinatorId, ['COORDINADOR'])
    const mineRow = asCoord.find(i => i.id === mine.institutionId)
    expect(mineRow).toBeDefined()
    expect(mineRow?.canVerify).toBe(false) // coordinador no verifica

    const adminRow = asAdmin.find(i => i.id === mine.institutionId)!
    expect(adminRow.canVerify).toBe(true) // admin sí puede verificar
  })

  test('verifyInstitution: sólo ADMIN (permiso), idempotencia protegida', async () => {
    const fx = await seedFixture()
    const inst = await createInstitution({ requestedById: fx.coordinatorId, name: 'Academia por Verificar' })
    if (!inst.ok) throw new Error('setup falló')

    expect(hasPermission(['COORDINADOR'], 'institutions.verify')).toBe(false)
    expect(hasPermission(['ADMIN'], 'institutions.verify')).toBe(true)

    const ok = await verifyInstitution({ verifierId: fx.otherId, institutionId: inst.institutionId })
    expect(ok.ok).toBe(true)
    const row = await prisma.institution.findUnique({ where: { id: inst.institutionId } })
    expect(row?.status).toBe('VERIFIED')
    expect(row?.verifiedAt).not.toBeNull()

    const again = await verifyInstitution({ verifierId: fx.otherId, institutionId: inst.institutionId })
    expect(again).toEqual({ ok: false, error: expect.stringContaining('ya está verificada') })

    const missing = await verifyInstitution({ verifierId: fx.otherId, institutionId: 'noexiste' })
    expect(missing).toEqual({ ok: false, error: 'Institución no encontrada' })
  })

  test('R28 — lookupInstitutionByCode: consulta pública normalizada sin PII', async () => {
    const fx = await seedFixture()

    // Código VERIFIED sembrado por el fixture (AX-T-INST) → encontrado, mayúsculas/espacios normalizados
    const verified = await lookupInstitutionByCode('  ax-t-inst  ')
    expect(verified).toMatchObject({ found: true, name: 'Inst Test', status: 'VERIFIED' })
    expect(verified.verifiedAt).toBeTruthy()

    // Código PENDING → encontrado con estado pendiente (la escuela espera su alta)
    const pending = await createInstitution({ requestedById: fx.coordinatorId, name: 'Escuela en Espera' })
    if (!pending.ok) throw new Error('setup falló')
    const pendingLookup = await lookupInstitutionByCode(pending.verificationCode)
    expect(pendingLookup).toMatchObject({ found: true, status: 'PENDING' })

    // Código inexistente o vacío → { found: false } (nunca lanza)
    expect(await lookupInstitutionByCode('AX-INST-NOEXISTE')).toEqual({ found: false })
    expect(await lookupInstitutionByCode('')).toEqual({ found: false })
  })
})

describe('R26 — métricas agregadas por grupo', () => {
  test('agrega sesiones, minutos, engagement y distribución CEFR', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Métricas' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId
    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno@t.mx', roleInGroup: 'student' })
    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'maestro@t.mx', roleInGroup: 'maestro' })

    const day = (offset: number) => new Date(Date.now() - offset * 86400000)
    await prisma.learningSession.create({
      data: { userId: fx.alumnoId, module: 'chat', mode: 'tutor', domain: 'general', cefrTarget: 'A2', scenarioTitle: 'S1', startedAt: day(1), endedAt: new Date(), durationSec: 1800, messagesCount: 6, status: 'completed' },
    })
    await prisma.learningSession.create({
      data: { userId: fx.alumnoId, module: 'typing', mode: 'general', domain: 'general', cefrTarget: 'A2', scenarioTitle: 'S2', startedAt: day(2), endedAt: new Date(), durationSec: 600, messagesCount: 2, status: 'completed' },
    })

    const res = await getGroupMetrics({ userId: fx.coordinatorId, roles: ['COORDINADOR'], groupId: gid })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.metrics.totalMembers).toBe(2)
    expect(res.metrics.students).toBe(1)
    expect(res.metrics.maestros).toBe(1)
    expect(res.metrics.active30d).toBe(1)           // sólo el alumno tuvo sesiones
    expect(res.metrics.engagementPct).toBe(100)     // 1 activo / 1 alumno
    expect(res.metrics.sessions30d).toBe(2)
    expect(res.metrics.minutes30d).toBe(40)         // 30 + 10
    expect(res.metrics.avgSessionsPerActive).toBe(2)
    expect(res.metrics.cefrDistribution['A2']).toBe(1)   // alumno
    expect(res.metrics.cefrDistribution['C1']).toBe(1)   // maestro
  })

  test('acceso: coordinador foráneo rechazado; maestro miembro puede leer; maestro externo no', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Acceso' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId

    const foreign = await getGroupMetrics({ userId: fx.otherId, roles: ['COORDINADOR'], groupId: gid })
    expect(foreign).toEqual({ ok: false, error: expect.stringContaining('coordinador') })

    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'maestro@t.mx', roleInGroup: 'maestro' })
    const asMaestro = await getGroupMetrics({ userId: fx.maestroId, roles: ['MAESTRO'], groupId: gid })
    expect(asMaestro.ok).toBe(true)

    const external = await getGroupMetrics({ userId: fx.otherId, roles: ['MAESTRO'], groupId: gid })
    expect(external).toEqual({ ok: false, error: 'No participas en este grupo' })
  })
})

describe('R26 — importación masiva', () => {
  test('parseBulkText: correos con rol por coma/punto y coma/espacio; líneas inválidas marcadas', async () => {
    const parsed = parseBulkText([
      'ANA@T.mx',
      'beto@t.mx, maestro',
      'carla@t.mx;maestro',
      'diego@t.mx maestro',
      'no-es-correo',
      'eva@t.mx, rolRaro',
      '', '   ',
    ].join('\n'))
    expect(parsed).toHaveLength(6)
    expect(parsed[0]).toEqual({ email: 'ana@t.mx', roleInGroup: 'student' })
    expect(parsed[1]).toEqual({ email: 'beto@t.mx', roleInGroup: 'maestro' })
    expect(parsed[2]).toEqual({ email: 'carla@t.mx', roleInGroup: 'maestro' })
    expect(parsed[3]).toEqual({ email: 'diego@t.mx', roleInGroup: 'maestro' })
    expect(parsed[4].invalid).toContain('Correo inválido')
    expect(parsed[5].invalid).toContain('Rol desconocido')
  })

  test('bulkAddMembers: agrega, actualiza roles, reporta duplicados y fallas por correo inexistente', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Bulk' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId

    const res = await bulkAddMembers({
      coordinatorId: fx.coordinatorId,
      groupId: gid,
      entries: [
        { email: 'alumno@t.mx', roleInGroup: 'student' },     // added
        { email: 'other@t.mx', roleInGroup: 'student' },      // added
        { email: 'alumno@t.mx', roleInGroup: 'maestro' },     // updated (cambia rol)
        { email: 'fantasma@t.mx', roleInGroup: 'student' },   // error (no existe)
      ],
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.added).toBe(2)
    expect(res.updated).toBe(1)
    expect(res.failed).toBe(1)
    const statuses = res.results.map(r => r.status)
    expect(statuses).toEqual(['added', 'added', 'updated', 'error'])

    const members = await prisma.groupMember.findMany({ where: { groupId: gid } })
    expect(members).toHaveLength(2)
    expect(members.find(m => m.userId === fx.alumnoId)?.roleInGroup).toBe('maestro')
  })

  test('bulkAddMembers: ownership y límites (lista vacía, >100)', async () => {
    const fx = await seedFixture()
    const created = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Bulk 2' })
    if (!created.ok) throw new Error('setup falló')
    const gid = created.groupId

    const foreign = await bulkAddMembers({ coordinatorId: fx.otherId, groupId: gid, entries: [{ email: 'alumno@t.mx', roleInGroup: 'student' }] })
    expect(foreign).toEqual({ ok: false, error: expect.stringContaining('coordinador') })

    const empty = await bulkAddMembers({ coordinatorId: fx.coordinatorId, groupId: gid, entries: [] })
    expect(empty).toEqual({ ok: false, error: 'La lista está vacía' })

    const many = await bulkAddMembers({
      coordinatorId: fx.coordinatorId, groupId: gid,
      entries: Array.from({ length: 101 }, (_, i) => ({ email: `x${i}@t.mx`, roleInGroup: 'student' as const })),
    })
    expect(many).toEqual({ ok: false, error: expect.stringContaining('100') })
  })
})

describe('R26 — registro con número de control e institución', () => {
  test('registerUser persiste controlNumber único y vincula institución VERIFIED por código', async () => {
    const fx = await seedFixture()
    // institutionCode sensible a mayúsculas/espacios → se normaliza a AX-T-INST (VERIFIED en fixture)
    const res = await registerUser({
      email: 'nuevo@t.mx', password: 'ClaveSegura#123', name: 'Nuevo Alumno',
      controlNumber: 'AX-T-999', institutionCode: '  ax-t-inst ',
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const user = await prisma.user.findUnique({ where: { email: 'nuevo@t.mx' }, include: { institution: true } })
    expect(user?.controlNumber).toBe('AX-T-999')
    expect(user?.institution?.name).toBe('Inst Test')

    // controlNumber duplicado → error amable
    const dup = await registerUser({ email: 'otro@t.mx', password: 'ClaveSegura#123', controlNumber: 'AX-T-999' })
    expect(dup).toEqual({ ok: false, error: expect.stringContaining('ya está registrado') })

    // código de institución inexistente / no verificada → error
    const badCode = await registerUser({ email: 'otro2@t.mx', password: 'ClaveSegura#123', institutionCode: 'AX-NOPE-00' })
    expect(badCode).toEqual({ ok: false, error: expect.stringContaining('no es válido') })

    const pendingInst = await prisma.institution.create({
      data: { name: 'Pendiente T', verificationCode: 'AX-T-PEND', status: 'PENDING' },
    })
    const notVerified = await registerUser({ email: 'otro3@t.mx', password: 'ClaveSegura#123', institutionCode: pendingInst.verificationCode })
    expect(notVerified).toEqual({ ok: false, error: expect.stringContaining('no es válido') })
  })
})
