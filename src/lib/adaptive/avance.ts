// R15 — «Avance»: traducción amable del theta interno (IRT) para la UI.
// El usuario nunca ve la palabra theta: ve un porcentaje 0-100 y una etiqueta.

/** theta (-3..2) -> avance 0-100. */
export function thetaToAvance(theta: number): number {
  return Math.max(0, Math.min(100, Math.round(((theta + 3) / 5) * 100)))
}

/** Etiqueta de etapa según el avance (0-100). */
export function avanceLabel(avance: number): string {
  if (avance < 20) return 'Iniciándote'
  if (avance < 40) return 'Cimentando'
  if (avance < 60) return 'Progresando'
  if (avance < 80) return 'Consolidando'
  return 'Dominando'
}

/** Frase de apoyo que explica qué significa el avance. */
export function avanceHint(avance: number): string {
  if (avance < 20) return 'Cada nodo que completas hace crecer tu avance.'
  if (avance < 40) return 'Vas construyendo una base sólida. ¡Sigue así!'
  if (avance < 60) return 'Ya comunicas lo esencial con seguridad.'
  if (avance < 80) return 'Tu inglés se sostiene solo en situaciones reales.'
  return 'Nivel de expertos: dominas lo que practicas.'
}

/** theta -> nivel MCER grueso (para el test de colocación). */
export function thetaToCefrGroup(theta: number): 'A1' | 'A2' | 'B1' {
  if (theta <= -1.5) return 'A1'
  if (theta <= 0) return 'A2'
  return 'B1'
}
