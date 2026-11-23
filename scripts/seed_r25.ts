// Seed R25 — coordinación y grupos (fase 1) sobre el seed base. Idempotente:
// roles COORDINADOR/MAESTRO, institución demo verificada, grupo demo coordinado
// por admin@axiom.mx con un maestro observador y alumnos con actividad mínima.

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'

const db = new PrismaClient()

export async function seedCoordinacionR25() {
  // 1. Roles nuevos
  for (const r of [
    { name: 'COORDINADOR', description: 'Gestiona grupos e instituciones; ve el progreso de sus miembros' },
    { name: 'MAESTRO', description: 'Observación de sólo lectura de los grupos donde participa' },
  ]) {
    await db.role.upsert({ where: { name: r.name }, create: r, update: { description: r.description } })
  }
  console.log('✓ roles COORDINADOR / MAESTRO')

  const admin = await db.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (!admin) {
    console.log('⚠ usuario demo ausente — corre scripts/seed.ts primero')
    return
  }

  // 2. admin@axiom.mx también es COORDINADOR (accede al panel en la demo)
  const coordRole = await db.role.findUnique({ where: { name: 'COORDINADOR' } })
  if (coordRole) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: coordRole.id } },
      create: { userId: admin.id, roleId: coordRole.id },
      update: {},
    })
  }
  console.log('✓ admin@axiom.mx como COORDINADOR')

  // 3. Institución demo verificada
  const inst = await db.institution.upsert({
    where: { verificationCode: 'AX-INST-DEMO' },
    create: {
      name: 'Academia Axiom Nearshoring',
      verificationCode: 'AX-INST-DEMO',
      status: 'VERIFIED',
      verifiedAt: new Date(),
    },
    update: { status: 'VERIFIED', verifiedAt: new Date() },
  })
  console.log('✓ institución demo verificada')

  // 4. Usuarios demo: maestro observador + 3 alumnos
  const passwordHash = await hashPassword('axiom12345')
  const studentRole = await db.role.findUnique({ where: { name: 'STUDENT' } })
  const maestroRole = await db.role.findUnique({ where: { name: 'MAESTRO' } })

  async function ensureUser(email: string, name: string, controlNumber: string, asMaestro = false, cefr = 'A2') {
    let u = await db.user.findUnique({ where: { email } })
    if (!u) {
      u = await db.user.create({
        data: {
          email,
          name,
          passwordHash,
          controlNumber,
          profile: {
            create: {
              cefrInitial: cefr,
              cefrCurrent: cefr,
              onboardingCompleted: true,
              onboardedAt: new Date(),
            },
          },
        },
      })
    } else if (!u.controlNumber) {
      await db.user.update({ where: { id: u.id }, data: { controlNumber } })
    }
    if (studentRole) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: studentRole.id } },
        create: { userId: u.id, roleId: studentRole.id },
        update: {},
      })
    }
    if (asMaestro && maestroRole) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId: u.id, roleId: maestroRole.id } },
        create: { userId: u.id, roleId: maestroRole.id },
        update: {},
      })
    }
    return u
  }

  const maestro = await ensureUser('maestro1@axiom.mx', 'Ana Maestra', 'AX-M-001', true, 'C1')
  const a1 = await ensureUser('alumno1@axiom.mx', 'Luis Alumno', 'AX-A-001', false, 'A2')
  const a2 = await ensureUser('alumno2@axiom.mx', 'Sofía Alumna', 'AX-A-002', false, 'B1')
  await ensureUser('alumno3@axiom.mx', 'Diego Alumno', 'AX-A-003', false, 'A1')
  console.log('✓ usuarios demo (maestro1, alumno1..3)')

  // 5. Grupo demo
  let group = await db.group.findFirst({ where: { coordinatorId: admin.id, name: 'B1 · Inglés para Nearshoring' } })
  if (!group) {
    group = await db.group.create({
      data: { name: 'B1 · Inglés para Nearshoring', coordinatorId: admin.id, institutionId: inst.id },
    })
  }
  for (const [u, role] of [[maestro, 'maestro'], [a1, 'student'], [a2, 'student']] as const) {
    await db.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: u.id } },
      create: { groupId: group.id, userId: u.id, roleInGroup: role },
      update: { roleInGroup: role },
    })
  }
  console.log('✓ grupo demo «B1 · Inglés para Nearshoring» (1 maestro + 2 alumnos)')

  // 6. Actividad mínima para que el panel muestre progreso (sólo si no tienen sesiones)
  for (const [u, n] of [[a1, 3], [a2, 2]] as const) {
    const count = await db.learningSession.count({ where: { userId: u.id } })
    if (count === 0) {
      for (let i = 0; i < n; i++) {
        await db.learningSession.create({
          data: {
            userId: u.id,
            module: 'chat',
            mode: 'tutor',
            domain: 'general',
            cefrTarget: u === a1 ? 'A2' : 'B1',
            scenarioTitle: 'Sesión de práctica (demo)',
            startedAt: new Date(Date.now() - (i + 1) * 86400000),
            endedAt: new Date(Date.now() - (i + 1) * 86400000 + 22 * 60000),
            durationSec: 22 * 60,
            messagesCount: 8,
            status: 'completed',
          },
        })
      }
    }
  }
  console.log('✓ actividad demo para alumnos (sesiones de 22 min)')

  console.log('Seed R25 completo ✔')
}

seedCoordinacionR25()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
