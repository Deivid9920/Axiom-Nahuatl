// Vitest setup — runs before all tests
// Uses a separate test DB to avoid polluting the dev DB

import path from 'path'
import { execSync } from 'child_process'
import { beforeAll, afterAll, beforeEach } from 'vitest'

const TEST_DB = path.resolve(process.cwd(), 'db', 'test.db')

process.env.DATABASE_URL = `file:${TEST_DB.replace(/\\/g, '/')}`
// Asignación intencional de NODE_ENV: es de sólo lectura en los tipos de Node
;(process.env as Record<string, string>).NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest-only-32chars'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

beforeAll(async () => {
  // Aplica el esquema a la BD de pruebas antes de conectar (db push es idempotente)
  const prismaBin = process.platform === 'win32'
    ? path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma.CMD')
    : path.resolve(process.cwd(), 'node_modules', '.bin', 'prisma')
  try {
    execSync(`"${prismaBin}" db push --skip-generate --accept-data-loss`, {
      env: { ...process.env }, // process.env.DATABASE_URL tiene precedencia sobre .env
      stdio: 'pipe',
    })
  } catch (err) {
    console.error('[setup] prisma db push falló:', err)
    throw err
  }
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  // Order matters due to FK constraints
  const tables = [
    'AgentToolCall',
    'AgentRun',
    'AgentMemory',
    'SessionEvaluation',
    'SessionMessage',
    'LearningSession',
    'UserProgress',
    'ReviewSchedule',
    'VocabularyItem',
    'DocumentChunk',
    'UserDocument',
    'SystemEvent',
    'MetricPoint',
    'AuditLog',
    'ErrorEvent',
    'ExperimentAssignment',
    'ExperimentVariant',
    'Experiment',
    'FeatureFlagAssignment',
    'FeatureFlag',
    'Subscription',
    'Payment',
    'AuthSession',
    'PasswordResetToken',
    'UserRole',
    'UserProfile',
    'GroupMember',   // R25: antes de User/Group por las FK
    'Group',         // R25: coordinador referencia a User
    'Institution',   // R25: sin FK hacia User, va al final de las nuevas
    'IssuedDocument', // R27: sin FK dura hacia User, antes de User
    'EmailLog',      // R30-b: FK a User (SetNull), antes de User
    'User',
  ]
  for (const table of tables) {
    try {
      await prisma[table].deleteMany({})
    } catch {
      // table may not exist; skip
    }
  }
})

export { prisma }
