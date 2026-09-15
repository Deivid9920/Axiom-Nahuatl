// AXIOM — Database seed

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth'
import { seedPlans } from '../src/lib/billing'
import { indexChunk } from '../src/lib/rag/vector-store'
import { logger } from '../src/lib/observability'

const db = new PrismaClient()

// Roles & Permissions
const ROLES_DATA = [
  { name: 'STUDENT', description: 'Default user role — access to learning modules only' },
  { name: 'ADMIN', description: 'Full system access' },
]

const PERMISSIONS_DATA = [
  // Module access
  { key: 'module.listening.use', description: 'Usar el módulo de escucha' },
  { key: 'module.pronunciation.use', description: 'Usar el módulo de pronunciación' },
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

// Knowledge base: Vida Cotidiana domain (náhuatl)
const NAH_DOMAIN = {
  code: 'vida_cotidiana',
  name: 'Vida Cotidiana',
  description: 'Náhuatl para la vida diaria: saludos, familia, casa, comida y naturaleza. Enfoque en pronunciación y escucha.',
  cefrDefault: 'A2',
}

const NAH_VOCAB: Array<{
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
  // Saludos y frases básicas
  { term: 'niltze', pos: 'interjección', phonetic: '/ˈnil.t͡se/', definitionEn: 'Pronunciación: NIL-tse. La z suena /s/.', definitionEs: 'Hola / saludo cordial.', cefrLevel: 'A1', difficultyScore: 0.1, examples: ['Niltze, nocniuh. (Hola, amigo.)'] },
  { term: 'tlazohcamati', pos: 'interjección', phonetic: '/t͡ɬa.soʔ.ˈka.ma.ti/', definitionEn: 'Pronunciación: tla-so(h)-KA-ma-ti. Inicia con tl /t͡ɬ/ y lleva saltillo tras la o.', definitionEs: 'Gracias.', cefrLevel: 'A1', difficultyScore: 0.4, examples: ['Tlazohcamati, nocniuh. (Gracias, amigo.)'] },
  { term: 'quema', pos: 'adverbio', phonetic: '/ˈke.ma/', definitionEn: 'Pronunciación: KE-ma. La qu suena /k/.', definitionEs: 'Sí.', cefrLevel: 'A1', difficultyScore: 0.1 },
  { term: 'ahmo', pos: 'adverbio', phonetic: '/ˈaʔ.mo/', definitionEn: 'Pronunciación: A(h)-mo, con saltillo (corte glotal) tras la a.', definitionEs: 'No.', cefrLevel: 'A1', difficultyScore: 0.2 },
  { term: 'cualli', pos: 'adjetivo', phonetic: '/ˈkʷal.li/', definitionEn: 'Pronunciación: KWAL-li. La cu suena /kʷ/ y la ll es una l larga (no /ʝ/).', definitionEs: 'Bueno / bien.', cefrLevel: 'A1', difficultyScore: 0.3, examples: ['Cualli tonalli. (Buen día.)'] },
  { term: 'nocniuh', pos: 'sustantivo', phonetic: '/ˈnok.niw/', definitionEn: 'Pronunciación: NOK-niw. La uh final suena /w/.', definitionEs: 'Mi amigo / mi amiga.', cefrLevel: 'A1', difficultyScore: 0.4 },
  // Naturaleza
  { term: 'atl', pos: 'sustantivo', phonetic: '/aːt͡ɬ/', definitionEn: 'Pronunciación: atl en UNA sílaba; la tl final es africada lateral /t͡ɬ/, no "atel".', definitionEs: 'Agua.', cefrLevel: 'A1', difficultyScore: 0.3, examples: ['Nicnequi atl. (Quiero agua.)'] },
  { term: 'tlalli', pos: 'sustantivo', phonetic: '/ˈt͡ɬal.li/', definitionEn: 'Pronunciación: TLAL-li. Inicia con tl /t͡ɬ/ y la ll es l larga.', definitionEs: 'Tierra.', cefrLevel: 'A1', difficultyScore: 0.3 },
  { term: 'tonatiuh', pos: 'sustantivo', phonetic: '/to.ˈna.tiw/', definitionEn: 'Pronunciación: to-NA-tiw. La uh final suena /w/.', definitionEs: 'Sol.', cefrLevel: 'A1', difficultyScore: 0.3, examples: ['In tonatiuh tona. (El sol brilla.)'] },
  { term: 'metztli', pos: 'sustantivo', phonetic: '/ˈmet͡s.t͡ɬi/', definitionEn: 'Pronunciación: METS-tli. La tz suena /t͡s/ y la tl /t͡ɬ/.', definitionEs: 'Luna; también mes.', cefrLevel: 'A2', difficultyScore: 0.5 },
  { term: 'citlalin', pos: 'sustantivo', phonetic: '/si.ˈt͡ɬa.lin/', definitionEn: 'Pronunciación: si-TLA-lin. La c ante i suena /s/.', definitionEs: 'Estrella.', cefrLevel: 'A2', difficultyScore: 0.4 },
  { term: 'xochitl', pos: 'sustantivo', phonetic: '/ˈʃoː.t͡ʃit͡ɬ/', definitionEn: 'Pronunciación: SHO-chitl. La x suena /ʃ/ (como "sh"), NUNCA /ks/ ni /x/.', definitionEs: 'Flor.', cefrLevel: 'A1', difficultyScore: 0.4, examples: ['In xochitl cueponi. (La flor florece.)'] },
  { term: 'mixtli', pos: 'sustantivo', phonetic: '/ˈmiʃ.t͡ɬi/', definitionEn: 'Pronunciación: MISH-tli. La x suena /ʃ/.', definitionEs: 'Nube.', cefrLevel: 'A2', difficultyScore: 0.4 },
  { term: 'quiyahuitl', pos: 'sustantivo', phonetic: '/ki.ˈja.wit͡ɬ/', definitionEn: 'Pronunciación: ki-YA-witl. La hu suena /w/.', definitionEs: 'Lluvia.', cefrLevel: 'A2', difficultyScore: 0.5 },
  { term: 'ehecatl', pos: 'sustantivo', phonetic: '/e.ˈʔe.kat͡ɬ/', definitionEn: 'Pronunciación: e-(h)E-katl, con saltillo entre las e.', definitionEs: 'Viento.', cefrLevel: 'A2', difficultyScore: 0.5 },
  { term: 'tletl', pos: 'sustantivo', phonetic: '/t͡ɬet͡ɬ/', definitionEn: 'Pronunciación: tletl en UNA sílaba, con tl /t͡ɬ/ al inicio y al final.', definitionEs: 'Fuego.', cefrLevel: 'A2', difficultyScore: 0.6 },
  { term: 'tepetl', pos: 'sustantivo', phonetic: '/ˈte.pet͡ɬ/', definitionEn: 'Pronunciación: TE-petl. Acento en la penúltima sílaba.', definitionEs: 'Cerro / montaña.', cefrLevel: 'A1', difficultyScore: 0.3 },
  { term: 'cuauhtli', pos: 'sustantivo', phonetic: '/ˈkʷaw.t͡ɬi/', definitionEn: 'Pronunciación: KWAW-tli. La cu suena /kʷ/ y la uh /w/.', definitionEs: 'Águila.', cefrLevel: 'A2', difficultyScore: 0.6 },
  { term: 'coatl', pos: 'sustantivo', phonetic: '/ˈko.aːt͡ɬ/', definitionEn: 'Pronunciación: KO-atl. Dos vocales separadas, tl final /t͡ɬ/.', definitionEs: 'Serpiente.', cefrLevel: 'A2', difficultyScore: 0.4 },
  { term: 'itzcuintli', pos: 'sustantivo', phonetic: '/it͡s.ˈkʷin.t͡ɬi/', definitionEn: 'Pronunciación: its-KWIN-tli. La tz /t͡s/, la cu /kʷ/.', definitionEs: 'Perro.', cefrLevel: 'A2', difficultyScore: 0.6 },
  // Casa, familia y comida
  { term: 'calli', pos: 'sustantivo', phonetic: '/ˈkal.li/', definitionEn: 'Pronunciación: KAL-li. La ll es l larga (cal-li), NO /ʝ/ como en español.', definitionEs: 'Casa.', cefrLevel: 'A1', difficultyScore: 0.2, examples: ['Inin nocal. (Esta es mi casa.)'] },
  { term: 'nantli', pos: 'sustantivo', phonetic: '/ˈnan.t͡ɬi/', definitionEn: 'Pronunciación: NAN-tli. Con posesivo: nonan (mi madre).', definitionEs: 'Madre.', cefrLevel: 'A1', difficultyScore: 0.3 },
  { term: 'tahtli', pos: 'sustantivo', phonetic: '/ˈtaʔ.t͡ɬi/', definitionEn: 'Pronunciación: TA(h)-tli, con saltillo tras la a. Con posesivo: nota (mi padre).', definitionEs: 'Padre.', cefrLevel: 'A1', difficultyScore: 0.4 },
  { term: 'cihuatl', pos: 'sustantivo', phonetic: '/ˈsi.waːt͡ɬ/', definitionEn: 'Pronunciación: SI-watl. La c ante i suena /s/, la hu /w/.', definitionEs: 'Mujer.', cefrLevel: 'A1', difficultyScore: 0.4 },
  { term: 'tlacatl', pos: 'sustantivo', phonetic: '/ˈt͡ɬa.kat͡ɬ/', definitionEn: 'Pronunciación: TLA-katl. Doble tl: al inicio y al final.', definitionEs: 'Persona / hombre.', cefrLevel: 'A1', difficultyScore: 0.4 },
  { term: 'conetl', pos: 'sustantivo', phonetic: '/ˈko.net͡ɬ/', definitionEn: 'Pronunciación: KO-netl.', definitionEs: 'Niño / niña.', cefrLevel: 'A1', difficultyScore: 0.3 },
  { term: 'tlaxcalli', pos: 'sustantivo', phonetic: '/t͡ɬaʃ.ˈkal.li/', definitionEn: 'Pronunciación: tlash-KAL-li. La x suena /ʃ/ ("sh").', definitionEs: 'Tortilla.', cefrLevel: 'A1', difficultyScore: 0.5, examples: ['Nicnequi tlaxcalli. (Quiero tortillas.)'] },
  { term: 'etl', pos: 'sustantivo', phonetic: '/et͡ɬ/', definitionEn: 'Pronunciación: etl en una sola sílaba.', definitionEs: 'Frijol.', cefrLevel: 'A1', difficultyScore: 0.3 },
  { term: 'chilli', pos: 'sustantivo', phonetic: '/ˈt͡ʃiːl.li/', definitionEn: 'Pronunciación: CHIL-li, con l larga. Origen de la palabra "chile".', definitionEs: 'Chile.', cefrLevel: 'A1', difficultyScore: 0.2 },
  { term: 'elotl', pos: 'sustantivo', phonetic: '/ˈe.loːt͡ɬ/', definitionEn: 'Pronunciación: E-lotl. Origen de la palabra "elote".', definitionEs: 'Elote / maíz tierno.', cefrLevel: 'A1', difficultyScore: 0.2 },
  // Cuerpo, comunidad y lengua
  { term: 'yollotl', pos: 'sustantivo', phonetic: '/ˈjoːl.loːt͡ɬ/', definitionEn: 'Pronunciación: YOL-lotl, con l larga.', definitionEs: 'Corazón.', cefrLevel: 'A2', difficultyScore: 0.4 },
  { term: 'altepetl', pos: 'sustantivo', phonetic: '/aːl.ˈte.pet͡ɬ/', definitionEn: 'Pronunciación: al-TE-petl. Literalmente "agua-cerro": pueblo.', definitionEs: 'Pueblo / ciudad.', cefrLevel: 'B1', difficultyScore: 0.5 },
  { term: 'tianquiztli', pos: 'sustantivo', phonetic: '/ti.aːn.ˈkis.t͡ɬi/', definitionEn: 'Pronunciación: ti-an-KIS-tli. Origen de la palabra "tianguis".', definitionEs: 'Mercado.', cefrLevel: 'B1', difficultyScore: 0.6 },
  { term: 'tlahtolli', pos: 'sustantivo', phonetic: '/t͡ɬaʔ.ˈtoːl.li/', definitionEn: 'Pronunciación: tla(h)-TOL-li, con saltillo tras la primera a.', definitionEs: 'Palabra / lengua / discurso.', cefrLevel: 'B1', difficultyScore: 0.6 },
  { term: 'cuicatl', pos: 'sustantivo', phonetic: '/ˈkʷiː.kat͡ɬ/', definitionEn: 'Pronunciación: KWI-katl. La cu suena /kʷ/.', definitionEs: 'Canto / canción.', cefrLevel: 'B1', difficultyScore: 0.5 },
  { term: 'amoxtli', pos: 'sustantivo', phonetic: '/a.ˈmoʃ.t͡ɬi/', definitionEn: 'Pronunciación: a-MOSH-tli. La x suena /ʃ/.', definitionEs: 'Libro / códice.', cefrLevel: 'B1', difficultyScore: 0.5 },
  { term: 'huehuetl', pos: 'sustantivo', phonetic: '/ˈwe.wet͡ɬ/', definitionEn: 'Pronunciación: WE-wetl. La hu suena /w/, nunca "ju".', definitionEs: 'Tambor tradicional.', cefrLevel: 'B1', difficultyScore: 0.6 },
  // Tiempo
  { term: 'axcan', pos: 'adverbio', phonetic: '/ˈaʃ.kaːn/', definitionEn: 'Pronunciación: ASH-kan. La x suena /ʃ/.', definitionEs: 'Hoy / ahora.', cefrLevel: 'A2', difficultyScore: 0.4 },
  { term: 'moztla', pos: 'adverbio', phonetic: '/ˈmos.t͡ɬa/', definitionEn: 'Pronunciación: MOS-tla. La z suena /s/.', definitionEs: 'Mañana.', cefrLevel: 'A2', difficultyScore: 0.4 },
  { term: 'yalhua', pos: 'adverbio', phonetic: '/ˈjal.wa/', definitionEn: 'Pronunciación: YAL-wa. La hu suena /w/.', definitionEs: 'Ayer.', cefrLevel: 'A2', difficultyScore: 0.4 },
  { term: 'tonalli', pos: 'sustantivo', phonetic: '/toː.ˈnal.li/', definitionEn: 'Pronunciación: to-NAL-li, con l larga.', definitionEs: 'Día / calor del sol / destino.', cefrLevel: 'A2', difficultyScore: 0.4, examples: ['Cualli tonalli. (Buen día.)'] },
]

const NAH_GRAMMAR: Array<{
  name: string
  cefrLevel: string
  statement: string
  examples: { correct: string; incorrect: string; explanation: string }[]
}> = [
  {
    name: 'El sonido tl /t͡ɬ/ (africada lateral)',
    cefrLevel: 'A1',
    statement: 'El dígrafo tl representa UN solo sonido /t͡ɬ/: la lengua toca los dientes como para "t" y el aire sale por los lados como en "l". Nunca se pronuncia "tel" ni se separa en dos sílabas.',
    examples: [
      { correct: 'náhuatl → NA-watl (una sílaba final)', incorrect: 'NA-wa-tel', explanation: 'La tl final forma parte de la última sílaba; no se agrega una e.' },
      { correct: 'atl → /aːt͡ɬ/ (una sílaba)', incorrect: 'a-tel', explanation: 'Palabra de una sola sílaba: vocal + tl.' },
    ],
  },
  {
    name: 'La x se pronuncia /ʃ/ (como "sh")',
    cefrLevel: 'A1',
    statement: 'En náhuatl la letra x SIEMPRE suena /ʃ/, como "sh" en inglés. Nunca /ks/ (taxi) ni /x/ (México en español moderno).',
    examples: [
      { correct: 'xochitl → SHO-chitl', incorrect: 'KSO-chitl o JO-chitl', explanation: 'La x náhuatl conserva el sonido /ʃ/ del español del siglo XVI.' },
      { correct: 'mixtli → MISH-tli', incorrect: 'MIKS-tli', explanation: 'Mismo principio en posición media.' },
    ],
  },
  {
    name: 'Hu + vocal = /w/',
    cefrLevel: 'A1',
    statement: 'La secuencia hu antes de vocal (hua, hue, hui) representa el sonido /w/, como la w inglesa. Al final de sílaba se escribe uh y también suena /w/.',
    examples: [
      { correct: 'huehuetl → WE-wetl', incorrect: 'ju-e-ju-etl o u-e-u-etl', explanation: 'La h no suena como j; hu es una sola consonante /w/.' },
      { correct: 'tonatiuh → to-NA-tiw', incorrect: 'to-na-ti-U', explanation: 'La uh final cierra la sílaba con /w/.' },
    ],
  },
  {
    name: 'El saltillo (corte glotal)',
    cefrLevel: 'A2',
    statement: 'El saltillo /ʔ/ es un corte breve de la voz (como en "uh-oh" del inglés). Se escribe con h en la ortografía tradicional. Distingue palabras: su omisión cambia el significado.',
    examples: [
      { correct: 'tahtli → TA(ʔ)-tli, con corte tras la a', incorrect: 'TA-tli sin corte', explanation: 'El saltillo es un fonema, no un adorno: omitirlo es como omitir una consonante.' },
      { correct: 'ahmo → A(ʔ)-mo', incorrect: 'AMO corrido', explanation: 'El corte glotal separa las dos vocales.' },
    ],
  },
  {
    name: 'Acento siempre en la penúltima sílaba',
    cefrLevel: 'A1',
    statement: 'Casi todas las palabras del náhuatl se acentúan en la penúltima sílaba (son llanas/graves). No hay palabras agudas nativas, salvo vocativos.',
    examples: [
      { correct: 'tlazohcamati → tla-so-ka-MA-ti', incorrect: 'tla-so-ka-ma-TI', explanation: 'El acento cae en MA, la penúltima sílaba.' },
      { correct: 'citlalin → si-TLA-lin', incorrect: 'SI-tla-lin', explanation: 'Penúltima sílaba: TLA.' },
    ],
  },
  {
    name: 'Cu = /kʷ/ (k labializada)',
    cefrLevel: 'A2',
    statement: 'La secuencia cu antes de vocal representa /kʷ/: una k pronunciada con los labios redondeados, en un solo golpe de voz. Al final de sílaba se escribe uc.',
    examples: [
      { correct: 'cuauhtli → KWAW-tli', incorrect: 'ku-a-u-tli (4 sílabas)', explanation: 'cu es una sola consonante /kʷ/; la palabra tiene solo dos sílabas.' },
      { correct: 'cualli → KWAL-li', incorrect: 'ku-A-li', explanation: 'Mismo principio: /kʷ/ + al + li.' },
    ],
  },
  {
    name: 'Vocales largas y cortas',
    cefrLevel: 'B1',
    statement: 'El náhuatl distingue vocales largas (ā, ē, ī, ō) y cortas. La duración puede cambiar el significado. En la escritura tradicional no siempre se marca, pero al escuchar se percibe.',
    examples: [
      { correct: 'tōtōtl (pájaro) con o largas', incorrect: 'totootl exagerado o totl cortado', explanation: 'La vocal larga dura aproximadamente el doble, sin cambiar su calidad.' },
      { correct: 'metztli con e corta', incorrect: 'meeetztli alargado', explanation: 'No alargues vocales que son cortas.' },
    ],
  },
]

// Common pitfalls for Spanish speakers learning náhuatl
const NAH_PITFALLS: Array<{
  type: string
  description: string
  correctForm: string
  incorrectForm: string
  explanation: string
}> = [
  {
    type: 'pronunciation',
    description: 'Pronunciar la x como /ks/ o /x/ (jota)',
    correctForm: 'xochitl → SHO-chitl /ʃ/',
    incorrectForm: 'KSO-chitl o JO-chitl',
    explanation: 'La x náhuatl siempre suena /ʃ/ ("sh"). El hábito del español moderno (taxi, México) lleva a pronunciarla mal.',
  },
  {
    type: 'pronunciation',
    description: 'Convertir la tl final en "tel" o "te"',
    correctForm: 'náhuatl → NA-watl',
    incorrectForm: 'NA-wa-tel / NA-wa-te',
    explanation: 'La tl es UNA consonante africada lateral /t͡ɬ/. Agregarle una vocal extra rompe la sílaba.',
  },
  {
    type: 'pronunciation',
    description: 'Pronunciar hu como "ju" o como vocal separada',
    correctForm: 'huehuetl → WE-wetl /w/',
    incorrectForm: 'jue-jue-tl o u-e-u-etl',
    explanation: 'La secuencia hu ante vocal es la consonante /w/. La h no es jota ni muda-separadora.',
  },
  {
    type: 'pronunciation',
    description: 'Omitir el saltillo (corte glotal)',
    correctForm: 'tahtli → TA(ʔ)-tli',
    incorrectForm: 'TA-tli corrido',
    explanation: 'El saltillo es un fonema del náhuatl. Omitirlo puede cambiar el significado de la palabra.',
  },
  {
    type: 'pronunciation',
    description: 'Pronunciar ll como /ʝ/ (ye) en lugar de l larga',
    correctForm: 'calli → KAL-li (l doble)',
    incorrectForm: 'KA-yi',
    explanation: 'En náhuatl ll son dos eles: una cierra sílaba y la otra la abre. No es la "ll" del español.',
  },
  {
    type: 'grammar',
    description: 'Traducir palabra por palabra ignorando la aglutinación',
    correctForm: 'nocal (mi casa, una palabra)',
    incorrectForm: 'no calli (dos palabras)',
    explanation: 'El náhuatl es aglutinante: los posesivos se pegan a la raíz y la palabra puede cambiar (calli → nocal).',
  },
  {
    type: 'grammar',
    description: 'Acentuar la última sílaba como en préstamos españoles',
    correctForm: 'ci-TLA-lin (llana)',
    incorrectForm: 'ci-tla-LIN (aguda)',
    explanation: 'El náhuatl acentúa la penúltima sílaba. Los préstamos al español (como "citlalín") a veces desplazan el acento — no lo imites.',
  },
  {
    type: 'register',
    description: 'Ignorar el reverencial -tzin',
    correctForm: 'tonantzin (nuestra venerada madre)',
    incorrectForm: 'tonan a secas en contexto ceremonial',
    explanation: 'El sufijo -tzin expresa respeto o cariño. En contextos formales o ceremoniales, omitirlo suena brusco.',
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
          cefrInitial: 'A2',
          cefrCurrent: 'A2',
          theta: -2.0,
          thetaSE: 0.5,
          professionalDomain: 'vida_cotidiana',
          jobRole: null,
          learningLanguage: 'nah',
          learningGoals: JSON.stringify(['Pronunciar correctamente los sonidos del náhuatl', 'Comprender conversaciones cotidianas de oído']),
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

  // 5. Knowledge base — vida_cotidiana (náhuatl) domain
  const domain = await db.domainContent.upsert({
    where: { code: NAH_DOMAIN.code },
    create: NAH_DOMAIN,
    update: { name: NAH_DOMAIN.name, description: NAH_DOMAIN.description },
  })

  // Vocab
  let vocabCount = 0
  for (const v of NAH_VOCAB) {
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
      content: `${v.term}: ${v.definitionEs} ${v.definitionEn}. Ejemplos: ${(v.examples || []).join(' ')}`,
      domain: 'vida_cotidiana',
      cefrLevel: v.cefrLevel,
      source: 'vocabulary',
      sourceId: entry.id,
      ownerId: null,  // base curada: global (AX-01)
      difficultyScore: v.difficultyScore,
    })
    vocabCount++
  }
  logger.info('seed.vocab_done', { count: vocabCount })

  // Grammar
  let grammarCount = 0
  for (const g of NAH_GRAMMAR) {
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
      content: `${g.name}: ${g.statement} Ejemplos: ${JSON.stringify(g.examples)}`,
      domain: 'vida_cotidiana',
      cefrLevel: g.cefrLevel,
      source: 'grammar_rule',
      sourceId: rule.id,
      ownerId: null,  // base curada: global (AX-01)
      difficultyScore: 0.5,
    })
    grammarCount++
  }
  logger.info('seed.grammar_done', { count: grammarCount })

  // Pitfalls
  let pitfallCount = 0
  for (const p of NAH_PITFALLS) {
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

  // 9. Seed curriculum topics
  await seedCurriculumTopics()

  console.log('\nSeed complete!')
  console.log('   Demo user: admin@axiom.mx / axiom12345')
  console.log('   Plans: 4 seeded (basico, pro, equipo, enterprise)')
  console.log('   Knowledge base: náhuatl — dominio vida_cotidiana')
  console.log('   Corpus de lectura en voz alta y currículo')
}

