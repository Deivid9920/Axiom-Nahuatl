// AXIOM — Identidad y atribución
// Los tres valores marcados como PLACEHOLDER llevan un nombre provisional.

export const BRAND = {
  name: 'Axiom',
  tagline: 'Escucha y pronunciación del náhuatl',
  description:
    'Plataforma de aprendizaje de náhuatl centrada exclusivamente en dos habilidades orales: la comprensión auditiva y la pronunciación.',

  /** Las únicas dos habilidades que cubre la plataforma. */
  skills: ['Escucha', 'Pronunciación'] as const,
} as const

export const ORGANIZATION = {
  /** PLACEHOLDER — nombre legal de la asociación. */
  name: 'Asociación [NOMBRE_ASOCIACIÓN]',
  /** PLACEHOLDER — correo de contacto para asuntos de marca y titularidad. */
  contactEmail: '[CONTACTO@DOMINIO]',
} as const

export const SIBLING_PROJECT = {
  /** PLACEHOLDER — nombre del proyecto hermano de inglés. */
  name: '[NOMBRE_PROYECTO_INGLÉS]',
  language: 'inglés',
} as const

export const ATTRIBUTION = {
  /** Línea corta, para el pie de página. */
  short: `${BRAND.name} y ${SIBLING_PROJECT.name} son proyectos hermanos de ${ORGANIZATION.name}.`,

  /** Versión con el alcance explícito, para la pantalla de acceso. */
  full: `${BRAND.name} enseña náhuatl y cubre únicamente escucha y pronunciación. ${SIBLING_PROJECT.name}, su proyecto hermano, enseña ${SIBLING_PROJECT.language}. Ambos pertenecen a ${ORGANIZATION.name}.`,

  /** Nota de titularidad de marcas. */
  rights: `${BRAND.name}® y ${SIBLING_PROJECT.name}® son marcas de ${ORGANIZATION.name}. Todos los derechos reservados.`,

  year: 2026,
} as const

export const COPYRIGHT = `© ${ATTRIBUTION.year} ${ORGANIZATION.name}`
