// AXIOM — Database seed
// Run with: bun run scripts/seed.ts
// Seeds: plans, roles, permissions, knowledge base (software_engineering domain), demo user

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'
import { seedPlans } from '../src/lib/billing'
import { indexChunk } from '../src/lib/rag/vector-store'
import { logger } from '../src/lib/observability'
import { seedR15 } from './seed_r15'

const db = new PrismaClient()

// Roles & Permissions
const ROLES_DATA = [
  { name: 'STUDENT', description: 'Default user role — access to learning modules only' },
  { name: 'ADMIN', description: 'Full system access' },
]

const PERMISSIONS_DATA = [
  // Module access
  { key: 'module.conversation.use', description: 'Use conversation module' },
  { key: 'module.text.use', description: 'Use text module' },
  { key: 'module.voice.use', description: 'Use voice module' },
  // RAG
  { key: 'rag.documents.upload', description: 'Upload user documents' },
  { key: 'rag.documents.read', description: 'Read own documents' },
  { key: 'rag.documents.delete', description: 'Delete own documents' },
  { key: 'rag.retrieve', description: 'Use RAG retrieval' },
  // Agents
  { key: 'agent.ai_tutor.dispatch', description: 'Dispatch AI Tutor agent' },
  { key: 'agent.learning.dispatch', description: 'Dispatch Learning agent' },
  { key: 'agent.analytics.dispatch', description: 'Dispatch Analytics agent' },
  { key: 'agent.product.dispatch', description: 'Dispatch Product agent' },
  { key: 'agent.engineering.dispatch', description: 'Dispatch Engineering agent' },
  // Billing
  { key: 'billing.subscriptions.read', description: 'Read own subscriptions' },
  { key: 'billing.subscriptions.write', description: 'Modify subscriptions' },
  { key: 'billing.payments.read', description: 'Read own payments' },
  // Admin
  { key: 'admin.users.read', description: 'List all users' },
  { key: 'admin.users.write', description: 'Modify users' },
  { key: 'admin.plans.read', description: 'Read plans' },
  { key: 'admin.plans.write', description: 'Modify plans' },
  { key: 'admin.flags.read', description: 'Read feature flags' },
  { key: 'admin.flags.write', description: 'Modify feature flags' },
  { key: 'admin.experiments.read', description: 'Read experiments' },
  { key: 'admin.experiments.write', description: 'Modify experiments' },
  { key: 'admin.audit.read', description: 'Read audit logs' },
  { key: 'admin.errors.read', description: 'Read error events' },
  // System
  { key: 'system.events.emit', description: 'Emit system events' },
  { key: 'system.events.consume', description: 'Consume system events' },
]

// Knowledge base: Software Engineering domain
const SE_DOMAIN = {
  code: 'software_engineering',
  name: 'Software Engineering',
  description: 'English for software engineers, developers, DevOps, and tech professionals',
  cefrDefault: 'B1',
}

