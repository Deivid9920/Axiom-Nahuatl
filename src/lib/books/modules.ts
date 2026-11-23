// Definición de los 10 módulos CEFR del curso de inglés (450 h formales).
// Fuente de alcance: «Modulos ingles Axiom.pdf» (progresión didáctica A1.1 → B1.2)
// calibrada contra el MCER/CEFR del Consejo de Europa y el Companion Volume.
// Arquitectura de cada módulo de 45 h: Grammar 10 h · Writing 8 h · Speaking 10 h
// · Listening 8 h · Vocabulary+Pronunciation 5 h · Review+exam 4 h.

export interface ModuleLesson {
  key: string          // clave corta del nodo, p. ej. 'm1-g1'
  title: string        // título del nodo en el camino
  block: 'grammar' | 'writing' | 'speaking' | 'listening' | 'vocab' | 'review' | 'final'
  hours: number        // horas nominales del bloque dentro de las 45 h
  skill: 'reading' | 'writing' | 'listening' | 'speaking'
  icon: string         // material symbol
  desc: string         // subtítulo del nodo en el camino
}

export interface CourseModule {
  code: string         // 'm1'..'m10' (valor del campo module en CurriculumTopic)
  index: number        // 1-10
  level: string        // 'A1.1'..'B1.2' (etiqueta pedagógica; A1+ y A2+ son nomenclatura interna)
  levelGroup: string   // 'A1' | 'A2' | 'B1' (nivel MCER oficial)
  title: string
  purpose: string
  hours: number        // 45
  thetaFloor: number   // ability mínima (IRT) que respalda el avance a este módulo
  lessons: ModuleLesson[]
}

// Distribución horaria por bloque dentro de un módulo de 45 h
export const BLOCK_HOURS: Record<string, number> = {
  grammar: 10, writing: 8, speaking: 10, listening: 8, vocab: 5, review: 2, final: 2,
}

export const BLOCK_LABELS: Record<string, string> = {
  grammar: 'Gramática', writing: 'Escritura', speaking: 'Speaking',
  listening: 'Listening', vocab: 'Vocabulario y pronunciación', review: 'Repaso', final: 'Evaluación final',
}

const L = (key: string, title: string, block: ModuleLesson['block'], hours: number, icon: string, desc: string): ModuleLesson => ({
  key, title, block, hours,
  skill: block === 'final' || block === 'speaking' ? 'speaking' : block === 'listening' ? 'listening' : block === 'writing' ? 'writing' : 'reading',
  icon: block === 'final' ? 'auto_awesome' : block === 'review' ? 'fact_check' : block === 'grammar' ? 'account_tree' : block === 'vocab' ? 'style' : block === 'writing' ? 'edit_note' : block === 'speaking' ? 'record_voice_over' : 'hearing',
  desc,
})

