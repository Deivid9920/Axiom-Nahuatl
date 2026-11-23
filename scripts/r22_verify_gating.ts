// R22 — Verificación del escenario del usuario: «el nodo 5 se termina pero no deja avanzar».
// Ejecuta el gating real (applySession) contra la BD de desarrollo:
//   sesión 2 (sin checkpoint) → sesión 3 CON checkpoint perfecto (5/5)
//   → el nodo debe quedar 'completed' y el nodo 6 debe ser el primer pendiente.
// Corre desde la raíz del proyecto v7 (resuelve @prisma/client y el alias @/).
import { PrismaClient } from '@prisma/client'
import { applySession } from '../src/lib/session/index'
import { getUserPlan } from '../src/lib/adaptive/index'

process.env.DATABASE_URL = 'file:/home/z/my-project/axiom-v7-extracted/db/custom.db'

const db = new PrismaClient()

// A nivel de servicio no hace falta login HTTP: tomamos el demo y su nodo en curso
const user = await db.user.findUnique({ where: { email: 'admin@axiom.mx' } })
if (!user) { console.error('✗ demo user no encontrado'); process.exit(1) }

const plan0 = await getUserPlan(user.id)
if (!plan0) { console.error('✗ plan no encontrado'); process.exit(1) }
const m1 = plan0.topicsByModule['m1']
const current = m1.find(t => t.status !== 'completed')
console.log(`Nodo en curso: [${current!.title}] status=${current!.status} sesiones=${current!.sessionsCount}`)

// --- Sesión 2 (sin checkpoint) ---
const r2 = await applySession(user.id, {
  topicId: current!.id,
  secondsSpent: 600,
  warmup: [{ id: 'w1', q: 1 }],
  practice: { correct: 6, total: 6 },
  writing: { text: 'My family is small and kind.' },
  speaking: { selfReported: true },
})
if ('error' in r2) { console.error('✗ sesión 2:', r2.error); process.exit(1) }
console.log(`Sesión ${r2.sessionNumber}/${r2.requiredSessions} registrada · completed=${r2.completed}`)

// --- Sesión 3 CON checkpoint perfecto (5/5 ≥ 80) ---
const r3 = await applySession(user.id, {
  topicId: current!.id,
  secondsSpent: 700,
  practice: { correct: 6, total: 6 },
  checkpoint: { correct: 5, total: 5 },
})
if ('error' in r3) { console.error('✗ sesión 3:', r3.error); process.exit(1) }
console.log(`Sesión ${r3.sessionNumber}/${r3.requiredSessions} registrada · checkpoint=${r3.checkpointScore} · COMPLETED=${r3.completed}`)

if (!r3.completed) { console.error('✗ FALLO: el nodo no se completó con checkpoint perfecto'); process.exit(1) }

// --- El camino debe liberar el siguiente nodo ---
const plan1 = await getUserPlan(user.id)
const m1b = plan1!.topicsByModule['m1']
const next = m1b.find(t => t.status !== 'completed')
console.log(`\nTras completar el nodo: siguiente pendiente = [${next?.title ?? '—'}] (order ${next?.order}) status=${next?.status}`)
console.log(`Nodo completado ahora: status=${m1b.find(t => t.id === current!.id)!.status}`)

const chainOk = m1b.filter(t => t.order < next!.order).every(t => t.status === 'completed')
console.log(chainOk
  ? '✓ CADENA DINÁMICA OK: al completar un nodo, el primero pendiente avanza al siguiente'
  : '✗ FALLO: hay nodos no completados antes del siguiente pendiente')

await db.$disconnect()
process.exit(chainOk ? 0 : 1)