const SE_VOCAB: Array<{
  term: string
  pos?: string
  phonetic?: string
  definitionEn: string
  definitionEs: string
  cefrLevel: string
  difficultyScore: number
  examples?: string[]
  synonyms?: string[]
}> = [
  { term: 'pull request', pos: 'noun', phonetic: '/pʊl rɪˈkwest/', definitionEn: 'A submission of code changes for review before merging into a codebase.', definitionEs: 'Una solicitud de cambios de código para revisión antes de fusionarlos en un repositorio.', cefrLevel: 'B1', difficultyScore: 0.4, examples: ['I opened a pull request to fix the login bug.', 'Can you review my PR before I merge it?'], synonyms: ['PR', 'merge request'] },
  { term: 'code review', pos: 'noun', definitionEn: 'The process of examining source code to find and fix mistakes.', definitionEs: 'El proceso de examinar código fuente para encontrar y corregir errores.', cefrLevel: 'B1', difficultyScore: 0.4, examples: ['The code review caught a memory leak.'] },
  { term: 'deploy', pos: 'verb', phonetic: '/dɪˈplɔɪ/', definitionEn: 'To release software to a production environment.', definitionEs: 'Lanzar software a un entorno de producción.', cefrLevel: 'A2', difficultyScore: 0.3, examples: ['We deploy to production every Tuesday.'] },
  { term: 'refactor', pos: 'verb', definitionEn: 'To restructure existing code without changing its external behavior.', definitionEs: 'Reestructurar código existente sin cambiar su comportamiento externo.', cefrLevel: 'B2', difficultyScore: 0.6, examples: ['I refactored the auth module to use a single source of truth.'] },
  { term: 'standup', pos: 'noun', definitionEn: 'A short daily meeting where team members share progress and blockers.', definitionEs: 'Una breve reunión diaria donde los miembros del equipo comparten progreso y bloqueos.', cefrLevel: 'B1', difficultyScore: 0.3, examples: ['At the standup, I mentioned I was blocked on the API key.'] },
  { term: 'backend', pos: 'noun', definitionEn: 'The server-side part of an application.', definitionEs: 'La parte del servidor de una aplicación.', cefrLevel: 'A2', difficultyScore: 0.2 },
  { term: 'frontend', pos: 'noun', definitionEn: 'The client-side part of an application that users interact with.', definitionEs: 'La parte del cliente de una aplicación con la que los usuarios interactúan.', cefrLevel: 'A2', difficultyScore: 0.2 },
  { term: 'endpoint', pos: 'noun', definitionEn: 'A specific URL where an API can be accessed.', definitionEs: 'Una URL específica donde se puede acceder a una API.', cefrLevel: 'B1', difficultyScore: 0.4, examples: ['The /users endpoint returns a list of all users.'] },
  { term: 'payload', pos: 'noun', definitionEn: 'The data carried by a request or response.', definitionEs: 'Los datos transportados por una petición o respuesta.', cefrLevel: 'B2', difficultyScore: 0.5 },
  { term: 'latency', pos: 'noun', definitionEn: 'The time delay between a request and its response.', definitionEs: 'El retraso de tiempo entre una petición y su respuesta.', cefrLevel: 'B2', difficultyScore: 0.6, examples: ['The P99 latency on this endpoint is 2.3 seconds.'] },
  { term: 'throughput', pos: 'noun', definitionEn: 'The amount of work completed in a given time period.', definitionEs: 'La cantidad de trabajo completado en un periodo de tiempo dado.', cefrLevel: 'B2', difficultyScore: 0.6 },
  { term: 'bottleneck', pos: 'noun', definitionEn: 'A point of congestion that slows down the entire system.', definitionEs: 'Un punto de congestión que ralentiza todo el sistema.', cefrLevel: 'B2', difficultyScore: 0.5 },
  { term: 'scalability', pos: 'noun', definitionEn: 'The ability of a system to handle increased load.', definitionEs: 'La capacidad de un sistema para manejar carga incrementada.', cefrLevel: 'B2', difficultyScore: 0.6 },
  { term: 'idempotent', pos: 'adjective', definitionEn: 'Operations that can be repeated without changing the result beyond the first application.', definitionEs: 'Operaciones que pueden repetirse sin cambiar el resultado más allá de la primera aplicación.', cefrLevel: 'C1', difficultyScore: 0.8 },
  { term: 'deprecated', pos: 'adjective', definitionEn: 'A feature that is still available but should not be used because it will be removed.', definitionEs: 'Una característica aún disponible pero que no debería usarse porque será eliminada.', cefrLevel: 'B2', difficultyScore: 0.6 },
  { term: 'schema', pos: 'noun', definitionEn: 'The structure of a database or data file.', definitionEs: 'La estructura de una base de datos o archivo de datos.', cefrLevel: 'B1', difficultyScore: 0.5 },
  { term: 'middleware', pos: 'noun', definitionEn: 'Software that acts as a bridge between an operating system and applications.', definitionEs: 'Software que actúa como puente entre un sistema operativo y aplicaciones.', cefrLevel: 'B2', difficultyScore: 0.6 },
  { term: 'milestone', pos: 'noun', definitionEn: 'A significant point in a project timeline.', definitionEs: 'Un punto significativo en el cronograma de un proyecto.', cefrLevel: 'B1', difficultyScore: 0.4 },
  { term: 'sprint', pos: 'noun', definitionEn: 'A set period (usually 2 weeks) during which specific work must be completed.', definitionEs: 'Un periodo fijo (usualmente 2 semanas) durante el cual debe completarse trabajo específico.', cefrLevel: 'B1', difficultyScore: 0.4 },
  { term: 'retrospective', pos: 'noun', definitionEn: 'A meeting at the end of a sprint to reflect on what went well and what to improve.', definitionEs: 'Una reunión al final de un sprint para reflexionar sobre qué salió bien y qué mejorar.', cefrLevel: 'B2', difficultyScore: 0.5 },
  { term: 'merge conflict', pos: 'noun', definitionEn: 'A situation where changes from different branches cannot be combined automatically.', definitionEs: 'Una situación donde los cambios de diferentes ramas no pueden combinarse automáticamente.', cefrLevel: 'B2', difficultyScore: 0.5 },
  { term: 'bug fix', pos: 'noun', definitionEn: 'A correction to a defect in the code.', definitionEs: 'Una corrección a un defecto en el código.', cefrLevel: 'A2', difficultyScore: 0.2 },
  { term: 'release', pos: 'noun', definitionEn: 'A version of software made available to users.', definitionEs: 'Una versión de software puesta a disposición de los usuarios.', cefrLevel: 'A2', difficultyScore: 0.3 },
  { term: 'rollback', pos: 'noun', definitionEn: 'Reverting to a previous version after a failed deployment.', definitionEs: 'Revertir a una versión anterior después de un despliegue fallido.', cefrLevel: 'B2', difficultyScore: 0.5 },
  { term: 'blue-green deployment', pos: 'noun', definitionEn: 'A release strategy with two identical production environments.', definitionEs: 'Una estrategia de lanzamiento con dos entornos de producción idénticos.', cefrLevel: 'C1', difficultyScore: 0.8 },
  { term: 'canary release', pos: 'noun', definitionEn: 'A release strategy that rolls out changes to a small subset of users first.', definitionEs: 'Una estrategia de lanzamiento que despliega cambios primero a un pequeño subconjunto de usuarios.', cefrLevel: 'C1', difficultyScore: 0.7 },
  { term: 'sharding', pos: 'noun', definitionEn: 'A database partitioning technique that splits large databases into smaller parts.', definitionEs: 'Una técnica de partición de bases de datos que divide bases grandes en partes más pequeñas.', cefrLevel: 'C1', difficultyScore: 0.8 },
  { term: 'eventual consistency', pos: 'noun', definitionEn: 'A consistency model where data becomes consistent over time, not immediately.', definitionEs: 'Un modelo de consistencia donde los datos se vuelven consistentes con el tiempo, no inmediatamente.', cefrLevel: 'C1', difficultyScore: 0.9 },
  { term: 'circuit breaker', pos: 'noun', definitionEn: 'A pattern that prevents cascading failures by stopping calls to a failing service.', definitionEs: 'Un patrón que previene fallas en cascada deteniendo llamadas a un servicio fallido.', cefrLevel: 'C1', difficultyScore: 0.8 },
  { term: 'rate limiting', pos: 'noun', definitionEn: 'Restricting the number of requests a client can make in a time window.', definitionEs: 'Restringir el número de peticiones que un cliente puede hacer en una ventana de tiempo.', cefrLevel: 'B2', difficultyScore: 0.6 },
]

