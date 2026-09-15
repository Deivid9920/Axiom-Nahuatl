// AXIOM — Centralized type definitions

// RBAC
export const ROLES = ['STUDENT', 'ADMIN'] as const
export type Role = typeof ROLES[number]

export const PERMISSIONS = [
  // Module access — la plataforma cubre ESCUCHA y PRONUNCIACIÓN.
  'module.listening.use',
  'module.pronunciation.use',
  // RAG
  'rag.documents.upload',
  'rag.documents.read',
  'rag.documents.delete',
  'rag.retrieve',
  // Agents
  'agent.ai_tutor.dispatch',
  'agent.learning.dispatch',
  'agent.analytics.dispatch',
  'agent.product.dispatch',
  'agent.engineering.dispatch',
  // Billing
  'billing.subscriptions.read',
  'billing.subscriptions.write',
  'billing.payments.read',
  // Admin
  'admin.users.read',
  'admin.users.write',
  'admin.plans.read',
  'admin.plans.write',
  'admin.flags.read',
  'admin.flags.write',
  'admin.experiments.read',
  'admin.experiments.write',
  'admin.audit.read',
  'admin.errors.read',
  // System
  'system.events.emit',
  'system.events.consume',
] as const
export type Permission = typeof PERMISSIONS[number]

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  STUDENT: [
    'module.listening.use',
    'module.pronunciation.use',
    'rag.documents.upload',
    'rag.documents.read',
    'rag.documents.delete',
    'rag.retrieve',
    'agent.ai_tutor.dispatch',
    'agent.learning.dispatch',
    'billing.subscriptions.read',
    'billing.payments.read',
    'system.events.emit',
  ],
  ADMIN: [
    // Admins get everything
    ...([
      'module.listening.use',
      'module.pronunciation.use',
      'rag.documents.upload',
      'rag.documents.read',
      'rag.documents.delete',
      'rag.retrieve',
      'agent.ai_tutor.dispatch',
      'agent.learning.dispatch',
      'agent.analytics.dispatch',
      'agent.product.dispatch',
      'agent.engineering.dispatch',
      'billing.subscriptions.read',
      'billing.subscriptions.write',
      'billing.payments.read',
      'admin.users.read',
      'admin.users.write',
      'admin.plans.read',
      'admin.plans.write',
      'admin.flags.read',
      'admin.flags.write',
      'admin.experiments.read',
      'admin.experiments.write',
      'admin.audit.read',
      'admin.errors.read',
      'system.events.emit',
      'system.events.consume',
    ] as Permission[]),
  ],
}

// CEFR Levels
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type CefrLevel = typeof CEFR_LEVELS[number]

// IRT theta → CEFR mapping (per docs Ch. 10)
export const THETA_TO_CEFR: { min: number; level: CefrLevel }[] = [
  { min: -3.0, level: 'A1' },
  { min: -2.0, level: 'A2' },
  { min: -1.0, level: 'B1' },
  { min: 0.0, level: 'B2' },
  { min: 1.0, level: 'C1' },
  { min: 2.0, level: 'C2' },
]

export function thetaToCefr(theta: number): CefrLevel {
  for (let i = THETA_TO_CEFR.length - 1; i >= 0; i--) {
    if (theta >= THETA_TO_CEFR[i].min) return THETA_TO_CEFR[i].level
  }
  return 'A1'
}

export function cefrToTheta(level: CefrLevel): number {
  return { A1: -3, A2: -2, B1: -1, B2: 0, C1: 1, C2: 2 }[level]
}

// 4 Fundamental Language Skills (per CEFR exam areas)
export const SKILLS = ['reading', 'writing', 'listening', 'speaking'] as const
export type Skill = typeof SKILLS[number]

export const SKILL_LABELS: Record<Skill, string> = {
  reading: 'Lectura',
  writing: 'Escritura',
  listening: 'Comprensión auditiva',
  speaking: 'Expresión oral',
}

export const SKILL_ICONS: Record<Skill, string> = {
  reading: 'menu_book',
  writing: 'edit_note',
  listening: 'hearing',
  speaking: 'record_voice_over',
}

// Learning Modes (intensity control)
export const LEARNING_MODES = ['tranquilo', 'moderado', 'agresivo'] as const
export type LearningMode = typeof LEARNING_MODES[number]

