import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  const u = await db.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (!u) { console.log('no demo user'); return }
  const prog = await db.userTopicProgress.findMany({
    where: { userId: u.id, status: 'completed' },
    include: { topic: true },
  })
  for (const p of prog) {
    console.log(p.topic.module, '|', p.topic.title, '| order', p.topic.order, '| score', p.score)
  }
  const subs = await db.subscription.findMany({ where: { userId: u.id }, include: { plan: true } })
  console.log('subscriptions:', subs.map(s => `${s.plan.code}/${s.status}`))
}
main().finally(() => process.exit(0))