const SE_GRAMMAR: Array<{
  name: string
  cefrLevel: string
  statement: string
  examples: { correct: string; incorrect: string; explanation: string }[]
}> = [
  {
    name: 'Present Perfect vs Past Simple',
    cefrLevel: 'B1',
    statement: 'Use Present Perfect (have/has + past participle) for past actions with relevance to the present. Use Past Simple for completed actions at a specific past time.',
    examples: [
      { correct: 'I have deployed the fix.', incorrect: 'I deployed the fix.', explanation: 'Use Present Perfect when the action is relevant now (the fix is currently live).' },
      { correct: 'I deployed the fix yesterday.', incorrect: 'I have deployed the fix yesterday.', explanation: 'Use Past Simple with specific past time markers like "yesterday".' },
    ],
  },
  {
    name: 'Passive Voice for Technical Documentation',
    cefrLevel: 'B2',
    statement: 'In technical writing, use passive voice to emphasize the action rather than the actor.',
    examples: [
      { correct: 'The database is backed up nightly.', incorrect: 'We back up the database nightly.', explanation: 'Passive voice emphasizes the action and result, not who performs it.' },
      { correct: 'The endpoint was deprecated in v2.0.', incorrect: 'We deprecated the endpoint in v2.0.', explanation: 'Standard technical documentation convention.' },
    ],
  },
  {
    name: 'Conditional Sentences (First Conditional)',
    cefrLevel: 'B1',
    statement: 'Use "if + present simple, will + base verb" for real possibilities in the future.',
    examples: [
      { correct: 'If the build fails, we will revert the commit.', incorrect: 'If the build will fail, we revert the commit.', explanation: 'Use present simple in the if-clause, not "will".' },
      { correct: 'If the latency exceeds 500ms, the alert will trigger.', incorrect: 'If latency will exceed 500ms, the alert triggers.', explanation: 'Same rule applies to technical conditions.' },
    ],
  },
  {
    name: 'Modal Verbs for Polite Requests',
    cefrLevel: 'A2',
    statement: 'Use "could" or "would" for polite requests in professional communication.',
    examples: [
      { correct: 'Could you review my PR?', incorrect: 'Review my PR.', explanation: '"Could you" is more polite than the imperative.' },
      { correct: 'Would you mind taking a look at this?', incorrect: 'Look at this.', explanation: '"Would you mind" is the most polite form.' },
    ],
  },
  {
    name: 'Reported Speech in Standups',
    cefrLevel: 'B2',
    statement: 'When reporting what someone said, tense shifts back one step.',
    examples: [
      { correct: 'She said she was working on the API.', incorrect: 'She said she is working on the API.', explanation: 'Past simple ("was") in reported speech for present continuous ("is").' },
      { correct: 'He mentioned he had finished the migration.', incorrect: 'He mentioned he has finished the migration.', explanation: 'Past perfect ("had finished") in reported speech for present perfect ("has finished").' },
    ],
  },
]

// Common pitfalls for Spanish speakers
const SE_PITFALLS: Array<{
  type: string
  description: string
  correctForm: string
  incorrectForm: string
  explanation: string
}> = [
  {
    type: 'false_friend',
    description: 'Confusing "actually" with "currently"',
    correctForm: 'currently',
    incorrectForm: 'actually',
    explanation: '"Actually" means "in fact" or "really", not "currently". Spanish "actualmente" = English "currently".',
  },
  {
    type: 'false_friend',
    description: 'Confusing "library" with "bookstore"',
    correctForm: 'library',
    incorrectForm: 'bookstore',
    explanation: 'In English, "library" is where you borrow books (biblioteca), "bookstore" is where you buy them (librería).',
  },
  {
    type: 'pronunciation',
    description: 'Pronouncing /θ/ as /s/ or /t/',
    correctForm: 'think /θɪŋk/',
    incorrectForm: 'sink /sɪŋk/ or tink /tɪŋk/',
    explanation: 'Spanish speakers often substitute /θ/ (think) with /s/ (sink) or /t/ (tink). Place tongue between teeth and blow air.',
  },
  {
    type: 'pronunciation',
    description: 'Pronouncing /ð/ as /d/',
    correctForm: 'this /ðɪs/',
    incorrectForm: 'dis /dɪs/',
    explanation: 'Spanish /d/ is harder than English /ð/. Soften the /d/ by placing tongue lightly against upper teeth.',
  },
  {
    type: 'grammar',
    description: 'Omitting subject pronouns',
    correctForm: 'It is important to test.',
    incorrectForm: 'Is important to test.',
    explanation: 'English requires explicit subjects. Spanish allows omission ("Es importante probar"); English does not.',
  },
  {
    type: 'grammar',
    description: 'Using "is" instead of "are" for plural nouns',
    correctForm: 'The tests are passing.',
    incorrectForm: 'The tests is passing.',
    explanation: 'Spanish doesn\'t distinguish plural in copula verbs ("Las pruebas está pasando" — though ungrammatical, the verb form wouldn\'t change for plural).',
  },
  {
    type: 'collocation',
    description: 'Using "make a meeting" instead of "have a meeting"',
    correctForm: 'have a meeting',
    incorrectForm: 'make a meeting',
    explanation: 'In English, you "have" meetings, you don\'t "make" them. "Make" is for creating something new.',
  },
  {
    type: 'register',
    description: 'Using overly formal language in casual technical discussions',
    correctForm: 'Let\'s ship it.',
    incorrectForm: 'I would like to request that we proceed with the deployment.',
    explanation: 'Casual technical English uses contractions ("let\'s", "we\'ll") and direct verbs. Reserve formal language for client-facing documents.',
  },
]

