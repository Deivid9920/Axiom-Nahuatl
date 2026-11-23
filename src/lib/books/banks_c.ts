// Bancos de ejercicios originales — módulos 8 a 10 (A2+ transición a B1, B1.1, B1.2).
// Alcance didáctico según «Modulos ingles Axiom.pdf»; contenido original de Axiom.
import type { BankDef } from './types'

export const BANKS_C: BankDef[] = [
  // ===== MÓDULO 8 — A2+ Transición a B1 =====
  {
    moduleId: 8, lessonKey: 'm8-g1', block: 'grammar', title: 'Consolidación de tiempos', bookKey: 'murphy-english-2019', difficulty: 0.85,
    content: {
      mcq: [
        { q: 'I ___ for two hours and I need a break.', options: ['have been studying', 'study', 'studied', 'am studying'], answer: 0, hint: 'Present Perfect Continuous' },
        { q: 'By 2020, she ___ in five countries.', options: ['had lived', 'has lived', 'lived', 'was living'], answer: 0 },
        { q: 'He ___ to Japan next week; everything is booked.', options: ['is flying', 'will have flown', 'flies always', 'flew'], answer: 0, hint: 'Presente para futuro planificado' },
      ],
      gap: [
        { text: 'They ___ waiting since nine o\'clock. (presente perfecto continuo)', answer: 'have been' },
        { text: 'She ___ working here before the merger. (past perfect)', answer: 'had been' },
        { text: 'Look at the time! We ___ late. (will be)', answer: 'will be' },
      ],
      order: [
        { words: ['been', 'How', 'have', 'waiting', 'you', 'long'], answer: 'How long have you been waiting' },
        { words: ['had', 'The', 'closed', 'shop', 'already'], answer: 'The shop had already closed' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-g2', block: 'grammar', title: 'Second Conditional y pasiva', bookKey: 'eastwood-opg-2019', difficulty: 0.85,
    content: {
      mcq: [
        { q: 'If I ___ you, I would take the job.', options: ['were', 'am', 'will be', 'had been'], answer: 0 },
        { q: 'The invoices ___ sent every Monday.', options: ['are', 'is', 'was', 'has'], answer: 0 },
        { q: 'He ___ be at home; his car is outside.', options: ['must', 'can\'t', 'shouldn\'t', 'may not to'], answer: 0, hint: 'Deducción' },
      ],
      gap: [
        { text: 'If we had a garden, we ___ grow vegetables. (would)', answer: 'would' },
        { text: 'The bridge ___ being repaired at the moment.', answer: 'is' },
        { text: 'She can\'t be Italian; she ___ be Portuguese. (deducción)', answer: 'must' },
      ],
      order: [
        { words: ['would', 'they', 'If', 'asked,', 'help', 'we'], answer: 'If they asked, we would help' },
        { words: ['been', 'The', 'has', 'fixed', 'bug'], answer: 'The bug has been fixed' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-g3', block: 'grammar', title: 'Purpose, reason y contrast', bookKey: 'cobuild-grammar-2017', difficulty: 0.9,
    content: {
      mcq: [
        { q: 'She saved money ___ she could travel.', options: ['so that', 'despite', 'because of', 'although'], answer: 0 },
        { q: '___ the rain, the concert continued.', options: ['Despite', 'Although', 'However', 'Because'], answer: 0, hint: 'Despite + sustantivo' },
        { q: 'He took a coat ___ it was cold.', options: ['because', 'so that', 'in spite of', 'despite'], answer: 0 },
      ],
      gap: [
        { text: 'I left early ___ order to avoid traffic. (in)', answer: 'in' },
        { text: '___ he was sick, he came to work.', answer: 'Although' },
        { text: 'They moved here ___ the schools. (razón: por)', answer: 'because of' },
      ],
      order: [
        { words: ['so', 'We', 'that', 'left', 'catch', 'early', 'we', 'could', 'the', 'train'], answer: 'We left early so that we could catch the train' },
        { words: ['of', 'Despite', 'worked', 'the', 'she', 'noise,'], answer: 'Despite the noise, she worked' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-v1', block: 'vocab', title: 'Phrasal verbs y colocaciones', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.85,
    content: {
      pairs: [
        { es: 'establecer (una empresa)', en: 'to set up' },
        { es: 'posponer', en: 'to put off' },
        { es: 'asumir (un reto)', en: 'to take on' },
        { es: 'tomar una decisión', en: 'to make a decision' },
        { es: 'hacer un esfuerzo', en: 'to make an effort' },
        { es: 'echar una mano', en: 'to give a hand' },
      ],
      mcq: [
        { q: 'The meeting was ___ off until Friday.', options: ['put', 'taken', 'set', 'given'], answer: 0 },
        { q: 'Choose the correct collocation:', options: ['take a risk', 'make a risk', 'do a risk', 'put a risk'], answer: 0 },
        { q: 'Can you give me a ___ with these boxes?', options: ['hand', 'foot', 'arm', 'head'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-v2', block: 'vocab', title: 'Cohesión entre párrafos', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.9,
    content: {
      mcq: [
        { q: '___ conclusion, the project was a success.', options: ['In', 'On', 'At', 'By'], answer: 0 },
        { q: '___, let us review the main points.', options: ['First of all', 'Firstly of all', 'One first', 'In first'], answer: 0 },
        { q: 'The data is clear. ___, action is needed.', options: ['Therefore', 'Although', 'Despite', 'Because'], answer: 0 },
      ],
      pairs: [
        { es: 'en primer lugar', en: 'first of all' },
        { es: 'por otra parte', en: 'on the other hand' },
        { es: 'para concluir', en: 'to conclude' },
        { es: 'dicho de otro modo', en: 'in other words' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-w1', block: 'writing', title: 'Ensayo y texto de opinión', bookKey: 'straightforward-int-2012', difficulty: 0.85,
    content: {
      pairs: [
        { es: 'Este ensayo analiza el trabajo remoto.', en: 'This essay analyzes remote work.' },
        { es: 'La primera razón es la flexibilidad.', en: 'The first reason is flexibility.' },
        { es: 'Los datos muestran un aumento de productividad.', en: 'The data shows an increase in productivity.' },
        { es: 'Sin embargo, existen desventajas claras.', en: 'However, there are clear disadvantages.' },
        { es: 'En conclusión, el balance es positivo.', en: 'In conclusion, the balance is positive.' },
      ],
      order: [
        { words: ['is', 'The', 'that', 'problem', 'cost', 'the', 'increases'], answer: 'The problem is that the cost increases' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-w2', block: 'writing', title: 'Comparativo y argumentación', bookKey: 'straightforward-int-2012', difficulty: 0.9,
    content: {
      pairs: [
        { es: 'Ambas opciones tienen pros y contras.', en: 'Both options have pros and cons.' },
        { es: 'La primera es más rápida pero menos precisa.', en: 'The first one is faster but less accurate.' },
        { es: 'La segunda requiere más tiempo de preparación.', en: 'The second one requires more preparation time.' },
        { es: 'Considerando el presupuesto, recomiendo la segunda.', en: 'Considering the budget, I recommend the second one.' },
        { es: 'Una comparación detallada está adjunta.', en: 'A detailed comparison is attached.' },
      ],
      order: [
        { words: ['more', 'This', 'option', 'expensive', 'is', 'but', 'safer'], answer: 'This option is more expensive but safer' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-s1', block: 'speaking', title: 'Presentaciones y debates', bookKey: 'speakout-a1-2022', difficulty: 0.85,
    content: {
      dialogue: [
        { es: 'Hoy presentaré tres puntos principales.', en: 'Today I will present three main points.' },
        { es: 'En primer lugar, hablemos del presupuesto.', en: 'First of all, let\'s talk about the budget.' },
        { es: '¿Alguien quiere añadir algo?', en: 'Does anyone want to add something?' },
        { es: 'Estoy de acuerdo con tu argumento.', en: 'I agree with your argument.' },
        { es: 'Para terminar, resumamos las ideas.', en: 'To finish, let\'s summarize the ideas.' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-s2', block: 'speaking', title: 'Acuerdo y desacuerdo', bookKey: 'cutting-edge-elem-2013', difficulty: 0.9,
    content: {
      dialogue: [
        { es: 'No estoy totalmente de acuerdo.', en: 'I don\'t completely agree.' },
        { es: 'Entiendo tu punto de vista.', en: 'I understand your point of view.' },
        { es: 'Pero los números dicen otra cosa.', en: 'But the numbers say something different.' },
        { es: 'Acepto tu argumento en parte.', en: 'I accept your argument in part.' },
        { es: 'Encontremos un punto medio.', en: 'Let\'s find a middle ground.' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-s3', block: 'speaking', title: 'Temas sociales', bookKey: 'english-file-beginner-2019', difficulty: 0.9,
    content: {
      dialogue: [
        { es: 'La educación en línea creció mucho.', en: 'Online education has grown a lot.' },
        { es: 'En mi país, el cambio fue rápido.', en: 'In my country, the change was fast.' },
        { es: 'La tecnología cambió el trabajo también.', en: 'Technology changed work as well.' },
        { es: 'Muchas personas trabajan desde casa ahora.', en: 'Many people work from home now.' },
        { es: 'El futuro será diferente, sin duda.', en: 'The future will definitely be different.' },
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-l1', block: 'listening', title: 'Velocidad normal moderada', bookKey: 'collins-life-listening-2012', difficulty: 0.85,
    content: {
      dictation: [
        'The program has been running since January.',
        'Listeners can send their questions by email.',
        'The presenter interviewed three guests today.',
        'Our next episode will discuss technology.',
        'She has been teaching for more than ten years.',
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-l2', block: 'listening', title: 'Ideas principales y secundarias', bookKey: 'collins-life-listening-2012', difficulty: 0.9,
    content: {
      dictation: [
        'The main idea is that practice makes progress.',
        'Secondary details will be explained later.',
        'The speaker focused on three key arguments.',
        'In short, the results exceeded expectations.',
        'The study compared two different methods.',
      ],
    },
  },
  {
    moduleId: 8, lessonKey: 'm8-r1', block: 'review', title: 'Repaso del módulo 8', bookKey: 'empower-starter-2022', difficulty: 0.9,
    content: {
      mcq: [
        { q: 'She ___ in this team since it was created.', options: ['has been working', 'works', 'worked', 'is working'], answer: 0 },
        { q: 'The contract ___ by both parties last week.', options: ['was signed', 'signed', 'is signed', 'has sign'], answer: 0 },
      ],
      gap: [
        { text: 'If I ___ his number, I would call him. (saber)', answer: 'knew' },
        { text: 'He left early ___ avoid the traffic. (in)', answer: 'in' },
      ],
      pairs: [
        { es: 'El informe ha sido revisado dos veces.', en: 'The report has been reviewed twice.' },
        { es: 'Dijo que presentaría los resultados.', en: 'He said he would present the results.' },
      ],
      reading: [{
        title: 'El seminario de innovación',
        text: 'The university has organized an innovation seminar every year since 2015. This year, more than three hundred students attended the event, which was held at the main auditorium. The keynote speaker, a well-known engineer, argued that creativity must be combined with discipline. Although some students disagreed with her conclusions, the debate was respectful and productive. By the end of the day, several teams had already signed up for the university\'s new entrepreneurship program, which will start next semester.',
        questions: [
          { q: 'How long has the seminar been organized?', options: ['Since 2015', 'For one year', 'Since last month', 'It is the first time'], answer: 0 },
          { q: 'What will start next semester?', options: ['An entrepreneurship program', 'A new seminar', 'An engineering course', 'The debate'], answer: 0 },
        ],
      }],
    },
  },

  // ===== MÓDULO 9 — B1.1 Comunicación independiente =====
  {
    moduleId: 9, lessonKey: 'm9-g1', block: 'grammar', title: 'Perfect tenses y condicionales', bookKey: 'murphy-english-2019', difficulty: 0.9,
    content: {
      mcq: [
        { q: 'By next month, I ___ here for a year.', options: ['will have worked', 'will work', 'have worked', 'had worked'], answer: 0 },
        { q: 'If she ___ earlier, she wouldn\'t have missed the flight.', options: ['had left', 'left', 'would leave', 'has left'], answer: 0, hint: 'Third conditional' },
        { q: 'They ___ each other since childhood.', options: ['have known', 'knew', 'know', 'had known'], answer: 0 },
      ],
      gap: [
        { text: 'We ___ waiting for an hour when the doctor arrived. (had been)', answer: 'had been' },
        { text: 'If I had known, I ___ told you. (would)', answer: 'would have' },
        { text: 'She has been studying English ___ 2019.', answer: 'since' },
      ],
      order: [
        { words: ['will', 'By', 'finished', 'Friday,', 'have', 'we', 'all'], answer: 'By Friday, we will have finished all' },
        { words: ['have', 'They', 'preparing', 'been', 'for', 'weeks'], answer: 'They have been preparing for weeks' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-g2', block: 'grammar', title: 'Pasiva, reported y modales', bookKey: 'eastwood-opg-2019', difficulty: 0.9,
    content: {
      mcq: [
        { q: 'The results ___ published next week.', options: ['will be', 'will', 'are being', 'have'], answer: 0 },
        { q: 'She asked whether I ___ finished.', options: ['had', 'have', 'did', 'was'], answer: 0 },
        { q: 'The door ___ opened by the guard every morning.', options: ['is', 'was being', 'has', 'will'], answer: 0 },
      ],
      gap: [
        { text: 'He said the meeting ___ been cancelled. (había)', answer: 'had' },
        { text: 'The problem is ___ discussed right now. (being)', answer: 'being' },
        { text: 'You ___ have told me earlier! (deberías)', answer: 'should' },
      ],
      order: [
        { words: ['be', 'The', 'will', 'announced', 'winner'], answer: 'The winner will be announced' },
        { words: ['she', 'He', 'was', 'explained', 'why', 'late'], answer: 'He explained why she was late' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-g3', block: 'grammar', title: 'Clauses complejas y narración', bookKey: 'cobuild-grammar-2017', difficulty: 0.95,
    content: {
      mcq: [
        { q: '___ the storm, the crew kept sailing.', options: ['Although', 'Despite', 'However', 'Because'], answer: 0, hint: 'Although + cláusula' },
        { q: 'The novel, ___ was published in 1985, became a classic.', options: ['which', 'that', 'who', 'what'], answer: 0 },
        { q: 'Hardly ___ the office when the alarm rang.', options: ['had he left', 'he had left', 'did he left', 'he left'], answer: 0 },
      ],
      gap: [
        { text: 'The report ___ be signed before Friday. (must)', answer: 'must' },
        { text: 'No sooner had she arrived ___ the phone rang.', answer: 'than' },
        { text: 'It was the first time he ___ spoken in public. (had)', answer: 'had' },
      ],
      order: [
        { words: ['that', 'She', 'was', 'the', 'day', 'realized', 'dream', 'her', 'true'], answer: 'She realized that the day her dream was true' },
        { words: ['which', 'The', 'won', 'team,', 'trained', 'hard,', 'the', 'cup'], answer: 'The team, which trained hard, won the cup' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-v1', block: 'vocab', title: 'Phrasal verbs de B1', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.9,
    content: {
      pairs: [
        { es: 'decidir (una opción)', en: 'to settle on' },
        { es: 'lidiar con', en: 'to deal with' },
        { es: 'llegar a un acuerdo', en: 'to reach an agreement' },
        { es: 'aprovechar (una oportunidad)', en: 'to take advantage of' },
        { es: 'plantearse (una meta)', en: 'to set out' },
        { es: 'salir bien (un plan)', en: 'to work out' },
      ],
      mcq: [
        { q: 'Everything ___ out better than we expected.', options: ['worked', 'made', 'put', 'took'], answer: 0 },
        { q: '«To deal with a problem» means…', options: ['lidiar con un problema', 'ignorar un problema', 'vender un problema', 'evitar un problema'], answer: 0 },
        { q: 'They took ___ of the discount and bought two.', options: ['advantage', 'care', 'part', 'place'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-v2', block: 'vocab', title: 'Léxico de opinión', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.95,
    content: {
      mcq: [
        { q: 'I see your point, ___ I disagree.', options: ['but', 'so', 'because', 'and'], answer: 0 },
        { q: '«To back up an argument» means…', options: ['apoyar un argumento con datos', 'rechazar un argumento', 'dudar de un argumento', 'repetir un argumento'], answer: 0 },
        { q: 'A «counterargument» is…', options: ['un contraargumento', 'una conclusión', 'un ejemplo', 'una cita'], answer: 0 },
      ],
      pairs: [
        { es: 'desde mi punto de vista', en: 'from my point of view' },
        { es: 'es evidente que', en: 'it is clear that' },
        { es: 'por el contrario', en: 'on the contrary' },
        { es: 'tener razón', en: 'to be right' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-w1', block: 'writing', title: 'Ensayos de opinión', bookKey: 'straightforward-int-2012', difficulty: 0.9,
    content: {
      pairs: [
        { es: 'Estimada señora Torres:', en: 'Dear Ms. Torres,' },
        { es: 'Le escribo en relación con la vacante.', en: 'I am writing in relation to the vacancy.' },
        { es: 'Desde mi punto de vista, soy un buen candidato.', en: 'From my point of view, I am a good candidate.' },
        { es: 'Adjunto mi currículum para su consideración.', en: 'I attach my resume for your consideration.' },
        { es: 'Quedo atento a su respuesta.', en: 'I look forward to your reply.' },
      ],
      order: [
        { words: ['argue', 'would', 'critics', 'that', 'the', 'plan', 'fails'], answer: 'Critics would argue that the plan fails' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-w2', block: 'writing', title: 'Artículos y argumentación', bookKey: 'straightforward-int-2012', difficulty: 0.95,
    content: {
      pairs: [
        { es: 'El artículo examina tres tendencias actuales.', en: 'The article examines three current trends.' },
        { es: 'Los datos respaldan la primera hipótesis.', en: 'The data supports the first hypothesis.' },
        { es: 'Sin embargo, un contraargumento merece atención.', en: 'However, a counterargument deserves attention.' },
        { es: 'La evidencia sugiere lo contrario.', en: 'The evidence suggests otherwise.' },
        { es: 'En conclusión, el debate continúa abierto.', en: 'In conclusion, the debate remains open.' },
      ],
      order: [
        { words: ['supports', 'The', 'hypothesis', 'evidence', 'first', 'the'], answer: 'The evidence supports the first hypothesis' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-s1', block: 'speaking', title: 'Conversación espontánea', bookKey: 'speakout-a1-2022', difficulty: 0.9,
    content: {
      dialogue: [
        { es: '¿Sabes qué? Cambié de opinión sobre el proyecto.', en: 'You know what? I changed my mind about the project.' },
        { es: '¿De verdad? ¿Qué te hizo cambiar?', en: 'Really? What made you change?' },
        { es: 'Los últimos resultados fueron muy buenos.', en: 'The latest results were very good.' },
        { es: 'En ese caso, cuento contigo.', en: 'In that case, I count on you.' },
        { es: 'Puedes confiar en mí.', en: 'You can count on me.' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-s2', block: 'speaking', title: 'Presentaciones y debate', bookKey: 'cutting-edge-elem-2013', difficulty: 0.95,
    content: {
      dialogue: [
        { es: 'Permítanme presentar los hallazgos.', en: 'Let me present the findings.' },
        { es: 'El primer hallazgo es sorprendente.', en: 'The first finding is surprising.' },
        { es: '¿Cómo respaldas esa afirmación?', en: 'How do you back up that claim?' },
        { es: 'Con datos de tres estudios distintos.', en: 'With data from three different studies.' },
        { es: 'Impresionante, gracias por compartir.', en: 'Impressive, thanks for sharing.' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-s3', block: 'speaking', title: 'Resolución colaborativa', bookKey: 'english-file-beginner-2019', difficulty: 0.95,
    content: {
      dialogue: [
        { es: 'Tenemos que resolver esto juntos.', en: 'We have to solve this together.' },
        { es: '¿Qué opciones tenemos?', en: 'What options do we have?' },
        { es: 'Podemos delegar parte del trabajo.', en: 'We can delegate part of the work.' },
        { es: 'Buena idea, yo me encargo del informe.', en: 'Good idea, I will take care of the report.' },
        { es: 'Entonces acordamos dividir las tareas.', en: 'Then we agree to split the tasks.' },
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-l1', block: 'listening', title: 'Noticias y podcasts', bookKey: 'collins-life-listening-2012', difficulty: 0.9,
    content: {
      dictation: [
        'The government has announced a new housing plan.',
        'According to the report, unemployment has decreased.',
        'The podcast discussed climate change this week.',
        'Experts have warned about the risks of the policy.',
        'The story went viral within a few hours.',
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-l2', block: 'listening', title: 'Opinión y actitud', bookKey: 'collins-life-listening-2012', difficulty: 0.95,
    content: {
      dictation: [
        'Honestly, I believe the project will succeed.',
        'Unfortunately, the proposal was rejected.',
        'She clearly disagrees with the committee.',
        'To be fair, both sides made good points.',
        'The audience seemed unconvinced by the argument.',
      ],
    },
  },
  {
    moduleId: 9, lessonKey: 'm9-r1', block: 'review', title: 'Repaso del módulo 9', bookKey: 'b1-preliminary-2020', difficulty: 0.95,
    content: {
      mcq: [
        { q: 'By the time we landed, the storm ___.', options: ['had passed', 'passed', 'has passed', 'was passing'], answer: 0 },
        { q: 'The proposal is currently ___ reviewed by the board.', options: ['being', 'been', 'was', 'has'], answer: 0 },
      ],
      gap: [
        { text: 'If they had asked me, I ___ helped. (would have)', answer: 'would have' },
        { text: 'She said she ___ already sent the file. (había)', answer: 'had' },
      ],
      pairs: [
        { es: 'Los resultados serán publicados mañana.', en: 'The results will be published tomorrow.' },
        { es: 'Desde mi punto de vista, vale la pena.', en: 'From my point of view, it is worth it.' },
      ],
      reading: [{
        title: 'La entrevista',
        text: 'When Daniel was invited to his first job interview, he had prepared for weeks. He had researched the company, and he had practiced answering questions out loud. The interviewers, who had reviewed dozens of applications, were impressed by his knowledge of the sector. Although he was nervous, he answered confidently, and by the end of the interview he had asked three smart questions about the team. A week later, he was offered the position, and he accepted it immediately.',
        questions: [
          { q: 'How long had Daniel prepared?', options: ['Weeks', 'One day', 'A year', 'He didn\'t prepare'], answer: 0 },
          { q: 'What happened a week later?', options: ['He was offered the position', 'He was rejected', 'There was a second interview', 'He withdrew'], answer: 0 },
        ],
      }],
    },
  },

  // ===== MÓDULO 10 — B1.2 Consolidación de B1 =====
  {
    moduleId: 10, lessonKey: 'm10-g1', block: 'grammar', title: 'Revisión integral de tiempos', bookKey: 'murphy-english-2019', difficulty: 0.95,
    content: {
      mcq: [
        { q: 'I ___ this report twice already.', options: ['have read', 'read', 'was reading', 'had read'], answer: 0 },
        { q: 'She ___ the deadline if she starts today.', options: ['will meet', 'meets', 'met', 'would meet'], answer: 0 },
        { q: 'By the time the manager arrived, they ___ the problem.', options: ['had solved', 'solved', 'have solved', 'were solving'], answer: 0 },
      ],
      gap: [
        { text: 'He has been ___ for the exam all month. (study)', answer: 'studying' },
        { text: 'The files ___ been deleted by mistake. (han)', answer: 'have' },
        { text: 'If we had booked earlier, we ___ paid less. (would)', answer: 'would have' },
      ],
      order: [
        { words: ['have', 'We', 'this', 'discussed', 'topic', 'already'], answer: 'We have already discussed this topic' },
        { words: ['will', 'The', 'be', 'sent', 'tomorrow', 'invoice'], answer: 'The invoice will be sent tomorrow' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-g2', block: 'grammar', title: 'Reported speech y modales', bookKey: 'eastwood-opg-2019', difficulty: 0.95,
    content: {
      mcq: [
        { q: 'She ___ that she would join us later.', options: ['said', 'says', 'tell', 'told to'], answer: 0 },
        { q: 'He ___ me that the deadline had changed.', options: ['told', 'said', 'spoke', 'talked'], answer: 0 },
        { q: 'Candidates ___ submit two references.', options: ['must', 'musts', 'must to', 'have'], answer: 0 },
      ],
      gap: [
        { text: 'They wondered whether she ___ come. (would)', answer: 'would' },
        { text: 'The form ___ be completed in ink. (debe)', answer: 'must' },
        { text: 'He asked what time it ___. (era)', answer: 'was' },
      ],
      order: [
        { words: ['had', 'She', 'that', 'explained', 'changed', 'the', 'plan'], answer: 'She explained that the plan had changed' },
        { words: ['must', 'Visitors', 'an', 'wear', 'ID', 'badge'], answer: 'Visitors must wear an ID badge' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-g3', block: 'grammar', title: 'Precisión y naturalidad', bookKey: 'swan-peu-2016', difficulty: 1.0,
    content: {
      mcq: [
        { q: 'Choose the natural option:', options: ['I look forward to hearing from you.', 'I look forward to hear from you.', 'I look forward hearing from you.', 'I look forwards hear from you.'], answer: 0 },
        { q: 'Choose the correct sentence:', options: ['The information was useful.', 'The informations were useful.', 'The information were useful.', 'An information was useful.'], answer: 0, hint: 'Incontable' },
        { q: 'In formal writing, prefer:', options: ['We apologize for the delay.', 'We say sorry for the delay.', 'Sorry for the delay, guys.', 'Our bad for the delay.'], answer: 0 },
      ],
      gap: [
        { text: 'She made a good ___ on the committee. (impresión)', answer: 'impression' },
        { text: 'Please find the details ___. (adjuntos)', answer: 'attached' },
        { text: 'The data ___ that the method works. (suggest, tercera persona)', answer: 'suggests' },
      ],
      order: [
        { words: ['to', 'I', 'hearing', 'forward', 'look', 'from', 'you'], answer: 'I look forward to hearing from you' },
        { words: ['is', 'The', 'clear', 'feedback', 'very'], answer: 'The feedback is very clear' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-v1', block: 'vocab', title: 'Discourse markers y collocations', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.95,
    content: {
      pairs: [
        { es: 'por lo general', en: 'as a rule' },
        { es: 'en resumidas cuentas', en: 'all in all' },
        { es: 'tomar en cuenta', en: 'to take into account' },
        { es: 'llegar a una conclusión', en: 'to draw a conclusion' },
        { es: 'plantear una pregunta', en: 'to raise a question' },
        { es: 'hacer hincapié en', en: 'to emphasize' },
      ],
      mcq: [
        { q: '«All in all» introduces…', options: ['a summary', 'a contrast', 'an example', 'a doubt'], answer: 0 },
        { q: 'Choose the correct collocation:', options: ['draw a conclusion', 'make a conclusion', 'do a conclusion', 'take a conclusion'], answer: 0 },
        { q: 'Choose the correct collocation:', options: ['raise a question', 'rise a question', 'lift a question', 'stand a question'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-v2', block: 'vocab', title: 'Cohesión y coherencia', bookKey: 'vocab-in-use-preint-2017', difficulty: 1.0,
    content: {
      mcq: [
        { q: 'The first paragraph introduces the topic; the second ___ the evidence.', options: ['presents', 'present', 'presenting', 'is present'], answer: 0 },
        { q: '___ summarizes the findings briefly.', options: ['To summarize', 'Summarizing that', 'For summarize', 'In summarize'], answer: 0 },
        { q: 'Connectors like «furthermore» add…', options: ['extra information', 'contrast', 'cause', 'examples only'], answer: 0 },
      ],
      pairs: [
        { es: 'en primer término', en: 'in the first place' },
        { es: 'para finalizar', en: 'to close' },
        { es: 'cabe señalar que', en: 'it should be noted that' },
        { es: 'en síntesis', en: 'in a nutshell' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-w1', block: 'writing', title: 'Ensayo B1 y artículo', bookKey: 'straightforward-int-2012', difficulty: 0.95,
    content: {
      pairs: [
        { es: 'Este artículo explora el uso de la inteligencia artificial.', en: 'This article explores the use of artificial intelligence.' },
        { es: 'Los beneficios son evidentes en la salud.', en: 'The benefits are evident in healthcare.' },
        { es: 'No obstante, hay riesgos que considerar.', en: 'Nevertheless, there are risks to consider.' },
        { es: 'Cabe señalar que la regulación avanza despacio.', en: 'It should be noted that regulation moves slowly.' },
        { es: 'En síntesis, el equilibrio será clave.', en: 'In a nutshell, balance will be key.' },
      ],
      order: [
        { words: ['should', 'It', 'noted', 'be', 'that', 'costs', 'vary'], answer: 'It should be noted that costs vary' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-w2', block: 'writing', title: 'Review, report y narración', bookKey: 'straightforward-int-2012', difficulty: 1.0,
    content: {
      pairs: [
        { es: 'Este reporte resume los resultados del trimestre.', en: 'This report summarizes the quarterly results.' },
        { es: 'Las ventas aumentaron un doce por ciento.', en: 'Sales increased by twelve percent.' },
        { es: 'La reseña describe un restaurante excepcional.', en: 'The review describes an outstanding restaurant.' },
        { es: 'En resumidas cuentas, la experiencia fue impecable.', en: 'All in all, the experience was flawless.' },
        { es: 'Se recomienda repetir la medición el próximo mes.', en: 'It is recommended to repeat the measurement next month.' },
      ],
      order: [
        { words: ['increased', 'Sales', 'by', 'twelve', 'percent'], answer: 'Sales increased by twelve percent' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-s1', block: 'speaking', title: 'Presentación de 3-5 minutos', bookKey: 'speakout-a1-2022', difficulty: 0.95,
    content: {
      dialogue: [
        { es: 'Buenos días, hoy hablaré de mi experiencia.', en: 'Good morning, today I will talk about my experience.' },
        { es: 'Mi presentación tiene tres partes.', en: 'My presentation has three parts.' },
        { es: 'La primera parte describe el contexto.', en: 'The first part describes the context.' },
        { es: 'Cabe destacar que los resultados fueron positivos.', en: 'It is worth highlighting that the results were positive.' },
        { es: 'Gracias por su atención; ahora acepto preguntas.', en: 'Thank you for your attention; I will now take questions.' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-s2', block: 'speaking', title: 'Especulación y problemas', bookKey: 'cutting-edge-elem-2013', difficulty: 1.0,
    content: {
      dialogue: [
        { es: 'Puede que el retraso se deba al tráfico.', en: 'The delay may be due to traffic.' },
        { es: 'Debo de haber olvidado el correo.', en: 'I must have forgotten the email.' },
        { es: '¿Cómo podríamos resolverlo?', en: 'How could we solve it?' },
        { es: 'En tu lugar, yo hablaría con el jefe.', en: 'If I were you, I would talk to the boss.' },
        { es: 'Es posible que tengas razón.', en: 'You may be right.' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-s3', block: 'speaking', title: 'Simulación de examen B1', bookKey: 'b1-preliminary-2020', difficulty: 1.0,
    content: {
      dialogue: [
        { es: 'Cuéntame sobre una actividad que disfrutas.', en: 'Tell me about an activity you enjoy.' },
        { es: 'Disfruto tocar la guitarra los fines de semana.', en: 'I enjoy playing the guitar at weekends.' },
        { es: '¿Desde cuándo lo haces?', en: 'How long have you been doing it?' },
        { es: 'He tocado desde que tenía doce años.', en: 'I have been playing since I was twelve.' },
        { es: '¿Por qué te gusta tanto?', en: 'Why do you like it so much?' },
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-l1', block: 'listening', title: 'Acentos y charlas', bookKey: 'collins-life-listening-2012', difficulty: 0.95,
    content: {
      dictation: [
        'The talk will begin in five minutes.',
        'Today\'s lecture covers modern architecture.',
        'The speaker comes from the north of England.',
        'Recording will be available on the website.',
        'She has presented this research in three countries.',
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-l2', block: 'listening', title: 'Inferencia y actitud', bookKey: 'b1-preliminary-2020', difficulty: 1.0,
    content: {
      dictation: [
        'Apparently, the tickets sold out in minutes.',
        'To be honest, I wasn\'t impressed by the show.',
        'The audience inferred that more changes were coming.',
        'Judging by her tone, she was disappointed.',
        'It seems unlikely that the plan will change now.',
      ],
    },
  },
  {
    moduleId: 10, lessonKey: 'm10-r1', block: 'review', title: 'Repaso del módulo 10', bookKey: 'b1-preliminary-2020', difficulty: 1.0,
    content: {
      mcq: [
        { q: 'Choose the formal option:', options: ['We regret any inconvenience caused.', 'Sorry for the mess, folks.', 'Our bad about that.', 'Oops, sorry!'], answer: 0 },
        { q: 'He implied that the deadline ___ flexible.', options: ['was', 'is', 'will be', 'has'], answer: 0 },
      ],
      gap: [
        { text: 'All things ___, the project was a success. (considerado)', answer: 'considered' },
        { text: 'She must have ___ the message by now. (receive)', answer: 'received' },
      ],
      pairs: [
        { es: 'Cabe señalar que el plazo termina el viernes.', en: 'It should be noted that the deadline ends on Friday.' },
        { es: 'En resumidas cuentas, vale la pena el esfuerzo.', en: 'All in all, the effort is worth it.' },
      ],
      reading: [{
        title: 'El examen de cierre',
        text: 'After ten months of study, Mariana finally took her B1 exam. She had practiced every skill: reading, writing, listening and speaking. Although the listening section had worried her the most, it turned out to be easier than expected because she had trained with podcasts and different accents. When the results arrived, she had passed all four sections with strong scores. Her teacher said that consistency had been the key: short daily practice, week after week, had taken her exactly where she wanted to be.',
        questions: [
          { q: 'What had worried Mariana the most?', options: ['The listening section', 'The writing section', 'The speaking exam', 'The results day'], answer: 0 },
          { q: 'According to her teacher, what was the key?', options: ['Consistency', 'Luck', 'Long weekends', 'Natural talent'], answer: 0 },
        ],
      }],
    },
  },
]
