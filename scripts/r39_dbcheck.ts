// R39 — verificación rápida de seeds en ambas BDs (convención R37: file: relativo al schema)
import { PrismaClient } from '@prisma/client'

const url = process.argv[2] ?? 'file:db/custom.db'
const p = new PrismaClient({ datasources: { db: { url } } })
const [sessions, users] = await Promise.all([p.learningSession.count(), p.user.count()])
console.log(`dbcheck ${url}: sessions=${sessions} users=${users}`)
await p.$disconnect()
