// R26 — coordinación fase 2: permisos de instituciones, registro con código escolar,
// controlNumber, métricas agregadas por grupo e importación masiva.
// Nota: tests/setup.ts limpia TODAS las tablas en beforeEach, así que cada test
// siembra su propio fixture.
import { describe, test, expect } from 'vitest'
import { hasPermission, registerUser } from '@/lib/auth'
import {
  listGroupsForUser, createGroup, addMember, createInstitution, listMyInstitutions,
  parseBulkRoster, bulkAddMembers, generateInstitutionCode,
} from '@/lib/coordinator'
import { prisma } from '../setup'
import { hashPassword } from '@/lib/auth'

async function seedFixture() {
  for (const name of ['STUDENT', 'COORDINADOR', 'MAESTRO', 'ADMIN']) {
    await prisma.role.upsert({ where: { name }, create: { name }, update: {} })
  }
  const passwordHash = await hashPassword('axiom12345')

  async function makeUser(email: string, name: string, roleNames: string[], cefr = 'A2') {
    return prisma.user.create({
      data: {
        email, name, passwordHash,
        profile: { create: { cefrCurrent: cefr, cefrInitial: cefr } },
        ...(roleNames.length ? { userRoles: { create: roleNames.map(r => ({ role: { connect: { name: r } } })) } } : {}),
      },
    })
  }

  const coordinator = await makeUser('coord26@t.mx', 'Coord R26', ['STUDENT', 'COORDINADOR'])
  const other = await makeUser('other26@t.mx', 'Other R26', ['STUDENT'])
  const alumno = await makeUser('alumno26@t.mx', 'Alumno R26', ['STUDENT'], 'B1')
  const alumno2 = await makeUser('alumno26b@t.mx', 'Alumno B R26', ['STUDENT'], 'B1')
  return { coordinatorId: coordinator.id, otherId: other.id, alumnoId: alumno.id, alumno2Id: alumno2.id }
}

describe('permisos de instituciones (R26)', () => {
  test('COORDINADOR y ADMIN tienen institutions.manage; MAESTRO y STUDENT no', () => {
    expect(hasPermission(['COORDINADOR'], 'institutions.manage')).toBe(true)
    expect(hasPermission(['ADMIN'], 'institutions.manage')).toBe(true)
    expect(hasPermission(['MAESTRO'], 'institutions.manage')).toBe(false)
    expect(hasPermission(['STUDENT'], 'institutions.manage')).toBe(false)
  })
})

