import { PrismaClient } from '@prisma/client'
import process from 'node:process'

const prisma = new PrismaClient()

const NAHUATL_MODULES_DATA = [
  {
    moduleNumber: 1,
    cefrLevel: 'Básico',
    title: 'Módulo 1 — Introducción al náhuatl y su abecedario',
    purpose: 'Identificar el abecedario náhuatl y sus sonidos básicos, reconociendo la importancia cultural de la lengua como parte de la diversidad lingüística de México.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'listening',
        title: 'Importancia de las lenguas maternas y diversidad lingüística (10 h)',
        allocatedHours: 10,
        topics: [
          'Panorama de las 68 agrupaciones lingüísticas de México',
          'La familia lingüística yuto-nahua y la presencia histórica del náhuatl',
          'Importancia cultural y derechos lingüísticos como patrimonio vivo',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Origen y presencia del náhuatl (10 h)',
        allocatedHours: 10,
        topics: [
          'Evolución histórica y variantes geográficas del náhuatl',
          'Presencia actual del náhuatl en el centro del país y Morelos',
          'El náhuatl en la toponimia y el español cotidiano de México',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Abecedario náhuatl (10 h)',
        allocatedHours: 10,
        topics: [
          'Las grafías del abecedario náhuatl (norma moderna y tradicional)',
          'Vocales simples (a, e, i, o) y consonantes fundamentales',
          'Los dígrafos característicos: tl, tz, ch, hu, cu',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Pronunciación básica y fonemas propios (10 h)',
        allocatedHours: 10,
        topics: [
          'Articulación de la africada lateral tl /t͡ɬ/',
          'La africada alveolar tz /t͡s/ y la fricativa postalveolar x /ʃ/',
          'El saltillo /ʔ/ (corte glotal) y acentuación en la penúltima sílaba',
        ],
      },
    ],
  },
  {
    moduleNumber: 2,
    cefrLevel: 'Básico',
    title: 'Módulo 2 — Saludos y expresiones cotidianas',
    purpose: 'Usar saludos y expresiones cotidianas en lengua náhuatl para establecer intercambios comunicativos básicos en contextos formales e informales.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'speaking',
        title: 'Saludos formales e informales en náhuatl (13 h)',
        allocatedHours: 13,
        topics: [
          'Saludos iniciales: Niltze, Cualli tonalli, Cualli yohualtzin',
          'Preguntas de saludo: ¿Quen tinemi? (¿Cómo estás?) - Cualli ninemi (Estoy bien)',
          'Fórmulas de despedida: Tlazohcamati, Timottazque (Nos vemos)',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Expresiones de cortesía (13 h)',
        allocatedHours: 13,
        topics: [
          'Agradecimiento y respuesta: Tlazohcamati huel miec / Amitla',
          'El uso del reverencial -tzin en saludos respetuosos',
          'Petición y disculpas en intercambios comunicativos breves',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Frases de uso cotidiano en lengua náhuatl (14 h)',
        allocatedHours: 14,
        topics: [
          'Afirmación y negación: Quema (Sí) / Ahmo (No)',
          'Expresiones para el aula y el trabajo: Tlein quinequi (¿Qué deseas?)',
          'Diálogos simulados de presentación e interacción diaria',
        ],
      },
    ],
  },
  {
    moduleNumber: 3,
    cefrLevel: 'Básico',
    title: 'Módulo 3 — Lectura y escritura de palabras compuestas',
    purpose: 'Leer y escribir palabras compuestas en lengua náhuatl mediante el reconocimiento de su estructura básica aglutinante.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'grammar',
        title: 'Estructura básica de las palabras en náhuatl (13 h)',
        allocatedHours: 13,
        topics: [
          'El concepto de lengua aglutinante y polisintética',
          'Sustantivos en forma absolutiva: sufijos -tl, -tli, -li, -in',
          'Identificación de la raíz léxica sustantival y verbal',
        ],
      },
      {
        skillArea: 'grammar',
        title: 'Formación de palabras compuestas (13 h)',
        allocatedHours: 13,
        topics: [
          'Unión de sustantivo + sustantivo (ej. atl + tepetl = altepetl, pueblo/ciudad)',
          'Unión de adjetivo + sustantivo (ej. cualli + tlacatl = cuallitlacatl, hombre bueno)',
          'Prefijos posesivos singulares: no- (mi), mo- (tu), i- (su)',
        ],
      },
      {
        skillArea: 'writing',
        title: 'Lectura y escritura guiada de palabras compuestas (14 h)',
        allocatedHours: 14,
        topics: [
          'Descomposición y análisis morfológico de términos comunes',
          'Lectura en voz alta de oraciones simples compuestas',
          'Redacción guiada de combinaciones léxicas cotidianas',
        ],
      },
    ],
  },
  {
    moduleNumber: 4,
    cefrLevel: 'Básico',
    title: 'Módulo 4 — Nombres y vocabulario básico',
    purpose: 'Emplear vocabulario básico en lengua náhuatl relacionado con personas, animales y objetos en oraciones simples.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'speaking',
        title: 'Nombres propios y formas de identificación (13 h)',
        allocatedHours: 13,
        topics: [
          'Presentación de la identidad: Notoca... (Me llamo...)',
          'Preguntar el nombre: ¿Tlein motoca? (¿Cuál es tu nombre?)',
          'Nombres tradicionales de personas y su significado simbólico',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Vocabulario de animales (Yolcameh) (13 h)',
        allocatedHours: 13,
        topics: [
          'Animales de la región: itzcuintli (perro), miston (gato), cuauhtli (águila)',
          'Animales del campo: tototl (ave), coatl (serpiente), mazatl (venado)',
          'Identificación auditiva y visual de fauna mesoamericana',
        ],
      },
      {
        skillArea: 'vocabulary_pronunciation',
        title: 'Vocabulario de objetos cotidianos (14 h)',
        allocatedHours: 14,
        topics: [
          'Objetos de la casa y comida: calli (casa), tlaxcalli (tortilla), chilli (chile), atl (agua)',
          'Herramientas y utensilios tradicionales del entorno comunitario',
          'Integración de sustantivos en oraciones simples de posesión y acción',
        ],
      },
    ],
  },
  {
    moduleNumber: 5,
    cefrLevel: 'Básico',
    title: 'Módulo 5 — Desarrollo social y educación bilingüe',
    purpose: 'Reconocer la importancia de la educación bilingüe y los derechos lingüísticos en el desarrollo social de las comunidades hablantes de náhuatl.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'listening',
        title: 'Lengua, identidad y comunidad (13 h)',
        allocatedHours: 13,
        topics: [
          'El papel de la lengua materna como cohesionador comunitario',
          'Identidad cultural y memoria histórica de los pueblos originarios',
          'La voz testimonial de hablantes y sabios comunitarios',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Educación bilingüe e intercultural (13 h)',
        allocatedHours: 13,
        topics: [
          'Principios y modelos de la educación intercultural en México',
          'La importancia de la revitalización de lenguas en educación superior',
          'Retos actuales de la enseñanza escolarizada del náhuatl',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Derechos lingüísticos y marco normativo (14 h)',
        allocatedHours: 14,
        topics: [
          'Ley General de Derechos Lingüísticos de los Pueblos Indígenas (LGDLPI)',
          'El derecho a la comunicación en lengua materna ante instituciones públicas',
          'Compromiso institucional del TecNM con la acreditación y titulación bilingüe',
        ],
      },
    ],
  },
  {
    moduleNumber: 6,
    cefrLevel: 'Intermedio',
    title: 'Módulo 6 — Introducción a la diversidad del náhuatl',
    purpose: 'Reconocer la diversidad y las variantes regionales de la lengua náhuatl, valorando su presencia en el contexto local y nacional.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'listening',
        title: 'Diversidad lingüística del náhuatl en México (13 h)',
        allocatedHours: 13,
        topics: [
          'Clasificación geográfica: variantes del centro, huasteca, occidente y sierra',
          'Diferencias léxicas y fonéticas entre las macro-variantes',
          'Reconocimiento auditivo de muestras de habla de distintas regiones',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Variantes regionales y contrastes fonológicos (13 h)',
        allocatedHours: 13,
        topics: [
          'Sustitución de tl por t o l en ciertas regiones periféricas',
          'Presencia o ausencia del saltillo según la variante regional',
          'Comparación de tablas léxicas entre variantes contemporáneas',
        ],
      },
      {
        skillArea: 'listening',
        title: 'El náhuatl en el estado de Morelos (14 h)',
        allocatedHours: 14,
        topics: [
          'Las comunidades nahuahablantes de Morelos: Tetelcingo, Hueyapan, Xoxocotla, Cuentepec',
          'Características sociolingüísticas del náhuatl de Morelos',
          'Vigencia y proyectos de revitalización en el entorno de Zacatepec',
        ],
      },
    ],
  },
  {
    moduleNumber: 7,
    cefrLevel: 'Intermedio',
    title: 'Módulo 7 — ¿Dónde y quiénes utilizan el náhuatl?',
    purpose: 'Identificar a los hablantes de la lengua náhuatl y los espacios donde se utiliza, comprendiendo su vigencia social y cultural.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'listening',
        title: 'Distribución geográfica del náhuatl en México (13 h)',
        allocatedHours: 13,
        topics: [
          'Análisis cartográfico de las regiones indígenas de mayor concentración',
          'Datos censales del INEGI y conteos de hablantes monolingües y bilingües',
          'Migración de comunidades hablantes hacia zonas urbanas e industriales',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Comunidades hablantes de náhuatl (13 h)',
        allocatedHours: 13,
        topics: [
          'Perfil demográfico de los hablantes: niños, jóvenes y ancianos (huehuetqueh)',
          'La familia y la asamblea como espacios de resistencia lingüística',
          'Exposición oral de investigaciones sobre comunidades específicas',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Uso social de la lengua náhuatl en distintos contextos (14 h)',
        allocatedHours: 14,
        topics: [
          'El náhuatl en el comercio tradicional (el tianguis) y el trabajo agrícola (la milpa)',
          'El náhuatl en celebraciones religiosas, fiestas patronales y mayordomías',
          'Espacios emergentes: redes sociales, música contemporánea y academia',
        ],
      },
    ],
  },
  {
    moduleNumber: 8,
    cefrLevel: 'Intermedio',
    title: 'Módulo 8 — La lengua náhuatl en su territorio y contexto cultural',
    purpose: 'Comprender la relación entre la lengua náhuatl, el territorio y el contexto cultural como elementos que influyen en la vida comunitaria.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'listening',
        title: 'Relación entre lengua y territorio (13 h)',
        allocatedHours: 13,
        topics: [
          'Toponimia nahua: el nombre del lugar como descripción geográfica y botánica',
          'El concepto de altepetl (agua-cerro) y la cosmovisión del territorio',
          'Vínculo sagrado entre la tierra y la palabra en las comunidades originarias',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Entorno natural y vida comunitaria (13 h)',
        allocatedHours: 13,
        topics: [
          'El ciclo agrícola de la milpa (toctli, cintli, tlaolli) y su vocabulario ceremonial',
          'Los elementos naturales: tonatiuh (sol), metztli (luna), quiyahuitl (lluvia), ehecatl (viento)',
          'Testimonios orales sobre el respeto a la naturaleza en la tradición nahua',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Transmisión cultural de la lengua náhuatl (14 h)',
        allocatedHours: 14,
        topics: [
          'La oralidad como vehículo principal de transmisión intergeneracional',
          'Los cuentos, mitos y consejos morales tradicionales (huehuetlatolli)',
          'Estrategias familiares y comunitarias para evitar el desplazamiento lingüístico',
        ],
      },
    ],
  },
  {
    moduleNumber: 9,
    cefrLevel: 'Intermedio',
    title: 'Módulo 9 — La vida comunitaria y las prácticas sociales en lengua náhuatl',
    purpose: 'Analizar la vida comunitaria y las prácticas sociales de los pueblos hablantes de náhuatl, reconociendo la lengua como medio de transmisión cultural.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'listening',
        title: 'Organización social comunitaria (10 h)',
        allocatedHours: 10,
        topics: [
          'El trabajo colectivo y solidario: el tequio o faena comunitaria',
          'Sistemas de cargos comunitarios y autoridades tradicionales',
          'Valores de reciprocidad y respeto a la autoridad moral de los ancianos',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Prácticas sociales y culturales (10 h)',
        allocatedHours: 10,
        topics: [
          'Rituales de petición de lluvia y bendición de semillas en Morelos',
          'Danzas tradicionales, música de huehuetl y cantos ceremoniales',
          'Vocabulario ceremonial y normas de respeto en actos colectivos',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Indumentaria tradicional (10 h)',
        allocatedHours: 10,
        topics: [
          'Prendas tradicionales: huipilli, quechquemitl, cacle, ceñidores',
          'Simbolismo del tejido, colores y figuras representadas en la indumentaria',
          'Descripción oral de trajes típicos de Morelos y regiones vecinas',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Conocimientos comunitarios sobre salud y medicina tradicional (10 h)',
        allocatedHours: 10,
        topics: [
          'Plantas medicinales de la región y sus nombres en náhuatl',
          'La figura del curandero tradicional (ticitl) y el temazcal',
          'Transmisión oral de saberes de salud y bienestar comunitario',
        ],
      },
    ],
  },
  {
    moduleNumber: 10,
    cefrLevel: 'Intermedio',
    title: 'Módulo 10 — Saberes culturales, usos de la lengua y cierre formativo',
    purpose: 'Integrar los conocimientos lingüísticos y culturales adquiridos durante el curso, valorando los saberes culturales y los usos de la lengua náhuatl como parte del proceso formativo y de titulación.',
    estimatedHours: 40,
    units: [
      {
        skillArea: 'listening',
        title: 'Saberes culturales y artesanías (13 h)',
        allocatedHours: 13,
        topics: [
          'Artesanías representativas: alfarería, cestería, papel amate y bordados',
          'Procesos artesanales y su terminología técnica en náhuatl',
          'Valor económico y cultural del trabajo artesanal en las comunidades',
        ],
      },
      {
        skillArea: 'listening',
        title: 'Usos sociales y culturales de la lengua náhuatl (13 h)',
        allocatedHours: 13,
        topics: [
          'El náhuatl como lengua viva en el siglo XXI',
          'Creación literaria contemporánea: poesía, cuento y música en náhuatl',
          'El náhuatl en medios digitales y difusión universitaria',
        ],
      },
      {
        skillArea: 'speaking',
        title: 'Integración de aprendizajes y proyecto cultural de titulación (14 h)',
        allocatedHours: 14,
        topics: [
          'Elaboración del proyecto cultural sobre presencia del náhuatl en la comunidad',
          'Integración del glosario básico de términos, frases cotidianas y palabras compuestas',
          'Presentación oral final de acreditación lingüística (evaluación de 400 horas)',
        ],
      },
    ],
  },
]