// Demo user
async function seedDemoUser() {
  const existingAdmin = await db.user.findUnique({ where: { email: 'admin@axiom.mx' } })
  if (existingAdmin) {
    logger.info('seed.demo_user_exists', { email: 'admin@axiom.mx' })
    return
  }

  const passwordHash = await hashPassword('axiom12345')
  const admin = await db.user.create({
    data: {
      email: 'admin@axiom.mx',
      name: 'Admin Demo',
      passwordHash,
      profile: {
        create: {
          cefrInitial: 'B1',
          cefrCurrent: 'B1',
          theta: -1.0,
          thetaSE: 0.5,
          professionalDomain: 'software_engineering',
          jobRole: 'Software Engineer',
          learningGoals: JSON.stringify(['Improve technical interview skills', 'Master code review feedback']),
          weeklyMinutesGoal: 150,
          onboardingCompleted: true,
          onboardedAt: new Date(),
        },
      },
    },
  })

  const adminRole = await db.role.findUnique({ where: { name: 'ADMIN' } })
  if (adminRole) {
    await db.userRole.create({ data: { userId: admin.id, roleId: adminRole.id } })
  }

  // Subscribe to Pro plan (trial)
  const proPlan = await db.plan.findUnique({ where: { code: 'pro' } })
  if (proPlan) {
    await db.subscription.create({
      data: {
        userId: admin.id,
        planId: proPlan.id,
        status: 'trialing',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
  }

  logger.info('seed.demo_user_created', { userId: admin.id, email: admin.email })
}

// Feature flags + experiments (separate so they always run)
async function seedFeatureFlagsAndExperiments() {
  for (const flagData of [
    { key: 'voice_module_enabled', description: 'Enable voice module', enabled: true, rolloutPercent: 100 },
    { key: 'rag_user_documents_enabled', description: 'Enable user document uploads', enabled: true, rolloutPercent: 100 },
    { key: 'analytics_dashboard_enabled', description: 'Enable analytics dashboard', enabled: true, rolloutPercent: 100 },
    { key: 'pro_plan_trial_extended', description: 'Extended trial for Pro plan', enabled: false, rolloutPercent: 0 },
  ]) {
    await db.featureFlag.upsert({
      where: { key: flagData.key },
      create: flagData,
      update: flagData,
    })
  }
  logger.info('seed.feature_flags_done', { count: 4 })

  // Experiment (only create if not exists)
  const existingExp = await db.experiment.findUnique({ where: { key: 'chat_prompt_v2' } })
  if (!existingExp) {
    await db.experiment.create({
      data: {
        key: 'chat_prompt_v2',
        name: 'Chat Prompt V2 Test',
        description: 'Test new tutor system prompt for better correction formatting',
        status: 'running',
        startDate: new Date(),
        variants: {
          create: [
            { key: 'control', weight: 50, configJson: JSON.stringify({ promptVersion: 'v1' }) },
            { key: 'treatment_a', weight: 50, configJson: JSON.stringify({ promptVersion: 'v2' }) },
          ],
        },
      },
    })
    logger.info('seed.experiment_created', { key: 'chat_prompt_v2' })
  }
}

// Main seed
async function main() {
  logger.info('seed.start', {})

  // 1. Roles
  for (const roleData of ROLES_DATA) {
    await db.role.upsert({
      where: { name: roleData.name },
      create: roleData,
      update: { description: roleData.description },
    })
  }
  logger.info('seed.roles_done', { count: ROLES_DATA.length })

  // 2. Permissions
  for (const permData of PERMISSIONS_DATA) {
    await db.permission.upsert({
      where: { key: permData.key },
      create: permData,
      update: { description: permData.description },
    })
  }
  logger.info('seed.permissions_done', { count: PERMISSIONS_DATA.length })

  // 3. Role-permission mappings
  const adminRole = await db.role.findUnique({ where: { name: 'ADMIN' } })
  const studentRole = await db.role.findUnique({ where: { name: 'STUDENT' } })
  const allPerms = await db.permission.findMany()

  if (adminRole) {
    for (const perm of allPerms) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
        create: { roleId: adminRole.id, permissionId: perm.id },
        update: {},
      })
    }
  }

  if (studentRole) {
    const studentPermKeys = [
      'module.conversation.use',
      'module.text.use',
      'module.voice.use',
      'rag.documents.upload',
      'rag.documents.read',
      'rag.documents.delete',
      'rag.retrieve',
      'agent.ai_tutor.dispatch',
      'agent.learning.dispatch',
      'billing.subscriptions.read',
      'billing.payments.read',
      'system.events.emit',
    ]
    for (const perm of allPerms.filter(p => studentPermKeys.includes(p.key))) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: studentRole.id, permissionId: perm.id } },
        create: { roleId: studentRole.id, permissionId: perm.id },
        update: {},
      })
    }
  }

  // 4. Plans
  await seedPlans()

  // 5. Knowledge base — software_engineering domain
  const domain = await db.domainContent.upsert({
    where: { code: SE_DOMAIN.code },
    create: SE_DOMAIN,
    update: { name: SE_DOMAIN.name, description: SE_DOMAIN.description },
  })

  // Vocab
  let vocabCount = 0
  for (const v of SE_VOCAB) {
    const existing = await db.vocabularyEntry.findFirst({
      where: { domainId: domain.id, term: v.term },
    })
    if (existing) continue

    const entry = await db.vocabularyEntry.create({
      data: {
        domainId: domain.id,
        term: v.term,
        pos: v.pos,
        phonetic: v.phonetic,
        definitionEn: v.definitionEn,
        definitionEs: v.definitionEs,
        cefrLevel: v.cefrLevel,
        difficultyScore: v.difficultyScore,
        examplesJson: v.examples ? JSON.stringify(v.examples) : null,
        synonymsJson: v.synonyms ? JSON.stringify(v.synonyms) : null,
      },
    })

    // Index in vector store
    await indexChunk({
      chunkId: `vocab_${entry.id}`,
      content: `${v.term}: ${v.definitionEn} ${v.definitionEs}. Examples: ${(v.examples || []).join(' ')}`,
      domain: 'software_engineering',
      cefrLevel: v.cefrLevel,
      source: 'vocabulary',
      sourceId: entry.id,
      difficultyScore: v.difficultyScore,
    })
    vocabCount++
  }
  logger.info('seed.vocab_done', { count: vocabCount })

  // Grammar
  let grammarCount = 0
  for (const g of SE_GRAMMAR) {
    const existing = await db.grammarRule.findFirst({
      where: { domainId: domain.id, name: g.name },
    })
    if (existing) continue

    const rule = await db.grammarRule.create({
      data: {
        domainId: domain.id,
        name: g.name,
        cefrLevel: g.cefrLevel,
        statement: g.statement,
        examplesJson: JSON.stringify(g.examples),
      },
    })

    await indexChunk({
      chunkId: `grammar_${rule.id}`,
      content: `${g.name}: ${g.statement} Examples: ${JSON.stringify(g.examples)}`,
      domain: 'software_engineering',
      cefrLevel: g.cefrLevel,
      source: 'grammar_rule',
      sourceId: rule.id,
      difficultyScore: 0.5,
    })
    grammarCount++
  }
  logger.info('seed.grammar_done', { count: grammarCount })

  // Pitfalls
  let pitfallCount = 0
  for (const p of SE_PITFALLS) {
    const existing = await db.pitfall.findFirst({
      where: { domainId: domain.id, description: p.description },
    })
    if (existing) continue

    await db.pitfall.create({
      data: {
        domainId: domain.id,
        type: p.type,
        description: p.description,
        correctForm: p.correctForm,
        incorrectForm: p.incorrectForm,
        explanation: p.explanation,
      },
    })
    pitfallCount++
  }
  logger.info('seed.pitfalls_done', { count: pitfallCount })

  // 6. Demo user
  await seedDemoUser()

  // 7. Feature flags + experiments
  await seedFeatureFlagsAndExperiments()

  logger.info('seed.complete', {
    vocab: vocabCount,
    grammar: grammarCount,
    pitfalls: pitfallCount,
  })

  // 8. Seed reading texts (pre-saved, NOT LLM-generated)
  await seedReadingTexts()

  // 9. Seed typing texts
  await seedTypingTexts()

  // 10. Seed translation exercises
  await seedTranslationExercises()

  // 11. Seed curriculum topics
  await seedCurriculumTopics()

  // 12. R14: Libros (corpus editorial), nodos CEFR de los 10 módulos y actividad demo
  await seedR15()

  console.log('Seed complete!')
  console.log('   Demo user: admin@axiom.mx / axiom12345')
  console.log('   Plans: 4 seeded (basico, pro, equipo, enterprise)')
  console.log('   Knowledge base: software_engineering domain')
  console.log('   Reading texts, typing texts, translation exercises, curriculum topics')
  console.log('   Libros (corpus editorial) + 10 módulos CEFR + actividad demo (R14)')
}