// Reading texts (pre-saved in DB)
async function seedReadingTexts() {
  const texts = [
    {
      title: 'Los sonidos del náhuatl (ejercicio de dicción)',
      content: 'Atl, tletl, xochitl, nahuatl. Calli, tlalli, tlaxcalli. Huehuetl, cuauhtli, coatl. Metztli, citlalin, tonatiuh. Cualli, tlacatl, cihuatl. Tlazohcamati.',
      cefrLevel: 'A1',
      domain: 'vida_cotidiana',
      topic: 'sonidos',
      estimatedReadingTimeSec: 30,
    },
    {
      title: 'Saludos básicos',
      content: 'Niltze, nocniuh. ¿Quen tinemi? Cualli ninemi, tlazohcamati. ¿Tlein motoca? Notoca Citlalli. Cualli tonalli, nocniuh.',
      cefrLevel: 'A1',
      domain: 'vida_cotidiana',
      topic: 'saludos',
      estimatedReadingTimeSec: 25,
    },
    {
      title: 'Mi casa y mi familia',
      content: 'Inin nocal. Ipan nocal nemi nonan ihuan nota. Nonan itoca Xochitl. Nota itoca Cuauhtemoc. Nehuatl nipaqui ipan nocal.',
      cefrLevel: 'A2',
      domain: 'familia_comunidad',
      topic: 'familia',
      estimatedReadingTimeSec: 25,
    },
    {
      title: 'La naturaleza',
      content: 'In tonatiuh, in metztli ihuan in citlalin cate ilhuicac. In xochitl onca ipan tlalli. In atl temo itech tepetl. In ehecatl ihuan in mixtli. Nehuatl nicnequi in quiyahuitl.',
      cefrLevel: 'A2',
      domain: 'naturaleza',
      topic: 'naturaleza',
      estimatedReadingTimeSec: 35,
    },
    {
      title: 'El mercado (tianquiztli)',
      content: 'Ipan tianquiztli onca miec tlamantli: tlaxcalli, etl, chilli ihuan elotl. In cihuatl quinamaca xochitl. In tlacatl quicohua tlaxcalli. Nehuatl nicnequi elotl ihuan chilli.',
      cefrLevel: 'B1',
      domain: 'comercio',
      topic: 'mercado',
      estimatedReadingTimeSec: 35,
    },
    {
      title: 'El corazón y la palabra',
      content: 'In yollotl ihuan in tlahtolli. In cuicatl quiza itech yollotl. In tlahtolli nemi ipan altepetl. In huehuetl tlatzotzona. Ma ticpiacan in tlahtolli.',
      cefrLevel: 'B1',
      domain: 'tradiciones',
      topic: 'cultura',
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

// Curriculum topics (for dashboard cards)
async function seedCurriculumTopics() {
  // Azul: escucha; azul marino: pronunciación
  const LISTEN = '#B5D4F4'
  const SPEAK = '#0B1F3A'

  const topics = [
    // A2 · Escucha
    { title: 'Escucha: los sonidos del náhuatl', description: 'Reconoce de oído tl, tz, ch, x y el saltillo antes de intentar producirlos', skill: 'listening', cefrLevel: 'A2', module: 'listening', icon: 'hearing', color: LISTEN, order: 1 },
    { title: 'Escucha: palabras básicas', description: 'Identifica palabras sueltas con voz natural: atl, calli, tlacatl', skill: 'listening', cefrLevel: 'A2', module: 'listening', icon: 'graphic_eq', color: LISTEN, order: 2 },
    { title: 'Escucha: la familia y la casa', description: 'Comprende de oído frases sobre nantli, tahtli y calli', skill: 'listening', cefrLevel: 'A2', module: 'listening', icon: 'family_home', color: LISTEN, order: 3 },

    // A2 · Pronunciación
    { title: 'Los sonidos tl y x', description: 'Domina la africada lateral tl /t͡ɬ/ y la x /ʃ/ leyendo en voz alta', skill: 'speaking', cefrLevel: 'A2', module: 'pronunciation', icon: 'record_voice_over', color: SPEAK, order: 1 },
    { title: 'El saltillo y las vocales largas', description: 'Practica el corte glotal (h) y la duración de las vocales', skill: 'speaking', cefrLevel: 'A2', module: 'pronunciation', icon: 'mic', color: SPEAK, order: 2 },
    { title: 'Saludos en voz alta', description: 'Pronuncia niltze, notoca y quen tinemi con el acento en la penúltima sílaba', skill: 'speaking', cefrLevel: 'A2', module: 'pronunciation', icon: 'waving_hand', color: SPEAK, order: 3 },

    // B1 · Escucha
    { title: 'Escucha: el mercado (tianquiztli)', description: 'Comprende de oído frases de compra y venta a velocidad natural', skill: 'listening', cefrLevel: 'B1', module: 'listening', icon: 'storefront', color: LISTEN, order: 1 },
    { title: 'Dictado: frases cotidianas', description: 'Transcribe lo que escuchas y descubre qué sonidos confundes', skill: 'listening', cefrLevel: 'B1', module: 'listening', icon: 'edit_note', color: LISTEN, order: 2 },
    { title: 'Escucha: cantos y palabra florida', description: 'Escucha cuicatl y reconoce el vocabulario ceremonial', skill: 'listening', cefrLevel: 'B1', module: 'listening', icon: 'music_note', color: LISTEN, order: 3 },

    // B1 · Pronunciación
    { title: 'Lectura en voz alta: relatos breves', description: 'Lee textos culturales completos cuidando ritmo y acento llano', skill: 'speaking', cefrLevel: 'B1', module: 'pronunciation', icon: 'auto_stories', color: SPEAK, order: 1 },
    { title: 'Palabras aglutinadas en voz alta', description: 'Pronuncia palabras largas sin romper el acento: nocal, tonantzin', skill: 'speaking', cefrLevel: 'B1', module: 'pronunciation', icon: 'join', color: SPEAK, order: 2 },

    // B2 · Avanzado
    { title: 'Escucha: discurso ceremonial', description: 'Comprende huehuetlahtolli (la palabra de los ancianos) de oído', skill: 'listening', cefrLevel: 'B2', module: 'listening', icon: 'temple_buddhist', color: LISTEN, order: 1 },
    { title: 'Pares mínimos a velocidad natural', description: 'Distingue tl/t y tz/s en habla corrida, sin pausas de apoyo', skill: 'listening', cefrLevel: 'B2', module: 'listening', icon: 'compare_arrows', color: LISTEN, order: 2 },
    { title: 'Dicción ceremonial', description: 'Lee huehuetlahtolli en voz alta con cadencia y pausas correctas', skill: 'speaking', cefrLevel: 'B2', module: 'pronunciation', icon: 'diversity_3', color: SPEAK, order: 1 },
  ]

  for (const t of topics) {
    const existing = await db.curriculumTopic.findFirst({ where: { title: t.title } })
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
