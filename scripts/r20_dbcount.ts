import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function main() {
  console.log('topics:', await db.curriculumTopic.count())
  console.log('sources:', await db.bookSource.count())
  console.log('reviewItems:', await db.reviewItem.count())
  const u = await db.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (u) {
    const prog = await db.userTopicProgress.findMany({ where: { userId: u.id, status: 'completed' } })
    console.log('demo completed topics:', prog.length)
  }
}
main().finally(() => process.exit(0))