// Reading texts (pre-saved in DB)
async function seedReadingTexts() {
  const texts = [
    {
      title: 'Daily Standup Meeting',
      content: 'Good morning everyone. Let us start with the daily standup. Yesterday, I completed the user authentication module and wrote unit tests for the login flow. Today, I will work on the password reset feature and integrate the email service. I do not have any blockers at the moment, but I might need help from the design team for the reset password page layout.',
      cefrLevel: 'B1',
      domain: 'software_engineering',
      topic: 'standup',
      estimatedReadingTimeSec: 45,
    },
    {
      title: 'Code Review Feedback',
      content: 'I reviewed your pull request and I have a few suggestions. First, the function handleUserLogin is too long. Consider breaking it into smaller functions. Second, you forgot to handle the case when the database connection fails. Third, the variable names are good, but please add comments to explain the complex logic in the retry mechanism. Overall, great work on the test coverage.',
      cefrLevel: 'B2',
      domain: 'software_engineering',
      topic: 'code_review',
      estimatedReadingTimeSec: 40,
    },
    {
      title: 'Project Kickoff Email',
      content: 'Hello team, I hope this email finds you well. I am writing to officially kick off our new project. We will be building a customer dashboard that displays real-time analytics. The project timeline is eight weeks, with the first two weeks dedicated to design and planning. Please review the attached requirements document and come prepared with questions for our meeting on Monday. I look forward to working with all of you on this exciting project.',
      cefrLevel: 'B1',
      domain: 'software_engineering',
      topic: 'email',
      estimatedReadingTimeSec: 50,
    },
    {
      title: 'Weekly Status Report',
      content: 'This week, the engineering team completed three major milestones. We deployed the new payment gateway to production, fixed twelve critical bugs reported by users, and improved the API response time by thirty percent. Next week, we plan to start working on the mobile application and conduct a security audit. The team morale is high and we are on track to meet our quarterly goals.',
      cefrLevel: 'A2',
      domain: 'software_engineering',
      topic: 'report',
      estimatedReadingTimeSec: 35,
    },
    {
      title: 'Technical Documentation',
      content: 'The authentication system uses JSON Web Tokens to manage user sessions. When a user logs in, the server generates an access token and a refresh token. The access token is valid for fifteen minutes and is sent with every API request in the Authorization header. The refresh token is valid for seven days and is used to obtain new access tokens without requiring the user to log in again. All tokens are signed using a secret key stored in environment variables.',
      cefrLevel: 'B2',
      domain: 'software_engineering',
      topic: 'documentation',
      estimatedReadingTimeSec: 55,
    },
    {
      title: 'Meeting Notes',
      content: 'The meeting started at ten in the morning. The team discussed the new feature requirements. Sarah presented the user interface design and received positive feedback. Michael raised concerns about the database performance with large datasets. We agreed to conduct load testing before the release. The next meeting is scheduled for Thursday at the same time. Action items were assigned to each team member.',
      cefrLevel: 'A2',
      domain: 'software_engineering',
      topic: 'meeting',
      estimatedReadingTimeSec: 30,
    },
  ]

  for (const t of texts) {
    const existing = await db.readingText.findFirst({ where: { title: t.title } })
    if (existing) continue

    const wordCount = t.content.split(/\s+/).length
    await db.readingText.create({
      data: {
        title: t.title,
        content: t.content,
        wordCount,
        cefrLevel: t.cefrLevel,
        domain: t.domain,
        topic: t.topic,
        difficultyScore: t.cefrLevel === 'A2' ? 0.3 : t.cefrLevel === 'B1' ? 0.5 : 0.7,
        estimatedReadingTimeSec: t.estimatedReadingTimeSec,
        isActive: true,
      },
    })
  }
  logger.info('seed.reading_texts_done', { count: texts.length })
}

