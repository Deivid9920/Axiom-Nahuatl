import { PrismaClient } from '@prisma/client'
import process from 'node:process'

const prisma = new PrismaClient()

const MODULES_DATA = [
  {
    moduleNumber: 1,
    cefrLevel: 'A1.1',
    title: 'Módulo 1 — A1.1: Supervivencia lingüística y presentación personal',
    purpose: 'Supervivencia lingüística y presentación personal (saludos, datos personales, entorno inmediato)',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Fundamentos (10 h)',
        allocatedHours: 10,
        topics: [
          'Pronombres personales: I, you, he, she, it, we, they',
          'Verbo to be (afirmativo, negativo e interrogativo)',
          "Contracciones: I'm, you're, he's...",
          'Artículos: a, an, the',
          'Sustantivos singulares y plurales regulares/irregulares',
          'Demostrativos: this, that, these, those',
          'Adjetivos básicos y posición antes del sustantivo',
          'Posesivos: my, your, his, her, its, our, their y genitivo sajón (\'s)',
          'Preguntas con palabras interrogativas: what, who, where, when, how',
          'Orden básico de la oración (Sujeto + Verbo + Objeto)',
          'Imperativos básicos para instrucciones',
          'There is / There are (singular y plural)',
          'Preposiciones básicas de lugar: in, on, under, next to, behind',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura Inicial (8 h)',
        allocatedHours: 8,
        topics: [
          'Escribir datos personales en formularios sencillos',
          'Presentarse por escrito en contextos cotidianos',
          'Construcción de frases afirmativas y negativas básicas',
          'Describir personas (aspecto físico y personalidad básica)',
          'Describir objetos cotidianos y su ubicación',
          'Describir una habitación o espacio de trabajo',
          'Escribir una breve presentación personal de 50 palabras',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Expresión Oral: Presentación y Saludos (10 h)',
        allocatedHours: 10,
        topics: [
          'Saludar, despedirse y fórmulas de cortesía',
          'Presentarse a sí mismo y a otros',
          'Deletrear nombres propios y direcciones de correo',
          'Dar información personal (edad, nacionalidad, ocupación)',
          'Preguntar y responder sobre la familia',
          'Identificar personas y objetos en el entorno',
          'Describir lugares sencillos con there is / there are',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva de Supervivencia (8 h)',
        allocatedHours: 8,
        topics: [
          'Reconocer nombres, números telefónicos y precios',
          'Entender saludos y despedidas en situaciones reales',
          'Comprender información personal en diálogos lentos',
          'Identificar profesiones y nacionalidades',
          'Comprender instrucciones simples del aula o aplicación',
          'Identificar objetos y lugares a partir de descripciones orales',
          'Comprender preguntas básicas formuladas con claridad',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario Esencial y Fonética Básica (5 h)',
        allocatedHours: 5,
        topics: [
          'El alfabeto inglés y deletreo fonético',
          'Números del 0 al 100, colores y días',
          'Familia, profesiones y objetos cotidianos',
          'Sonidos vocálicos cortos y largos básicos (/ɪ/ vs /iː/)',
          'Acentuación léxica de palabras de dos sílabas',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Consolidación y Evaluación Módulo 1 (4 h)',
        allocatedHours: 4,
        topics: [
          'Repaso integrado de estructuras de A1.1',
          'Simulación de tareas comunicativas de supervivencia',
          'Examen de evaluación de las 4 habilidades del Módulo 1',
        ],
      },
    ],
  },
  {
    moduleNumber: 2,
    cefrLevel: 'A1.2',
    title: 'Módulo 2 — A1.2: Vida cotidiana básica',
    purpose: 'Vida cotidiana básica (rutinas, hábitos, compras, comidas y horarios)',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Rutinas y Cantidades (10 h)',
        allocatedHours: 10,
        topics: [
          'Have / have got para posesión',
          'Present Simple: reglas de uso para hábitos y rutinas',
          'Tercera persona del singular: terminaciones -s, -es, -ies (he works)',
          'Auxiliares do / does en oraciones interrogativas y negativas',
          'Adverbios de frecuencia: always, usually, often, sometimes, never',
          'Preposiciones de tiempo: at, in, on',
          'Verbo modal can / can\'t para habilidad y permiso',
          'Pronombres objeto: me, you, him, her, it, us, them',
          'Sustantivos contables e incontables',
          'Cuantificadores: some, any, much, many, a lot of',
          'Comparativos básicos regulares (-er / more)',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura de Rutinas y Mensajes Cortos (8 h)',
        allocatedHours: 8,
        topics: [
          'Redacción de un día típico y rutinas diarias',
          'Descripción de hábitos personales y de ocio',
          'Descripción detallada de familiares y amigos',
          'Mensajes cortos y notas de aviso',
          'Correos electrónicos informales sencillos para hacer planes',
          'Redacción de gustos, preferencias y pasatiempos',
          'Escribir párrafos cortos cohesionados con conectores and/but',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Expresión Oral Cotidiana (10 h)',
        allocatedHours: 10,
        topics: [
          'Hablar sobre la rutina diaria y horarios habituales',
          'Expresar gustos y preferencias (like, love, hate + -ing)',
          'Hablar de habilidades personales con can / can\'t',
          'Pedir y dar información en comercios y transporte',
          'Ordenar comida y bebida en un restaurante o cafetería',
          'Preguntar precios y comprar productos',
          'Mantener conversaciones breves cara a cara',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva de Rutinas y Servicios (8 h)',
        allocatedHours: 8,
        topics: [
          'Entender descripciones de rutinas y horarios de transporte',
          'Identificar transacciones en tiendas y mercados',
          'Comprender pedidos y diálogos en restaurantes',
          'Extraer información personal en conversaciones breves',
          'Identificar la idea principal en diálogos cotidianos sencillos',
          'Diferenciar horas, fechas y números de teléfono al oído',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario Cotidiano y Pronunciación de -s (5 h)',
        allocatedHours: 5,
        topics: [
          'Actividades diarias, partes del día y alimentos',
          'Lugares de la ciudad y medios de transporte',
          'Pronunciación de la tercera persona -s: /s/, /z/, /ɪz/',
          'Pronunciación de can /kæn/ vs can\'t /kɑːnt/ o /kænt/',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Consolidación y Examen A1 Completo (4 h)',
        allocatedHours: 4,
        topics: [
          'Taller de integración de Present Simple y habilidades cotidianas',
          'Práctica de roleplay evaluativa',
          'Examen de certificación interna del nivel A1 oficial',
        ],
      },
    ],
  },
  {
    moduleNumber: 3,
    cefrLevel: 'A1+',
    title: 'Módulo 3 — A1+: Ampliación hacia comunicación independiente',
    purpose: 'Ampliación de A1 hacia comunicación independiente (acciones en progreso, pasado básico y descripciones)',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Acciones en Curso y Pasado Inicial (10 h)',
        allocatedHours: 10,
        topics: [
          'Revisión y afianzamiento integral de A1',
          'Present Continuous: forma y usos para acciones en el momento',
          'Contraste fundamental: Present Simple vs Present Continuous',
          'Pasado del verbo to be: was / were',
          'Past Simple de verbos frecuentes de alta necesidad',
          'Verbos regulares: regla general y ortográfica de -ed',
          'Verbos irregulares comunes (went, had, saw, bought, did)',
          'Expresiones temporales de pasado: yesterday, last week, ago',
          'Pronombres indefinidos: someone, anything, nowhere, everybody',
          'Comparativos y superlativos regulares e irregulares (good/better/best)',
          'Uso de intensificadores: too vs enough',
          'Conectores discursivos básicos: and, but, because, so',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Narración Simple y Comparaciones (8 h)',
        allocatedHours: 8,
        topics: [
          'Narrar acontecimientos simples en orden cronológico',
          'Describir experiencias y actividades recientes',
          'Redactar un relato breve sobre un viaje o fin de semana',
          'Describir una fotografía o escena detallando qué está pasando',
          'Comparar dos personas, ciudades o productos',
          'Escribir mensajes y correos más desarrollados con párrafos conectados',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Expresión Oral de Experiencias y Planes (10 h)',
        allocatedHours: 10,
        topics: [
          'Hablar de experiencias del fin de semana y actividades pasadas',
          'Describir fotografías y acciones en curso',
          'Comparar objetos, lugares y estilos de vida',
          'Hablar de planes e intenciones inmediatas',
          'Mantener conversaciones de varios intercambios sucesivos',
          'Expresar preferencias fundamentadas con because',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva de Experiencias y Viajes (8 h)',
        allocatedHours: 8,
        topics: [
          'Conversaciones breves sobre viajes y vacaciones',
          'Monólogos donde personas describen qué están haciendo',
          'Descripciones de personas y lugares turísticos',
          'Diferenciar auditivamente presente continuo vs presente simple',
          'Identificar detalles concretos en relatos sencillos de anécdotas',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario de Viajes y Fonética de -ed (5 h)',
        allocatedHours: 5,
        topics: [
          'Vacaciones, tipos de alojamiento y geografía',
          'Ropa, clima y descripciones de sensaciones',
          'Las tres pronunciaciones del sufijo -ed: /t/, /d/, /ɪd/',
          'Sonidos vocálicos contrastantes (/ʌ/ vs /æ/)',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Revisión y Evaluación Módulo 3 (4 h)',
        allocatedHours: 4,
        topics: [
          'Repaso de tiempos verbales contrastados',
          'Simulación de conversación guiada',
          'Examen de evaluación de 4 competencias Módulo 3',
        ],
      },
    ],
  },
  {
    moduleNumber: 4,
    cefrLevel: 'A1+',
    title: 'Módulo 4 — A1+: Consolidación de A1 y transición a A2',
    purpose: 'Consolidación de A1 y transición hacia A2 (pasado completo, futuros, modales de obligación y consejo)',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Transición a A2 (10 h)',
        allocatedHours: 10,
        topics: [
          'Past Simple completo: afirmativo, negativo (didn\'t) e interrogativo (Did you...?)',
          'Expresiones de tiempo pasado complejas y secuencia temporal',
          'Futuro con be going to para intenciones y planes firmes',
          'Futuro con will para predicciones y decisiones espontáneas',
          'Diferencias de uso pragmático entre will y going to',
          'Obligación y necesidad: must vs have to vs don\'t have to',
          'Consejo y sugerencia: should / shouldn\'t',
          'Posibilidad básica: may / might',
          'Introducción al First Conditional (If + present, will + infinitive)',
          'Conectores de secuencia y causa: first, then, after that, finally',
          'Formación de preguntas elaboradas con preposición al final',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura de Narraciones e Invitaciones (8 h)',
        allocatedHours: 8,
        topics: [
          'Narraciones breves de anécdotas y viajes pasados',
          'Redacción de correos informales aceptando o rechazando planes',
          'Invitaciones formales e informales para eventos',
          'Planes futuros detallados y descripción de proyectos personales',
          'Expresión de opiniones personales sencillas justificadas',
          'Relato de experiencias vividas con secuencia clara',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Conversación Funcional y Sugerencias (10 h)',
        allocatedHours: 10,
        topics: [
          'Hablar sobre vacaciones y anécdotas memorables',
          'Planificar actividades y ponerse de acuerdo con otra persona',
          'Hacer sugerencias con Shall we...? / Why don\'t we...?',
          'Pedir ayuda y dar recomendaciones usando should',
          'Describir problemas cotidianos y plantear soluciones sencillas',
          'Expresar opiniones simples y acuerdos básicos',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva de Anuncios y Planes (8 h)',
        allocatedHours: 8,
        topics: [
          'Anuncios públicos en aeropuertos, estaciones y centros comerciales',
          'Conversaciones telefónicas organizando un viaje o salida',
          'Indicaciones de ruta y direcciones de lugares',
          'Identificar planes futuros y decisiones en conversaciones cotidianas',
          'Comprensión de recomendaciones en diálogos a velocidad moderada',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario de Salud, Eventos y Formas Débiles (5 h)',
        allocatedHours: 5,
        topics: [
          'Partes del cuerpo, síntomas y visitas al médico',
          'Tecnología y vida digital básica',
          'Formas débiles de auxiliares y preposiciones (to, of, can, was)',
          'Entonación de preguntas abiertas vs cerradas',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Evaluación Puente A1 a A2 (4 h)',
        allocatedHours: 4,
        topics: [
          'Taller de diagnóstico del umbral A1/A2',
          'Examen integrador escrito y oral de transición',
        ],
      },
    ],
  },
  {
    moduleNumber: 5,
    cefrLevel: 'A2.1',
    title: 'Módulo 5 — A2.1: Situaciones cotidianas y narración simple',
    purpose: 'Situaciones cotidianas y narración simple (present perfect, pasado continuo y primeros condicionales)',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Experiencias y Tiempos Narrativos (10 h)',
        allocatedHours: 10,
        topics: [
          'Present Perfect introductorio: concepto de conexión pasado-presente',
          'Uso de ever y never para experiencias de vida',
          'Marcadores temporales: just, already, yet',
          'Past Continuous: forma y uso para acciones interrumpidas',
          'Contraste narrativo: Past Simple vs Past Continuous (when / while)',
          'Cuantificadores de nivel A2: too much, too many, enough, several',
          'Pronombres relativos básicos: who, which, where, that',
          'Consolidación del First Conditional en situaciones reales',
          'Patrones verbales: verbos seguidos de infinitivo (want to, decide to)',
          'Patrones verbales: verbos seguidos de gerundio (enjoy, avoid, mind)',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura Semiformal e Historias Cortas (8 h)',
        allocatedHours: 8,
        topics: [
          'Redacción de experiencias personales y logros',
          'Escritura de historias cortas usando pasado continuo y simple',
          'Correos electrónicos semiformales solicitando información',
          'Descripción detallada de problemas domésticos o laborales',
          'Artículos de opinión breve con argumentos a favor y en contra',
          'Construcción de textos estructurados en varios párrafos coherentes',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Narración de Experiencias y Argumentación Básica (10 h)',
        allocatedHours: 10,
        topics: [
          'Contar anécdotas y experiencias vividas sin pausas largas',
          'Hablar sobre acontecimientos pasados en secuencia coherente',
          'Explicar problemas y negociar soluciones posibles',
          'Comparar alternativas y defender la propia elección',
          'Dar consejos justificados a amigos o colegas',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión de Entrevistas e Historias (8 h)',
        allocatedHours: 8,
        topics: [
          'Entrevistas sencillas a personajes sobre su vida y trayectoria',
          'Narraciones orales de historias y leyendas adaptadas',
          'Conversaciones en contextos laborales y de oficina',
          'Situaciones de atención al cliente y servicio técnico',
          'Extracción de detalles específicos en conversaciones naturales',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Participios Irregulares y Fonética Conectada (5 h)',
        allocatedHours: 5,
        topics: [
          'Lista esencial de participios pasados irregulares',
          'Vocabulario de oficina, trámites y servicios cotidianos',
          'Contracciones en present perfect (I\'ve, she\'s gone)',
          'Acentuación en oraciones con pronombres relativos',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Evaluación y Consolidación A2.1 (4 h)',
        allocatedHours: 4,
        topics: [
          'Repaso de contrastes verbales (Present Perfect vs Past)',
          'Simulación de entrevista oral de nivel A2.1',
          'Examen formal de mitad de nivel A2',
        ],
      },
    ],
  },
  {
    moduleNumber: 6,
    cefrLevel: 'A2.2',
    title: 'Módulo 6 — A2.2: Comunicación funcional más amplia',
    purpose: 'Comunicación funcional más amplia (voz pasiva introductoria, estilo indirecto, modales de prohibición/permiso y phrasal verbs)',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática Funcional Intermedia (10 h)',
        allocatedHours: 10,
        topics: [
          'Present Perfect vs Past Simple: contraste sistemático con marcadores',
          'Sistemas de futuro contrastados: will vs going to vs present continuous',
          'Modales de obligación, permiso y prohibición: must, can, may, allowed to',
          'Comparativos avanzados: as... as, less... than, the most...',
          'Zero Conditional: verdades generales y hechos científicos',
          'First Conditional con unless, as soon as, in case',
          'Oraciones relativas especificativas (defining relative clauses)',
          'Introducción a la voz pasiva en presente y pasado simple',
          'Discurso indirecto introductorio (Reported speech: say / tell)',
          'Phrasal verbs frecuentes de dos palabras (turn on, give up, look for)',
          'Conectores de causa, contraste y consecuencia: because of, although, however, therefore',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura Formal Básica y Reclamaciones (8 h)',
        allocatedHours: 8,
        topics: [
          'Escribir correos formales sencillos para solicitudes o citas',
          'Redacción de cartas o correos de queja / reclamación por un producto',
          'Descripciones de procesos utilizando la voz pasiva introductoria',
          'Explicación escrita de problemas técnicos o de servicio',
          'Ensayos cortos de opinión estructurados con introducción, desarrollo y conclusión',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Resolución de Conflictos y Negociación (10 h)',
        allocatedHours: 10,
        topics: [
          'Plantear reclamaciones con cortesía y firmeza',
          'Hacer peticiones formales y responder a requerimientos',
          'Negociar condiciones sencillas en situaciones cotidianas',
          'Explicar el funcionamiento de un aparato o procedimiento paso a paso',
          'Participar en debates informales exponiendo puntos de vista',
          'Mantener conversaciones telefónicas de gestión cotidiana',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva Laboral y Telefónica (8 h)',
        allocatedHours: 8,
        topics: [
          'Llamadas telefónicas de servicio al cliente y reservas',
          'Instrucciones de trabajo y explicaciones técnicas sencillas',
          'Noticias de actualidad redactadas en lenguaje accesible',
          'Entrevistas de trabajo básicas',
          'Comprender la actitud del hablante (molestia, sorpresa, acuerdo)',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario de Negocios Básicos y Phrasal Verbs (5 h)',
        allocatedHours: 5,
        topics: [
          'Términos comerciales, bancarios y de consumo',
          'Phrasal verbs de movimiento y rutina diaria',
          'Acentuación tónica en phrasal verbs (turn ON vs TURN it on)',
          'Enlace vocálico y consonántico (linking /r/ and /j/)',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Examen de Certificación Nivel A2 Oficial (4 h)',
        allocatedHours: 4,
        topics: [
          'Taller de preparación para formato examen A2 (tipo KET)',
          'Simulación de examen completo de 4 habilidades',
          'Entrega de informe y feedback personalizado',
        ],
      },
    ],
  },
  {
    moduleNumber: 7,
    cefrLevel: 'A2+',
    title: 'Módulo 7 — A2+: Mayor fluidez y precisión',
    purpose: 'Mayor fluidez y precisión (past perfect, second conditional, reported speech y oraciones complejas)',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Precisión y Matices (10 h)',
        allocatedHours: 10,
        topics: [
          'Revisión profunda y ordenación de todos los tiempos verbales aprendidos',
          'Past Perfect introductorio: acciones anteriores a otro punto en el pasado',
          'Second Conditional introductorio: situaciones hipotéticas e irreales',
          'Voz pasiva con modales y tiempos continuos',
          'Reported Speech completo: cambios de tiempos verbales y pronombres',
          'Non-defining relative clauses (oraciones explicativas con comas)',
          'Modales de probabilidad y deducción: must be, can\'t be, might be',
          'Uso y contraste de used to vs would para hábitos pasados',
          'Gerundios e infinitivos con cambio de significado (remember, stop, try)',
          'Adverbios de grado: extremely, fairly, rather, totally',
          'Formación de oraciones complejas con múltiples cláusulas subordinadas',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Ensayos Breves y Reseñas (8 h)',
        allocatedHours: 8,
        topics: [
          'Ensayos cortos argumentando ventajas y desventajas',
          'Textos descriptivos detallados de lugares o fenómenos culturales',
          'Narraciones ricas en vocabulario con saltos temporales (past perfect)',
          'Correos y cartas formales con fórmulas protocolarias completas',
          'Escribir reseñas de películas, libros o productos comerciales',
          'Desarrollar una argumentación sólida con ejemplos concretos',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Argumentación Sólida y Monólogo Extendido (10 h)',
        allocatedHours: 10,
        topics: [
          'Defender una postura en un tema controvertido sin titubear',
          'Comparar alternativas sopesando pros y contras',
          'Hablar de forma ininterrumpida durante 2 a 3 minutos sobre un tema dado',
          'Describir experiencias personales con riqueza de detalles y matices',
          'Resolver situaciones hipotéticas planteadas con Second Conditional',
          'Manejo de conectores discursivos en el habla espontánea',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva de Podcasts y Debates (8 h)',
        allocatedHours: 8,
        topics: [
          'Fragmentos de podcasts educativos sobre ciencia, cultura y sociedad',
          'Conversaciones naturales entre hablantes nativos a velocidad normal',
          'Debates radiofónicos donde se expresan opiniones encontradas',
          'Inferir la intención, sarcasmo o empatía de los interlocutores',
          'Seguir explicaciones paso a paso de procesos complejos',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario Académico Inicial y Entonación Condicional (5 h)',
        allocatedHours: 5,
        topics: [
          'Sufijos y prefijos para cambio de categoría gramatical',
          'Adjetivos descriptivos de nivel B1 inicial',
          'Curvas de entonación en oraciones condicionales e hipotéticas',
          'Ritmo oracional y reducción de sílabas átonas',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Evaluación y Diagnóstico de Nivel A2+ (4 h)',
        allocatedHours: 4,
        topics: [
          'Taller de fluidez vs precisión gramatical',
          'Simulación de debate grupal evaluado',
          'Examen de certificación de nivel A2+',
        ],
      },
    ],
  },
  {
    moduleNumber: 8,
    cefrLevel: 'A2+',
    title: 'Módulo 8 — A2+: Transición hacia B1',
    purpose: 'Consolidación de estructuras complejas y transición definitiva hacia la autonomía B1',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Complejidad y Cohesión Textual (10 h)',
        allocatedHours: 10,
        topics: [
          'Consolidación y mapa mental de todos los tiempos verbales básicos',
          'Present Perfect Continuous introductorio (duración de acciones hasta el presente)',
          'Contraste: Present Perfect Simple vs Present Perfect Continuous',
          'Past Perfect consolidado en textos narrativos complejos',
          'Second Conditional consolidado y consejos con If I were you...',
          'Voz pasiva en tiempos compuestos y en registro periodístico',
          'Reported Speech: reporting verbs avanzados (admit, deny, promise, warn)',
          'Modales de deducción presentes: must, may, might, can\'t',
          'Clauses of purpose (in order to, so that)',
          'Clauses of reason and contrast (due to, whereas, despite / in spite of)',
          'Phrasal verbs inseparables y de tres partículas (look forward to, run out of)',
          'Collocations habituales de adjetivo + sustantivo y verbo + preposición',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura B1: Ensayos de Opinión y Textos Comparativos (8 h)',
        allocatedHours: 8,
        topics: [
          'Ensayo corto de opinión con estructura B1 estándar',
          'Texto comparativo analizando dos opciones con balance crítico',
          'Carta formal dirigida a una institución pública o académica',
          'Reseña crítica de un servicio cultural o comercial',
          'Narración estructurada con flashback usando tiempos pasados múltiples',
          'Garantizar la cohesión interna y transición fluida entre párrafos',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Debate, Presentaciones y Temas Sociales (10 h)',
        allocatedHours: 10,
        topics: [
          'Hacer una presentación breve estructurada de 3 minutos con introducción y cierre',
          'Participar activamente en debates defendiendo y rebatiendo argumentos',
          'Expresar acuerdo parcial y desacuerdo diplomático (I see your point, but...)',
          'Hablar sobre temas sociales de actualidad: educación, medio ambiente, empleo',
          'Analizar el impacto de la tecnología en la vida cotidiana',
          'Sostener una conversación sin necesidad de que el interlocutor adapte su habla',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión de Charlas y Medios de Comunicación (8 h)',
        allocatedHours: 8,
        topics: [
          'Conversaciones a velocidad natural moderada con vocabulario variado',
          'Entrevistas a especialistas sobre temas de interés general',
          'Boletines informativos de radio y vídeos divulgativos de internet',
          'Distinguir entre ideas principales, secundarias y digresiones',
          'Identificar la postura de los hablantes frente a un tema en disputa',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario Temático y Ritmo del Inglés (5 h)',
        allocatedHours: 5,
        topics: [
          'Medio ambiente, globalización y sociedad moderna',
          'Colocaciones de verbos comodín: make vs do, take vs get',
          'El ritmo basado en el acento (stress-timed rhythm) del inglés',
          'Entonación en cláusulas contrastivas con although / despite',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Examen de Transición B1 (4 h)',
        allocatedHours: 4,
        topics: [
          'Simulacro de prueba de entrada a nivel independiente',
          'Evaluación escrita con rúbrica CEFR B1',
          'Evaluación oral individual grabada y analizada',
        ],
      },
    ],
  },
  {
    moduleNumber: 9,
    cefrLevel: 'B1.1',
    title: 'Módulo 9 — B1.1: Comunicación independiente',
    purpose: 'Comunicación independiente y fluida en ámbitos personales, académicos y profesionales habituales',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Nivel B1 Autónomo (10 h)',
        allocatedHours: 10,
        topics: [
          'Dominio funcional y preciso de todo el sistema de tiempos verbales',
          'Tiempos perfectos combinados en contextos discursivos amplios',
          'Condicionales cero, primero y segundo; introducción al Third Conditional',
          'Voz pasiva con agentes y en registros formales',
          'Reported Speech con oraciones complejas y preguntas indirectas',
          'Relative clauses como herramienta de síntesis textual',
          'Modales para expresar diversos grados de certeza y obligación moral',
          'Phrasal verbs idiomáticos de uso profesional',
          'Gerundios e infinitivos en funciones sintácticas avanzadas',
          'Linking words de nivel B1 (moreover, on the other hand, in addition)',
          'Estructura de cláusulas subordinadas adverbiales complejas',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura Profesional y Textos Argumentativos (8 h)',
        allocatedHours: 8,
        topics: [
          'Ensayos de opinión formal con tesis, argumentos y contraargumentos',
          'Cartas formales de postulación o solicitud de becas/empleo',
          'Correos electrónicos profesionales para coordinar proyectos',
          'Artículos cortos para blogs o revistas estudiantiles',
          'Textos argumentativos presentando soluciones a dilemas contemporáneos',
          'Resumen de información proveniente de múltiples fuentes',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Conversación Espontánea y Debate Colaborativo (10 h)',
        allocatedHours: 10,
        topics: [
          'Conversación espontánea sobre temas conocidos sin preparación previa',
          'Presentaciones formales de 3 a 5 minutos apoyadas en esquema visual',
          'Descripción detallada de sueños, esperanzas y ambiciones futuras',
          'Explicación y defensa rigurosa de opiniones personales',
          'Resolución colaborativa de problemas en dinámicas de equipo',
          'Debates reglados respetando turnos de palabra e intervenciones críticas',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva de Podcasts y Medios Reales (8 h)',
        allocatedHours: 8,
        topics: [
          'Conversaciones auténticas a velocidad natural con acentos estándar',
          'Entrevistas en profundidad a expertos y profesionales',
          'Reportajes de noticias sobre temas de relevancia internacional',
          'Podcasts temáticos con debate entre varios participantes',
          'Identificación de matices afectivos, ironía y compromiso del emisor',
          'Seguimiento de líneas argumentales complejas con ejemplos',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Léxico B1, Modismos y Énfasis Oracional (5 h)',
        allocatedHours: 5,
        topics: [
          'Vocabulario de emociones, relaciones interpersonales y entorno laboral',
          'Idioms cotidianos de alta frecuencia en el Reino Unido y EE. UU.',
          'Acento enfático (contrastive stress) para corregir o matizar',
          'Pausas y grupos fónicos en discursos formales',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Evaluación Formativa B1.1 (4 h)',
        allocatedHours: 4,
        topics: [
          'Auditoría de errores fósiles y retroalimentación personalizada',
          'Examen de 4 competencias nivel B1.1',
        ],
      },
    ],
  },
  {
    moduleNumber: 10,
    cefrLevel: 'B1.2',
    title: 'Módulo 10 — B1.2: Consolidación de B1 y simulación de examen',
    purpose: 'Consolidación definitiva de B1, refinamiento de precisión y preparación para examen de certificación',
    estimatedHours: 45,
    units: [
      {
        skillArea: 'grammar',
        title: 'Gramática de Maestría y Precisión B1 (10 h)',
        allocatedHours: 10,
        topics: [
          'Revisión integral y contrastada de todos los tiempos verbales',
          'Aspectos perfectos y continuos en situaciones de alta precisión',
          'Condicionales mixtos e hipótesis en el presente y pasado',
          'Voz pasiva como herramienta de despersonalización en informes',
          'Reported Speech en discursos prolongados y resúmenes de reuniones',
          'Marcadores discursivos para estructurar textos largos (discourse markers)',
          'Collocations y phrasal verbs consolidados en registro formal e informal',
          'Identificación y corrección activa de errores gramaticales frecuentes',
          'Naturalidad léxica y eliminación del calco del español',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Escritura B1 Oficial: Ensayos, Informes y Reseñas (8 h)',
        allocatedHours: 8,
        topics: [
          'Ensayo B1 completo (140-180 palabras) con estructura académica',
          'Artículos de opinión y divulgación con gancho para el lector',
          'Cartas y correos formales con registro estilístico impecable',
          'Redacción de informes breves (reports) con recomendaciones accionables',
          'Reseñas críticas de eventos, libros o servicios',
          'Técnicas de resumen, paráfrasis y citación de ideas ajenas',
          'Control absoluto de la cohesión, puntuación y división en párrafos',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Producción Oral Autónoma y Simulación de Examen B1 (10 h)',
        allocatedHours: 10,
        topics: [
          'Conversación espontánea fluida con interlocutores de cualquier trasfondo',
          'Presentación formal de 4 a 5 minutos seguida de ronda de preguntas',
          'Debates complejos negociando soluciones a problemas comunitarios',
          'Especular sobre situaciones basadas en imágenes o datos incompletos',
          'Expresión de acuerdo, desacuerdo matizado y diplomacia comunicativa',
          'Simulación completa de examen oral B1 (Speaking test tipo B1 Preliminary / IELTS)',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Comprensión Auditiva de Variedad de Acentos y Detalles (8 h)',
        allocatedHours: 8,
        topics: [
          'Conversaciones naturales con variedad de acentos estándar (americano, británico, australiano)',
          'Conferencias, charlas y presentaciones académicas divulgativas',
          'Identificación de detalles específicos y datos numéricos en discursos extensos',
          'Realización de inferencias sobre hechos no explícitos en el audio',
          'Detección precisa del propósito comunicativo y la actitud del hablante',
          'Simulación de pruebas auditivas estandarizadas con preguntas de opción múltiple',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Estrategias de Comunicación y Variantes de Acento (5 h)',
        allocatedHours: 5,
        topics: [
          'Variedades de pronunciación entre inglés británico y americano (rhoticity, t-flapping)',
          'Estrategias de compensación léxica y paráfrasis cuando falta una palabra',
          'Entonación diplomática y cortesía en el entorno profesional',
        ],
      },
      {
        skillArea: 'review_exam',
        title: 'Examen de Certificación Final B1 (4 h)',
        allocatedHours: 4,
        topics: [
          'Simulacro oficial de examen B1 completo (Reading, Writing, Listening, Speaking)',
          'Evaluación con baremo oficial del MCER y reporte de calificación global',
        ],
      },
    ],
  },
]

async function main() {
  console.log('--- Iniciando Semilla del Currículo de Inglés (10 Módulos, 450 Horas) ---')

  const course = await prisma.course.upsert({
    where: { code: 'axiom_english_450h' },
    update: {
      title: 'Axiom English — MCER A1 a B1',
      totalHours: 450,
      targetCefr: 'B1.2',
      description:
        'Programa didáctico modular de 450 horas dividido en 10 módulos de 45 horas cada uno, desde A1.1 hasta la consolidación de B1.2, cubriendo Grammar, Writing, Speaking, Listening, Vocabulary/Pronunciation y Evaluación.',
    },
    create: {
      code: 'axiom_english_450h',
      title: 'Axiom English — MCER A1 a B1',
      totalHours: 450,
      targetCefr: 'B1.2',
      description:
        'Programa didáctico modular de 450 horas dividido en 10 módulos de 45 horas cada uno, desde A1.1 hasta la consolidación de B1.2, cubriendo Grammar, Writing, Speaking, Listening, Vocabulary/Pronunciation y Evaluación.',
    },
  })

  console.log(`Curso asegurado: ${course.title} (ID: ${course.id})`)

  let totalUnitsCount = 0
  let totalTopicsCount = 0

  for (const mod of MODULES_DATA) {
    const courseModule = await prisma.courseModule.upsert({
      where: {
        courseId_moduleNumber: {
          courseId: course.id,
          moduleNumber: mod.moduleNumber,
        },
      },
      update: {
        title: mod.title,
        cefrLevel: mod.cefrLevel,
        purpose: mod.purpose,
        estimatedHours: mod.estimatedHours,
        order: mod.moduleNumber,
      },
      create: {
        courseId: course.id,
        moduleNumber: mod.moduleNumber,
        title: mod.title,
        cefrLevel: mod.cefrLevel,
        purpose: mod.purpose,
        estimatedHours: mod.estimatedHours,
        order: mod.moduleNumber,
      },
    })

    console.log(`  [Módulo ${mod.moduleNumber}] ${mod.title} (${mod.cefrLevel})`)

    let unitOrder = 1
    for (const unitData of mod.units) {
      let unit = await prisma.moduleUnit.findFirst({
        where: {
          moduleId: courseModule.id,
          skillArea: unitData.skillArea,
        },
      })

      if (!unit) {
        unit = await prisma.moduleUnit.create({
          data: {
            moduleId: courseModule.id,
            title: unitData.title,
            skillArea: unitData.skillArea,
            allocatedHours: unitData.allocatedHours,
            order: unitOrder,
          },
        })
      } else {
        unit = await prisma.moduleUnit.update({
          where: { id: unit.id },
          data: {
            title: unitData.title,
            allocatedHours: unitData.allocatedHours,
            order: unitOrder,
          },
        })
      }

      totalUnitsCount++

      let topicOrder = 1
      for (const topicTitle of unitData.topics) {
        const existingTopic = await prisma.unitTopic.findFirst({
          where: {
            unitId: unit.id,
            title: topicTitle,
          },
        })

        if (!existingTopic) {
          await prisma.unitTopic.create({
            data: {
              unitId: unit.id,
              title: topicTitle,
              order: topicOrder,
            },
          })
        }
        totalTopicsCount++
        topicOrder++
      }

      unitOrder++
    }
  }

  console.log(`\n--- Semilla completada con éxito ---`)
  console.log(`Módulos cargados: ${MODULES_DATA.length}`)
  console.log(`Unidades pedagógicas: ${totalUnitsCount}`)
  console.log(`Temas específicos indexados: ${totalTopicsCount}`)
}

main()
  .catch((e) => {
    console.error('Error durante la semilla:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