async function main() {
  console.log('--- Semilla del Currículo Oficial de Náhuatl (TecNM Zacatepec - 400 Horas) ---')

  const course = await prisma.course.upsert({
    where: { code: 'axiom_nahuatl_400h' },
    update: {
      title: 'Axiom Náhuatl — Lengua Materna (TecNM Zacatepec)',
      totalHours: 400,
      targetCefr: 'Intermedio B2',
      description:
        'Cursos de lengua materna náhuatl para la acreditación de una segunda lengua como requisito de titulación universitaria. Programa oficial de 400 horas en 10 módulos de 40 horas cada uno, impartido en coordinación con el Instituto Tecnológico de Zacatepec.',
    },
    create: {
      code: 'axiom_nahuatl_400h',
      title: 'Axiom Náhuatl — Lengua Materna (TecNM Zacatepec)',
      totalHours: 400,
      targetCefr: 'Intermedio B2',
      description:
        'Cursos de lengua materna náhuatl para la acreditación de una segunda lengua como requisito de titulación universitaria. Programa oficial de 400 horas en 10 módulos de 40 horas cada uno, impartido en coordinación con el Instituto Tecnológico de Zacatepec.',
    },
  })

  console.log(`Curso creado/actualizado: ${course.title} (ID: ${course.id})`)

  let totalUnits = 0
  let totalTopics = 0

  for (const mod of NAHUATL_MODULES_DATA) {
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

    console.log(`  [Módulo ${mod.moduleNumber}] ${mod.title} (${mod.estimatedHours} h)`)

    let unitOrder = 1
    for (const unitData of mod.units) {
      let unit = await prisma.moduleUnit.findFirst({
        where: {
          moduleId: courseModule.id,
          title: unitData.title,
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
            allocatedHours: unitData.allocatedHours,
            skillArea: unitData.skillArea,
            order: unitOrder,
          },
        })
      }

      totalUnits++

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
        totalTopics++
        topicOrder++
      }

      unitOrder++
    }
  }

  console.log(`\n--- Semilla de Náhuatl completada con éxito ---`)
  console.log(`Módulos cargados: ${NAHUATL_MODULES_DATA.length}`)
  console.log(`Unidades pedagógicas: ${totalUnits}`)
  console.log(`Temas didácticos indexados: ${totalTopics}`)
}

main()
  .catch((e) => {
    console.error('Error durante la semilla de Náhuatl:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