// Typing texts
async function seedTypingTexts() {
  const texts = [
    {
      content: 'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet. Practice typing it slowly at first, then increase your speed as you become more comfortable with the keyboard layout.',
      cefrLevel: 'A2',
      topic: 'general',
    },
    {
      content: 'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); } The function above uses the reduce method to calculate the total price of all items in an array. It iterates through each element and accumulates the sum.',
      cefrLevel: 'B2',
      topic: 'technical',
    },
    {
      content: 'Dear Mr. Johnson, I am writing to follow up on our meeting last Tuesday. As discussed, I have attached the project proposal for your review. Please let me know if you have any questions or if you would like to schedule another meeting to discuss the details further. I look forward to hearing from you soon.',
      cefrLevel: 'B1',
      topic: 'business',
    },
    {
      content: 'Git is a version control system that helps developers track changes in their code. To commit your changes, first stage them with git add, then create a commit with git commit. To push your commits to a remote repository, use git push. Always write clear commit messages that explain what changes you made and why.',
      cefrLevel: 'B1',
      topic: 'technical',
    },
    {
      content: 'The annual report shows that our company had a successful year. Revenue increased by twenty percent compared to the previous year. We opened three new offices in different cities and hired fifty new employees. Our customer satisfaction score improved from eighty to ninety-two points. The board of directors is pleased with the results.',
      cefrLevel: 'B1',
      topic: 'business',
    },
    {
      content: 'Hello everyone, welcome to the team. My name is Carlos and I am the new software engineer. I will be working on the backend team, focusing on the API development. I have five years of experience with Node.js and Python. I am excited to be here and I look forward to working with all of you. Please feel free to reach out if you need anything.',
      cefrLevel: 'A2',
      topic: 'general',
    },
  ]

  for (const t of texts) {
    const existing = await db.typingText.findFirst({ where: { content: t.content } })
    if (existing) continue

    const wordCount = t.content.split(/\s+/).length
    await db.typingText.create({
      data: {
        content: t.content,
        wordCount,
        cefrLevel: t.cefrLevel,
        topic: t.topic,
        difficultyScore: t.cefrLevel === 'A2' ? 0.3 : t.cefrLevel === 'B1' ? 0.5 : 0.7,
        isActive: true,
      },
    })
  }
  logger.info('seed.typing_texts_done', { count: texts.length })
}