export const COURSE_MODULES: CourseModule[] = [
  {
    code: 'm1', index: 1, level: 'A1.1', levelGroup: 'A1', hours: 45, thetaFloor: -3.0,
    title: 'Supervivencia lingüística', purpose: 'Presentación personal y necesidades inmediatas',
    lessons: [
      L('g1', 'Pronombres y verbo to be', 'grammar', 4, 'account_tree', 'I, you, he, she, it, we, they + am/is/are y contracciones'),
      L('g2', 'Artículos, sustantivos y demostrativos', 'grammar', 3, 'account_tree', 'a, an, the; singular y plural; this, that, these, those'),
      L('g3', 'Posesivos, preguntas y There is/are', 'grammar', 3, 'account_tree', 'my/your/his + \'s; what, who, where; There is / There are'),
      L('v1', 'Vocabulario de presentación personal', 'vocab', 3, 'style', 'País, nacionalidad, ocupación, edad y familia'),
      L('v2', 'Sonidos básicos del inglés', 'vocab', 2, 'style', 'Pares mínimos y letras problemáticas para hispanohablantes'),
      L('w1', 'Datos personales y formularios', 'writing', 4, 'edit_note', 'Frases afirmativas y negativas para registrarte por escrito'),
      L('w2', 'Describir personas y lugares', 'writing', 4, 'edit_note', 'Adjetivos básicos, preposiciones de lugar y orden de la oración'),
      L('s1', 'Saludar y presentarse', 'speaking', 4, 'record_voice_over', 'Saludos, despedidas y deletrear tu nombre'),
      L('s2', 'Dar información personal', 'speaking', 3, 'record_voice_over', 'Edad, nacionalidad y ocupación; hablar de tu familia'),
      L('s3', 'Identificar personas y objetos', 'speaking', 3, 'record_voice_over', 'Describir lugares sencillos y objetos del entorno'),
      L('l1', 'Nombres, números y saludos', 'listening', 4, 'hearing', 'Reconocer datos personales y entender saludos'),
      L('l2', 'Instrucciones y preguntas básicas', 'listening', 4, 'hearing', 'Comprender instrucciones simples y preguntas comunes'),
      L('r1', 'Repaso del módulo 1', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm2', index: 2, level: 'A1.2', levelGroup: 'A1', hours: 45, thetaFloor: -3.0,
    title: 'Vida cotidiana básica', purpose: 'Rutinas, gustos y compras del día a día',
    lessons: [
      L('g1', 'Present Simple y tercera persona', 'grammar', 4, 'account_tree', 'he works; auxiliares do/does; preguntas y negaciones'),
      L('g2', 'Have got y capacidad con can', 'grammar', 3, 'account_tree', 'have/have got; can/can\'t; verbos modales básicos'),
      L('g3', 'Cuantificadores y comparativos', 'grammar', 3, 'account_tree', 'some/any, much/many; contables; comparativos básicos'),
      L('v1', 'Rutinas, comida y compras', 'vocab', 3, 'style', 'Léxico de rutinas diarias, alimentos y tiendas'),
      L('v2', 'Ritmo y frecuencia', 'vocab', 2, 'style', 'Adverbios de frecuencia y preposiciones de tiempo'),
      L('w1', 'Rutinas y mensajes cortos', 'writing', 4, 'edit_note', 'Describir hábitos y escribir mensajes breves'),
      L('w2', 'Correos informales y familia', 'writing', 4, 'edit_note', 'Correos electrónicos sencillos y descripción de familiares'),
      L('s1', 'Hablar de tu rutina', 'speaking', 4, 'record_voice_over', 'Rutina diaria, horarios y habilidades'),
      L('s2', 'Gustos, comida y compras', 'speaking', 3, 'record_voice_over', 'Preferencias, pedir comida y comprar productos'),
      L('s3', 'Conversaciones breves', 'speaking', 3, 'record_voice_over', 'Mantener intercambios cortos de la vida diaria'),
      L('l1', 'Rutinas y horarios', 'listening', 4, 'hearing', 'Entender rutinas, horarios e información personal'),
      L('l2', 'Compras y restaurantes', 'listening', 4, 'hearing', 'Diálogos de compras, precios e ideas principales'),
      L('r1', 'Repaso del módulo 2', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm3', index: 3, level: 'A1+', levelGroup: 'A1', hours: 45, thetaFloor: -2.5,
    title: 'Expansión de A1', purpose: 'Hacia la comunicación independiente',
    lessons: [
      L('g1', 'Present Continuous', 'grammar', 4, 'account_tree', 'Forma -ing y diferencia con Present Simple'),
      L('g2', 'Pasado de to be y Past Simple', 'grammar', 3, 'account_tree', 'was/were; pasado de verbos frecuentes, regulares e irregulares'),
      L('g3', 'Comparativos y conectores', 'grammar', 3, 'account_tree', 'Comparativos y superlativos; too/enough; and, but, because, so'),
      L('v1', 'Viajes y experiencias', 'vocab', 3, 'style', 'Léxico de viajes, fotografías y actividades pasadas'),
      L('v2', 'Pronombres indefinidos', 'vocab', 2, 'style', 'someone, anyone, everybody y preguntas más complejas'),
      L('w1', 'Narrar acontecimientos simples', 'writing', 4, 'edit_note', 'Experiencias recientes y un viaje en pasado'),
      L('w2', 'Describir y comparar', 'writing', 4, 'edit_note', 'Fotografías, personas y lugares; párrafos conectados'),
      L('s1', 'Experiencias pasadas', 'speaking', 4, 'record_voice_over', 'Contar qué hiciste y describir fotografías'),
      L('s2', 'Comparar y opinar', 'speaking', 3, 'record_voice_over', 'Comparar personas y objetos; expresar preferencias'),
      L('s3', 'Planes y conversación larga', 'speaking', 3, 'record_voice_over', 'Hablar de planes y mantener varios intercambios'),
      L('l1', 'Conversaciones sobre experiencias', 'listening', 4, 'hearing', 'Actividades actuales, descripciones y viajes'),
      L('l2', 'Información específica', 'listening', 4, 'hearing', 'Situaciones sociales y detección de información concreta'),
      L('r1', 'Repaso del módulo 3', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm4', index: 4, level: 'A1+', levelGroup: 'A1', hours: 45, thetaFloor: -2.5,
    title: 'Consolidación y transición a A2', purpose: 'Futuro, obligación y primeras opiniones',
    lessons: [
      L('g1', 'Past Simple completo', 'grammar', 4, 'account_tree', 'Expresiones de pasado y narración breve'),
      L('g2', 'Futuro: will y going to', 'grammar', 3, 'account_tree', 'Diferencias entre will y going to; planes futuros'),
      L('g3', 'Obligación y consejo', 'grammar', 3, 'account_tree', 'must/have to; should; may/might; primer condicional introductorio'),
      L('v1', 'Vacaciones y planes', 'vocab', 3, 'style', 'Léxico de vacaciones, invitaciones y recomendaciones'),
      L('v2', 'Conectores y adverbios', 'vocab', 2, 'style', 'Conectores del discurso y adverbios de grado'),
      L('w1', 'Narraciones y correos', 'writing', 4, 'edit_note', 'Narraciones breves, correos informales e invitaciones'),
      L('w2', 'Planes y opiniones', 'writing', 4, 'edit_note', 'Describir planes futuros y opinar de forma sencilla'),
      L('s1', 'Planear unas vacaciones', 'speaking', 4, 'record_voice_over', 'Hablar de vacaciones y planificar actividades'),
      L('s2', 'Sugerencias y ayuda', 'speaking', 3, 'record_voice_over', 'Hacer sugerencias, pedir ayuda y recomendar'),
      L('s3', 'Problemas cotidianos', 'speaking', 3, 'record_voice_over', 'Explicar problemas y expresar opiniones simples'),
      L('l1', 'Anuncios e indicaciones', 'listening', 4, 'hearing', 'Anuncios, direcciones y conversaciones de viajes'),
      L('l2', 'Conversaciones moderadas', 'listening', 4, 'hearing', 'Planes, recomendaciones y velocidad moderada'),
      L('r1', 'Repaso del módulo 4', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm5', index: 5, level: 'A2.1', levelGroup: 'A2', hours: 45, thetaFloor: -2.0,
    title: 'Comunicación funcional', purpose: 'Situaciones cotidianas y narración simple',
    lessons: [
      L('g1', 'Present Perfect introductorio', 'grammar', 4, 'account_tree', 'ever/never; just, already, yet'),
      L('g2', 'Past Continuous', 'grammar', 3, 'account_tree', 'Diferencia Past Simple / Past Continuous en narración'),
      L('g3', 'Infinitivo y gerundio', 'grammar', 3, 'account_tree', 'Verbos + infinitivo y verbos + -ing; relativos básicos'),
      L('v1', 'Experiencias de vida', 'vocab', 3, 'style', 'Léxico de experiencias, trabajos y problemas cotidianos'),
      L('v2', 'Cuantificadores avanzados', 'vocab', 2, 'style', 'Cuantificadores de A2 y pronombres relativos'),
      L('w1', 'Experiencias personales', 'writing', 4, 'edit_note', 'Historias cortas y correos semiformales'),
      L('w2', 'Problemas y recomendaciones', 'writing', 4, 'edit_note', 'Describir problemas, opinar y recomendar; varios párrafos'),
      L('s1', 'Contar experiencias', 'speaking', 4, 'record_voice_over', 'Acontecimientos pasados con detalle'),
      L('s2', 'Explicar y resolver', 'speaking', 3, 'record_voice_over', 'Explicar problemas y pedir soluciones'),
      L('s3', 'Comparar alternativas', 'speaking', 3, 'record_voice_over', 'Comparar opciones y hacer recomendaciones'),
      L('l1', 'Entrevistas e historias', 'listening', 4, 'hearing', 'Entrevistas sencillas, historias y experiencias'),
      L('l2', 'Trabajo y servicios', 'listening', 4, 'hearing', 'Conversaciones de trabajo y situaciones de servicio'),
      L('r1', 'Repaso del módulo 5', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm6', index: 6, level: 'A2.2', levelGroup: 'A2', hours: 45, thetaFloor: -2.0,
    title: 'Mayor autonomía', purpose: 'Comunicación funcional más amplia',
    lessons: [
      L('g1', 'Present Perfect vs Past Simple', 'grammar', 4, 'account_tree', 'Contraste de perfectos y pasado; futuro con will/going to'),
      L('g2', 'Modales y condicionales', 'grammar', 3, 'account_tree', 'Obligación, permiso y prohibición; zero y first conditional'),
      L('g3', 'Relativas, pasiva y estilo indirecto', 'grammar', 3, 'account_tree', 'Oraciones relativas, pasiva introductoria y reported speech básico'),
      L('v1', 'Phrasal verbs frecuentes', 'vocab', 3, 'style', 'Phrasal verbs del día a día y conectores de causa y contraste'),
      L('v2', 'Quejas y gestión', 'vocab', 2, 'style', 'Léxico de reclamos, solicitudes y servicio al cliente'),
      L('w1', 'Correos formales y quejas', 'writing', 4, 'edit_note', 'Correos formales sencillos, quejas y solicitudes'),
      L('w2', 'Descripciones y opiniones', 'writing', 4, 'edit_note', 'Descripciones detalladas y opiniones estructuradas'),
      L('s1', 'Resolver problemas', 'speaking', 4, 'record_voice_over', 'Reclamar, pedir y negociar situaciones simples'),
      L('s2', 'Explicar procedimientos', 'speaking', 3, 'record_voice_over', 'Explicar cómo hacer algo paso a paso'),
      L('s3', 'Conversaciones largas', 'speaking', 3, 'record_voice_over', 'Mantener conversaciones más largas con detalle'),
      L('l1', 'Teléfonos y servicio', 'listening', 4, 'hearing', 'Conversaciones telefónicas y servicio al cliente'),
      L('l2', 'Entrevistas y noticias', 'listening', 4, 'hearing', 'Entrevistas, noticias sencillas e información práctica'),
      L('r1', 'Repaso del módulo 6', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm7', index: 7, level: 'A2+', levelGroup: 'A2', hours: 45, thetaFloor: -1.5,
    title: 'Complejidad', purpose: 'Mayor fluidez y precisión',
    lessons: [
      L('g1', 'Past Perfect y Second Conditional', 'grammar', 4, 'account_tree', 'Pasado perfecto e hipótesis con if'),
      L('g2', 'Pasiva y Reported Speech', 'grammar', 3, 'account_tree', 'Pasiva en distintos tiempos y estilo indirecto'),
      L('g3', 'Relative clauses y used to', 'grammar', 3, 'account_tree', 'Cláusulas relativas, used to y modales de probabilidad'),
      L('v1', 'Colocaciones y conectores', 'vocab', 3, 'style', 'Colocaciones, conectores discursivos y adverbios de grado'),
      L('v2', 'Oraciones complejas', 'vocab', 2, 'style', 'Formación de oraciones complejas y gerundios/infinitivos'),
      L('w1', 'Ensayos y argumentos', 'writing', 4, 'edit_note', 'Ensayos cortos y textos argumentativos sencillos'),
      L('w2', 'Reseñas y correos formales', 'writing', 4, 'edit_note', 'Reseñas, descripciones y opinión con argumentos'),
      L('s1', 'Defender una opinión', 'speaking', 4, 'record_voice_over', 'Ventajas, desventajas y explicación de ideas'),
      L('s2', 'Hablar varios minutos', 'speaking', 3, 'record_voice_over', 'Monólogo sostenido y experiencias con detalle'),
      L('s3', 'Situaciones hipotéticas', 'speaking', 3, 'record_voice_over', 'Resolver situaciones imaginarias con condicionales'),
      L('l1', 'Conversaciones naturales', 'listening', 4, 'hearing', 'Conversaciones reales y podcasts educativos'),
      L('l2', 'Intención del hablante', 'listening', 4, 'hearing', 'Entrevistas, narraciones e identificación de intención'),
      L('r1', 'Repaso del módulo 7', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm8', index: 8, level: 'A2+', levelGroup: 'A2', hours: 45, thetaFloor: -1.5,
    title: 'Transición a B1', purpose: 'Consolidación de tiempos y estructuras complejas',
    lessons: [
      L('g1', 'Consolidación de tiempos', 'grammar', 4, 'account_tree', 'Present Perfect Continuous, Past Perfect y futuros'),
      L('g2', 'Second Conditional y pasiva', 'grammar', 3, 'account_tree', 'Condicionales, pasiva en tiempos y deducción modal'),
      L('g3', 'Purpose, reason y contrast', 'grammar', 3, 'account_tree', 'Cláusulas de propósito, razón y contraste'),
      L('v1', 'Phrasal verbs y colocaciones', 'vocab', 3, 'style', 'Phrasal verbs ampliados y colocaciones frecuentes'),
      L('v2', 'Cohesión entre párrafos', 'vocab', 2, 'style', 'Discourse markers y estructura de textos'),
      L('w1', 'Ensayo y texto de opinión', 'writing', 4, 'edit_note', 'Ensayo corto, opinión y carta formal'),
      L('w2', 'Comparativo y argumentación', 'writing', 4, 'edit_note', 'Texto comparativo, reseña y narración estructurada'),
      L('s1', 'Presentaciones y debates', 'speaking', 4, 'record_voice_over', 'Presentaciones breves y debates sencillos'),
      L('s2', 'Acuerdo y desacuerdo', 'speaking', 3, 'record_voice_over', 'Expresar acuerdo, desacuerdo y defender argumentos'),
      L('s3', 'Temas sociales', 'speaking', 3, 'record_voice_over', 'Educación, trabajo y tecnología'),
      L('l1', 'Velocidad normal moderada', 'listening', 4, 'hearing', 'Entrevistas, radio y presentaciones'),
      L('l2', 'Ideas principales y secundarias', 'listening', 4, 'hearing', 'Vídeos educativos y distinción de ideas'),
      L('r1', 'Repaso del módulo 8', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm9', index: 9, level: 'B1.1', levelGroup: 'B1', hours: 45, thetaFloor: -1.0,
    title: 'Comunicación independiente', purpose: 'Dominio funcional de tiempos y debate',
    lessons: [
      L('g1', 'Perfect tenses y condicionales', 'grammar', 4, 'account_tree', 'Dominio funcional de perfectos y todos los condicionales'),
      L('g2', 'Pasiva, reported y modales', 'grammar', 3, 'account_tree', 'Voz pasiva, estilo indirecto y modales en B1'),
      L('g3', 'Clauses complejas y narración', 'grammar', 3, 'account_tree', 'Linking words, cláusulas complejas y tiempos para narrar'),
      L('v1', 'Phrasal verbs de B1', 'vocab', 3, 'style', 'Phrasal verbs y gerundios/infinitivos de nivel B1'),
      L('v2', 'Léxico de opinión', 'vocab', 2, 'style', 'Argumentación, contraargumentos y conectores'),
      L('w1', 'Ensayos de opinión', 'writing', 4, 'edit_note', 'Ensayos, cartas formales y correos profesionales'),
      L('w2', 'Artículos y argumentación', 'writing', 4, 'edit_note', 'Artículos cortos, reseñas y textos argumentativos'),
      L('s1', 'Conversación espontánea', 'speaking', 4, 'record_voice_over', 'Fluidez en intercambios improvisados'),
      L('s2', 'Presentaciones y debate', 'speaking', 3, 'record_voice_over', 'Presentar ideas y debatir con argumentos'),
      L('s3', 'Resolución colaborativa', 'speaking', 3, 'record_voice_over', 'Resolver problemas en colaboración'),
      L('l1', 'Noticias y podcasts', 'listening', 4, 'hearing', 'Noticias de temas conocidos y podcasts'),
      L('l2', 'Opinión y actitud', 'listening', 4, 'hearing', 'Identificar opinión, actitud e intención'),
      L('r1', 'Repaso del módulo 9', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
  {
    code: 'm10', index: 10, level: 'B1.2', levelGroup: 'B1', hours: 45, thetaFloor: -1.0,
    title: 'Consolidación de B1', purpose: 'Precisión, naturalidad y preparación de evaluación',
    lessons: [
      L('g1', 'Revisión integral de tiempos', 'grammar', 4, 'account_tree', 'Perfect aspects, condicionales y pasiva en revisión'),
      L('g2', 'Reported speech y modales', 'grammar', 3, 'account_tree', 'Estilo indirecto, modales y relative clauses'),
      L('g3', 'Precisión y naturalidad', 'grammar', 3, 'account_tree', 'Errores frecuentes, registro formal/informal y complejas'),
      L('v1', 'Discourse markers y collocations', 'vocab', 3, 'style', 'Marcadores del discurso, colocaciones y phrasal verbs'),
      L('v2', 'Cohesión y coherencia', 'vocab', 2, 'style', 'Conectores para resumir y justificar opiniones'),
      L('w1', 'Ensayo B1 y artículo', 'writing', 4, 'edit_note', 'Ensayo B1, artículo, carta formal y email profesional'),
      L('w2', 'Review, report y narración', 'writing', 4, 'edit_note', 'Reseñas, reportes y resumir información'),
      L('s1', 'Presentación de 3-5 minutos', 'speaking', 4, 'record_voice_over', 'Monólogo largo estructurado y debate'),
      L('s2', 'Especulación y problemas', 'speaking', 3, 'record_voice_over', 'Especular, comparar y resolver problemas'),
      L('s3', 'Simulación de examen B1', 'speaking', 3, 'record_voice_over', 'Práctica guiada del formato de examen B1'),
      L('l1', 'Acentos y charlas', 'listening', 4, 'hearing', 'Charlas, presentaciones y acentos comprensibles'),
      L('l2', 'Inferencia y actitud', 'listening', 4, 'hearing', 'Inferencias, detalles e intención del hablante'),
      L('r1', 'Repaso del módulo 10', 'review', 2, 'fact_check', 'Mezcla inteligente de todo lo practicado'),
      L('f1', 'Evaluación final con IA', 'final', 2, 'auto_awesome', 'Examen integral del módulo con retroalimentación de IA'),
    ],
  },
]

export function getModule(code: string): CourseModule | undefined {
  return COURSE_MODULES.find(m => m.code === code)
}