describe('verificación de registro escolar (R26)', () => {
  test('registro con código de institución PENDING: la verifica, vincula al usuario y notifica el nombre', async () => {
    await seedFixture()
    const inst = await prisma.institution.create({
      data: { name: 'Escuela Pending', verificationCode: 'AX-INST-PEND01', status: 'PENDING' },
    })

    const result = await registerUser({
      email: 'nuevo@escuela.mx',
      password: 'Axi0m!R26',
      name: 'Nuevo Alumno',
      institutionCode: 'ax-inst-pend01', // minúsculas: se normaliza
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.institutionName).toBe('Escuela Pending')

    const instAfter = await prisma.institution.findUnique({ where: { id: inst.id } })
    expect(instAfter?.status).toBe('VERIFIED')
    expect(instAfter?.verifiedAt).not.toBeNull()

    const user = await prisma.user.findUnique({ where: { email: 'nuevo@escuela.mx' } })
    expect(user?.institutionId).toBe(inst.id)

    // ya no existe el rol STUDENT en el test DB? sí, lo creamos en el fixture
    const roles = await prisma.userRole.findMany({ where: { userId: user!.id }, include: { role: true } })
    expect(roles.map(r => r.role.name)).toContain('STUDENT')
  })

  test('registro con código VERIFIED: vincula sin re-verificar; código inválido rechaza con mensaje claro', async () => {
    await seedFixture()
    const inst = await prisma.institution.create({
      data: { name: 'Escuela Ya', verificationCode: 'AX-INST-OK0001', status: 'VERIFIED', verifiedAt: new Date() },
    })

    const ok = await registerUser({ email: 'segundo@escuela.mx', password: 'Axi0m!R26', institutionCode: 'AX-INST-OK0001' })
    expect(ok.ok).toBe(true)
    const instAfter = await prisma.institution.findUnique({ where: { id: inst.id } })
    expect(instAfter?.status).toBe('VERIFIED')
    const u2 = await prisma.user.findUnique({ where: { email: 'segundo@escuela.mx' } })
    expect(u2?.institutionId).toBe(inst.id)

    const bad = await registerUser({ email: 'tercero@escuela.mx', password: 'Axi0m!R26', institutionCode: 'AX-INST-NOPE' })
    expect(bad).toEqual({ ok: false, error: expect.stringContaining('código de institución no es válido') })
    expect(await prisma.user.findUnique({ where: { email: 'tercero@escuela.mx' } })).toBeNull()
  })

  test('controlNumber: se guarda normalizado; duplicado rechazado; longitud inválida rechazada', async () => {
    await seedFixture()

    const ok = await registerUser({ email: 'con@control.mx', password: 'Axi0m!R26', controlNumber: '  A01234567  ' })
    expect(ok.ok).toBe(true)
    const user = await prisma.user.findUnique({ where: { email: 'con@control.mx' } })
    expect(user?.controlNumber).toBe('A01234567')

    const dup = await registerUser({ email: 'otro@control.mx', password: 'Axi0m!R26', controlNumber: 'A01234567' })
    expect(dup).toEqual({ ok: false, error: 'Ese número de control ya está registrado' })

    const short = await registerUser({ email: 'corto@control.mx', password: 'Axi0m!R26', controlNumber: 'AB' })
    expect(short).toEqual({ ok: false, error: expect.stringContaining('entre 3 y 40') })

    // vacío → se ignora silenciosamente (campo opcional)
    const empty = await registerUser({ email: 'sin@control.mx', password: 'Axi0m!R26', controlNumber: '   ' })
    expect(empty.ok).toBe(true)
    const u = await prisma.user.findUnique({ where: { email: 'sin@control.mx' } })
    expect(u?.controlNumber).toBeNull()
  })
})

describe('instituciones del coordinador (R26)', () => {
  test('createInstitution genera código PENDING con formato y listMyInstitutions cuenta miembros/grupos', async () => {
    const fx = await seedFixture()

    const bad = await createInstitution({ coordinatorId: fx.coordinatorId, name: 'ab' })
    expect(bad).toEqual({ ok: false, error: expect.stringContaining('entre 3 y 120') })

    const created = await createInstitution({ coordinatorId: fx.coordinatorId, name: 'Institución R26' })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.code).toMatch(/^AX-INST-[A-HJ-NP-Z2-9]{8}$/)

    const inst = await prisma.institution.findUnique({ where: { id: created.institutionId } })
    expect(inst?.status).toBe('PENDING')
    expect(inst?.createdById).toBe(fx.coordinatorId)

    // código generado es del alfabeto sin ambiguos
    for (let i = 0; i < 20; i++) {
      expect(generateInstitutionCode()).toMatch(/^AX-INST-[A-HJ-NP-Z2-9]{8}$/)
    }

    // un grupo + un usuario vinculado → conteos
    const g = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Inst', institutionId: created.institutionId })
    if (!g.ok) throw new Error('setup grupo falló')
    await prisma.user.update({ where: { id: fx.alumnoId }, data: { institutionId: created.institutionId } })

    const mine = await listMyInstitutions(fx.coordinatorId)
    expect(mine).toHaveLength(1)
    expect(mine[0].code).toBe(created.code)
    expect(mine[0].status).toBe('PENDING')
    expect(mine[0].memberCount).toBe(1)
    expect(mine[0].groupCount).toBe(1)

    // el otro coordinador no la ve
    expect(await listMyInstitutions(fx.otherId)).toHaveLength(0)
  })
})

describe('parseBulkRoster (R26)', () => {
  test('filas válidas con rol por columna, default y separadores variados', () => {
    const parsed = parseBulkRoster(
      'uno@t.mx\ndos@t.mx, maestro\n tres@t.mx ; Estudiante \ncuatro@t.mx\talumno\n\n',
      'student'
    )
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.rows).toEqual([
      { email: 'uno@t.mx', roleInGroup: 'student' },
      { email: 'dos@t.mx', roleInGroup: 'maestro' },
      { email: 'tres@t.mx', roleInGroup: 'student' },
      { email: 'cuatro@t.mx', roleInGroup: 'student' },
    ])
  })

  test('errores: correo inválido, rol desconocido, columnas extra, duplicados; líneas en blanco toleradas', () => {
    const parsed = parseBulkRoster(
      'no-email\nuno@t.mx, director\nuno@t.mx\ndos@t.mx, maestro, extra\nuno@t.mx',
      'student'
    )
    // «uno@t.mx» (línea 3, sin rol) sí es válida; la última es repetida
    expect(parsed.rows).toEqual([{ email: 'uno@t.mx', roleInGroup: 'student' }])
    expect(parsed.errors.map(e => e.error)).toEqual([
      'Correo inválido',
      'Rol no reconocido: «director» (usa estudiante o maestro)',
      'Demasiadas columnas (formato: correo, rol)',
      'Correo repetido en la lista',
    ])
  })
})