// Translation exercises
async function seedTranslationExercises() {
  const exercises = [
    {
      sourceText: 'Buenos días. ¿Cómo estás hoy? Espero que tengas un excelente día de trabajo.',
      targetText: 'Good morning. How are you today? I hope you have an excellent day at work.',
      sourceLanguage: 'es',
      targetLanguage: 'en',
      cefrLevel: 'A2',
      vocabulary: ['morning', 'excellent', 'work'],
      hints: ['"Buenos días" = "Good morning"', '"¿Cómo estás?" = "How are you?"'],
    },
    {
      sourceText: 'Necesito programar una reunión para discutir el nuevo proyecto. ¿Qué día te funciona mejor?',
      targetText: 'I need to schedule a meeting to discuss the new project. What day works best for you?',
      sourceLanguage: 'es',
      targetLanguage: 'en',
      cefrLevel: 'B1',
      vocabulary: ['schedule', 'meeting', 'discuss', 'project'],
      hints: ['"programar" = "to schedule"', '"funciona mejor" = "works best"'],
    },
    {
      sourceText: 'El equipo de desarrollo completó el módulo de autenticación y escribió pruebas unitarias para el flujo de inicio de sesión.',
      targetText: 'The development team completed the authentication module and wrote unit tests for the login flow.',
      sourceLanguage: 'es',
      targetLanguage: 'en',
      cefrLevel: 'B2',
      vocabulary: ['development', 'authentication', 'module', 'unit tests', 'login flow'],
      hints: ['"completó" = "completed"', '"escribió" = "wrote"'],
    },
    {
      sourceText: 'Por favor, revisa el pull request y déjame tus comentarios antes del lanzamiento de mañana.',
      targetText: 'Please review the pull request and leave your comments before tomorrow\'s release.',
      sourceLanguage: 'es',
      targetLanguage: 'en',
      cefrLevel: 'B1',
      vocabulary: ['review', 'pull request', 'comments', 'release'],
      hints: ['"revisa" = "review"', '"lanzamiento" = "release"'],
    },
    {
      sourceText: 'La reunión fue reprogramada para el jueves a las tres de la tarde. Por favor confirma tu asistencia.',
      targetText: 'The meeting was rescheduled to Thursday at three in the afternoon. Please confirm your attendance.',
      sourceLanguage: 'es',
      targetLanguage: 'en',
      cefrLevel: 'B1',
      vocabulary: ['meeting', 'rescheduled', 'Thursday', 'confirm', 'attendance'],
      hints: ['"reprogramada" = "rescheduled"', "asistencia = attendance"],
    },
    // EN → ES
    {
      sourceText: 'I have attached the quarterly report for your review. Please let me know if you have any questions.',
      targetText: 'He adjuntado el informe trimestral para su revisión. Por favor avíseme si tiene alguna pregunta.',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      cefrLevel: 'B1',
      vocabulary: ['attached', 'quarterly', 'report', 'review', 'questions'],
      hints: ['"attached" = "adjuntado"', '"quarterly" = "trimestral"'],
    },
    {
      sourceText: 'The server is down and we are working on fixing it. We expect to be back online within thirty minutes.',
      targetText: 'El servidor está caído y estamos trabajando para arreglarlo. Esperamos volver a estar en línea en treinta minutos.',
      sourceLanguage: 'en',
      targetLanguage: 'es',
      cefrLevel: 'B2',
      vocabulary: ['server', 'down', 'fixing', 'online', 'minutes'],
      hints: ['"is down" = "está caído"', '"back online" = "volver a estar en línea"'],
    },
  ]

  for (const ex of exercises) {
    const existing = await db.translationExercise.findFirst({ where: { sourceText: ex.sourceText } })
    if (existing) continue

    await db.translationExercise.create({
      data: {
        sourceText: ex.sourceText,
        targetText: ex.targetText,
        sourceLanguage: ex.sourceLanguage,
        targetLanguage: ex.targetLanguage,
        cefrLevel: ex.cefrLevel,
        vocabularyJson: JSON.stringify(ex.vocabulary),
        hintsJson: JSON.stringify(ex.hints),
        difficultyScore: ex.cefrLevel === 'A2' ? 0.3 : ex.cefrLevel === 'B1' ? 0.5 : 0.7,
        isActive: true,
      },
    })
  }
  logger.info('seed.translation_exercises_done', { count: exercises.length })
}