export const LEARNING_MODE_CONFIG: Record<LearningMode, {
  label: string
  sessionsPerWeek: number
  sessionDurationMin: number
  description: string
  icon: string
  color: string
}> = {
  tranquilo: {
    label: 'Tranquilo',
    sessionsPerWeek: 2,
    sessionDurationMin: 15,
    description: '2 sesiones por semana, 15 min cada una. Ideal para empezar sin presión.',
    icon: 'spa',
    color: '#0ECFB1',
  },
  moderado: {
    label: 'Moderado',
    sessionsPerWeek: 4,
    sessionDurationMin: 25,
    description: '4 sesiones por semana, 25 min cada una. Ritmo equilibrado para progreso constante.',
    icon: 'speed',
    color: '#F5A623',
  },
  agresivo: {
    label: 'Agresivo',
    sessionsPerWeek: 6,
    sessionDurationMin: 40,
    description: '6 sesiones por semana, 40 min cada una. Para alcanzar tu meta lo antes posible.',
    icon: 'rocket_launch',
    color: '#E24B4A',
  },
}

// Modules (sólo habilidades orales: listening y pronunciation)
export const MODULES = ['listening', 'pronunciation'] as const
export type Module = typeof MODULES[number]

/** Comprensión auditiva: el usuario ESCUCHA y demuestra que entendió. */
export const LISTENING_MODES = [
  'comprension_guiada',   // audio corto + preguntas de comprensión
  'dictado',              // audio → transcripción del usuario
  'discriminacion',       // distinguir pares mínimos (tl/t, tz/s, ch/x)
] as const
export type ListeningMode = typeof LISTENING_MODES[number]

/** Pronunciación: el usuario HABLA y recibe retroalimentación fonética. */
export const PRONUNCIATION_MODES = [
  'lectura_en_voz_alta',  // leer un texto y ser evaluado
  'repeticion',           // escuchar un modelo y repetirlo
  'fonema_dirigido',      // practicar un fonema concreto del náhuatl
] as const
export type PronunciationMode = typeof PRONUNCIATION_MODES[number]

export type AnyMode = ListeningMode | PronunciationMode

export const MODULE_MODES: Record<Module, readonly string[]> = {
  listening: LISTENING_MODES,
  pronunciation: PRONUNCIATION_MODES,
}

/** Etiquetas de interfaz en español. */
export const MODULE_LABELS: Record<Module, { title: string; tagline: string }> = {
  listening: {
    title: 'Escucha',
    tagline: 'Entrena el oído con audio en náhuatl y comprueba tu comprensión.',
  },
  pronunciation: {
    title: 'Pronunciación',
    tagline: 'Habla en náhuatl y recibe retroalimentación fonética inmediata.',
  },
}

// Cultural / Thematic Domains (náhuatl)
export const DOMAINS = [
  'vida_cotidiana',
  'naturaleza',
  'familia_comunidad',
  'tradiciones',
  'comida',
  'comercio',
] as const
export type Domain = typeof DOMAINS[number]

// Agent Types
export const AGENT_TYPES = [
  'ai_tutor',
  'learning',
  'analytics',
  'product',
  'engineering',
] as const
export type AgentType = typeof AGENT_TYPES[number]

// System Events (per TDD §2.8)
export const SYSTEM_EVENTS = [
  'USER_REGISTERED',
  'USER_LOGGED_IN',
  'SESSION_STARTED',
  'MESSAGE_SENT',
  'MESSAGE_RECEIVED',
  'CORRECTION_ISSUED',
  'USER_COMPLETED_LESSON',
  'RECOMMENDATION_GENERATED',
  'PROGRESS_UPDATED',
  'VOCABULARY_LEARNED',
  'PAYMENT_SUCCEEDED',
  'PAYMENT_FAILED',
  'PLAN_CHANGED',
  'ERROR_DETECTED',
  'ENGINEERING_INSIGHT',
] as const
export type SystemEventName = typeof SYSTEM_EVENTS[number]

// Plans
export const PLAN_CODES = ['basico', 'pro', 'equipo', 'enterprise'] as const
export type PlanCode = typeof PLAN_CODES[number]

// Result type for safe error handling
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