describe('bulkAddMembers y métricas (R26)', () => {
  test('importa existentes, reporta sin-cuenta y duplicados; ownership denegado para otros', async () => {
    const fx = await seedFixture()
    const g = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Bulk' })
    if (!g.ok) throw new Error('setup falló')
    const gid = g.groupId

    // ownership: otro coordinador no puede importar
    const foreign = await bulkAddMembers({
      coordinatorId: fx.otherId, groupId: gid,
      rows: [{ email: 'alumno26@t.mx', roleInGroup: 'student' }],
    })
    expect(foreign).toEqual({ ok: false, error: expect.stringContaining('coordinador') })

    const result = await bulkAddMembers({
      coordinatorId: fx.coordinatorId, groupId: gid,
      rows: [
        { email: 'alumno26@t.mx', roleInGroup: 'student' },     // alta
        { email: 'alumno26b@t.mx', roleInGroup: 'student' },    // alta
        { email: 'fantasma@t.mx', roleInGroup: 'student' },     // sin cuenta → fallida
        { email: 'alumno26@t.mx', roleInGroup: 'student' },     // duplicado mismo rol
        { email: 'alumno26b@t.mx', roleInGroup: 'maestro' },    // actualización de rol
      ],
    })
    if (!result.ok) throw new Error('bulk falló')
    expect(result.ok).toBe(true)
    expect(result.added).toBe(2)
    expect(result.updated).toBe(1)
    expect(result.duplicates).toBe(1)
    expect(result.failed).toEqual([{ email: 'fantasma@t.mx', error: expect.stringContaining('Sin cuenta') }])

    const members = await prisma.groupMember.findMany({ where: { groupId: gid } })
    expect(members).toHaveLength(2)
  })

  test('listGroupsForUser expone métricas agregadas: sesiones, minutos, activos, participación y CEFR', async () => {
    const fx = await seedFixture()
    const g = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Métricas' })
    if (!g.ok) throw new Error('setup falló')
    const gid = g.groupId
    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno26@t.mx', roleInGroup: 'student' })
    await addMember({ coordinatorId: fx.coordinatorId, groupId: gid, email: 'alumno26b@t.mx', roleInGroup: 'student' })

    // alumno26: 2 sesiones (20 + 10 min); alumno26b: sin actividad
    await prisma.learningSession.create({
      data: {
        userId: fx.alumnoId, module: 'chat', mode: 'tutor', domain: 'general', cefrTarget: 'B1',
        scenarioTitle: 'T1', startedAt: new Date(Date.now() - 86400000), endedAt: new Date(),
        durationSec: 1200, messagesCount: 5, status: 'completed',
      },
    })
    await prisma.learningSession.create({
      data: {
        userId: fx.alumnoId, module: 'text', mode: 'writing', domain: 'general', cefrTarget: 'B1',
        scenarioTitle: 'T2', startedAt: new Date(Date.now() - 2 * 86400000), endedAt: new Date(),
        durationSec: 600, messagesCount: 2, status: 'completed',
      },
    })

    const group = (await listGroupsForUser(fx.coordinatorId, ['COORDINADOR'])).find(x => x.id === gid)!
    expect(group.metrics.students).toBe(2)
    expect(group.metrics.maestros).toBe(0)
    expect(group.metrics.sessions30d).toBe(2)
    expect(group.metrics.minutes30d).toBe(30)
    expect(group.metrics.activeMembers30d).toBe(1)
    expect(group.metrics.participationPct).toBe(50)
    expect(group.metrics.cefrDistribution).toEqual([{ level: 'B1', count: 2 }])

    // grupo vacío → métricas en cero y participación 0
    const g2 = await createGroup({ coordinatorId: fx.coordinatorId, name: 'Grupo Vacío' })
    if (!g2.ok) throw new Error('setup falló')
    const empty = (await listGroupsForUser(fx.coordinatorId, ['COORDINADOR'])).find(x => x.id === g2.groupId)!
    expect(empty.metrics.participationPct).toBe(0)
    expect(empty.metrics.cefrDistribution).toEqual([])
  })
})
