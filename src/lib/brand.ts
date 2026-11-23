// AXIOM — Identidad y atribución (proyecto de inglés)

export const BRAND = {
  name: 'Axiom',
  tagline: 'Inglés profesional para el trabajo',
  description:
    'Plataforma de aprendizaje de inglés enfocada en el ámbito profesional: conversación, lectura, escritura y voz.',

  /** Las cuatro habilidades que cubre la plataforma. */
  skills: ['Conversación', 'Lectura', 'Escritura', 'Voz'] as const,
} as const

export const ORGANIZATION = {
  /** Nombre del equipo responsable. */
  name: 'Axiom Enterprise',
  /** Canales de contacto para asuntos de marca y titularidad. */
  contactEmail: 'canales oficiales de Axiom Enterprise',
} as const

export const SIBLING_PROJECT = {
  /** Proyecto hermano de náhuatl. */
  name: 'Axiom Náhuatl',
  language: 'náhuatl',
} as const

export const ATTRIBUTION = {
  /** Línea corta, para el pie de página. */
  short: `${BRAND.name} y ${SIBLING_PROJECT.name} son proyectos hermanos de ${ORGANIZATION.name}.`,

  /** Versión con el alcance explícito, para la pantalla de acceso. */
  full: `${BRAND.name} enseña inglés profesional y cubre conversación, lectura, escritura y voz. ${SIBLING_PROJECT.name}, su proyecto hermano, enseña ${SIBLING_PROJECT.language}. Ambos pertenecen a ${ORGANIZATION.name}.`,

  /** Nota de titularidad de marcas. */
  rights: `${BRAND.name}® y ${SIBLING_PROJECT.name}® son marcas de ${ORGANIZATION.name}. Todos los derechos reservados.`,

  year: 2026,
} as const

export const COPYRIGHT = `© ${ATTRIBUTION.year} ${ORGANIZATION.name}`