// Curriculum topics (for dashboard cards)
async function seedCurriculumTopics() {
  const topics = [
    // A2 - Reading
    { title: 'Comprensión de emails simples', description: 'Aprende a leer y entender correos electrónicos de trabajo básicos', skill: 'reading', cefrLevel: 'A2', module: 'reading', icon: 'mail', color: '#0ECFB1', order: 1 },
    { title: 'Lectura de documentación técnica', description: 'Practica leyendo manuales y guías técnicas en inglés', skill: 'reading', cefrLevel: 'A2', module: 'reading', icon: 'description', color: '#0ECFB1', order: 2 },
    // A2 - Writing
    { title: 'Redacción de mensajes cortos', description: 'Aprende a escribir mensajes de chat y notas breves', skill: 'writing', cefrLevel: 'A2', module: 'typing', icon: 'chat', color: '#F5A623', order: 1 },
    { title: 'Traducción básica ES→EN', description: 'Traduce frases comunes del español al inglés', skill: 'writing', cefrLevel: 'A2', module: 'translation', icon: 'translate', color: '#F5A623', order: 2 },
    // A2 - Listening
    { title: 'Comprensión de instrucciones', description: 'Escucha y comprende instrucciones de trabajo', skill: 'listening', cefrLevel: 'A2', module: 'conversation', icon: 'hearing', color: '#B5D4F4', order: 1 },
    // A2 - Speaking
    { title: 'Presentaciones personales', description: 'Aprende a presentarte y hablar de tu trabajo', skill: 'speaking', cefrLevel: 'A2', module: 'conversation', icon: 'record_voice_over', color: '#0B1F3A', order: 1 },
    { title: 'Pronunciación de vocabulario técnico', description: 'Practica la pronunciación de términos de tu profesión', skill: 'speaking', cefrLevel: 'A2', module: 'voice', icon: 'mic', color: '#0B1F3A', order: 2 },

    // B1 - Reading
    { title: 'Comprensión de reportes', description: 'Lee y entiende reportes de proyectos y estados financieros', skill: 'reading', cefrLevel: 'B1', module: 'reading', icon: 'article', color: '#0ECFB1', order: 1 },
    { title: 'Lectura de código y comentarios', description: 'Practica leyendo código con comentarios en inglés', skill: 'reading', cefrLevel: 'B1', module: 'reading', icon: 'code', color: '#0ECFB1', order: 2 },
    // B1 - Writing
    { title: 'Redacción de emails profesionales', description: 'Escribe correos de trabajo con tono profesional adecuado', skill: 'writing', cefrLevel: 'B1', module: 'text', icon: 'edit_email', color: '#F5A623', order: 1 },
    { title: 'Traducción técnica ES→EN', description: 'Traduce documentación técnica al inglés', skill: 'writing', cefrLevel: 'B1', module: 'translation', icon: 'translate', color: '#F5A623', order: 2 },
    // B1 - Listening
    { title: 'Comprensión de reuniones', description: 'Escucha y comprende discusiones de reuniones de equipo', skill: 'listening', cefrLevel: 'B1', module: 'conversation', icon: 'groups', color: '#B5D4F4', order: 1 },
    // B1 - Speaking
    { title: 'Participación en standups', description: 'Practica reportar tu progreso en reuniones diarias', skill: 'speaking', cefrLevel: 'B1', module: 'conversation', icon: 'forum', color: '#0B1F3A', order: 1 },
    { title: 'Lectura en voz alta de textos técnicos', description: 'Mejora tu pronunciación leyendo textos profesionales', skill: 'speaking', cefrLevel: 'B1', module: 'voice', icon: 'record_voice_over', color: '#0B1F3A', order: 2 },

    // B2 - Reading
    { title: 'Análisis de documentación compleja', description: 'Lee y analiza especificaciones técnicas detalladas', skill: 'reading', cefrLevel: 'B2', module: 'reading', icon: 'biotech', color: '#0ECFB1', order: 1 },
    // B2 - Writing
    { title: 'Redacción de propuestas técnicas', description: 'Escribe propuestas y documentos técnicos profesionales', skill: 'writing', cefrLevel: 'B2', module: 'text', icon: 'description', color: '#F5A623', order: 1 },
    // B2 - Speaking
    { title: 'Simulación de entrevistas técnicas', description: 'Practica entrevistas de trabajo en inglés', skill: 'speaking', cefrLevel: 'B2', module: 'conversation', icon: 'work', color: '#0B1F3A', order: 1 },
    { title: 'Presentaciones profesionales', description: 'Realiza presentaciones de proyectos en inglés', skill: 'speaking', cefrLevel: 'B2', module: 'voice', icon: 'present_to_all', color: '#0B1F3A', order: 2 },

    // Evaluación final por módulo (nodo púrpura del camino; usa IA)
    { title: 'Evaluación final', description: 'Evaluación integral del camino de conversación con retroalimentación de IA', skill: 'speaking', cefrLevel: 'B2', module: 'conversation', icon: 'auto_awesome', color: '#B5D4F4', order: 99 },
    { title: 'Evaluación final', description: 'Evaluación integral del camino de lectura con retroalimentación de IA', skill: 'reading', cefrLevel: 'B2', module: 'reading', icon: 'auto_awesome', color: '#0ECFB1', order: 99 },
    { title: 'Evaluación final', description: 'Evaluación integral del camino de escritura con retroalimentación de IA', skill: 'writing', cefrLevel: 'B2', module: 'typing', icon: 'auto_awesome', color: '#F5A623', order: 99 },
    { title: 'Evaluación final', description: 'Evaluación integral del camino de voz con retroalimentación de IA', skill: 'speaking', cefrLevel: 'B2', module: 'voice', icon: 'auto_awesome', color: '#0B1F3A', order: 99 },
  ]

  for (const t of topics) {
    const existing = await db.curriculumTopic.findFirst({ where: { title: t.title, module: t.module } })
    if (existing) continue

    await db.curriculumTopic.create({
      data: {
        title: t.title,
        description: t.description,
        skill: t.skill,
        cefrLevel: t.cefrLevel,
        module: t.module,
        icon: t.icon,
        color: t.color,
        order: t.order,
        difficultyScore: t.cefrLevel === 'A2' ? 0.3 : t.cefrLevel === 'B1' ? 0.5 : 0.7,
        isActive: true,
      },
    })
  }
  logger.info('seed.curriculum_topics_done', { count: topics.length })
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
