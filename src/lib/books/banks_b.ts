// Bancos de ejercicios originales — módulos 4 a 7 (A1+ transición, A2.1, A2.2, A2+).
// Alcance didáctico según «Modulos ingles Axiom.pdf»; contenido original de Axiom.
import type { BankDef } from './types'

export const BANKS_B: BankDef[] = [
  // ===== MÓDULO 4 — A1+ Consolidación y transición a A2 =====
  {
    moduleId: 4, lessonKey: 'm4-g1', block: 'grammar', title: 'Past Simple completo', bookKey: 'murphy-english-2019', difficulty: 0.5,
    content: {
      mcq: [
        { q: 'We ___ to the mountains two years ago.', options: ['went', 'go', 'have gone', 'going'], answer: 0 },
        { q: 'He ___ his phone at the office yesterday.', options: ['forgot', 'forget', 'forgets', 'forgotten'], answer: 0 },
        { q: '___ they finish the project last week?', options: ['Did', 'Do', 'Have', 'Were'], answer: 0 },
      ],
      gap: [
        { text: 'I saw her ___ (el martes pasado).', answer: 'last Tuesday' },
        { text: 'She ___ the exam in 2023. (pass)', answer: 'passed' },
        { text: 'We didn\'t ___ the museum. (visit)', answer: 'visit' },
      ],
      order: [
        { words: ['ago', 'moved', 'Two', 'here', 'years', 'they'], answer: 'Two years ago they moved here' },
        { words: ['did', 'meet', 'Where', 'you', 'her'], answer: 'Where did you meet her' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-g2', block: 'grammar', title: 'Futuro: will y going to', bookKey: 'eastwood-opg-2019', difficulty: 0.5,
    content: {
      mcq: [
        { q: 'I bought the tickets — I ___ travel next Friday.', options: ['am going to', 'will', 'go', 'traveling'], answer: 0, hint: 'Plan decidido' },
        { q: 'The phone is ringing. I ___ answer it.', options: ['will', 'am going to', 'going', 'answer to'], answer: 0, hint: 'Decisión espontánea' },
        { q: 'Look at those clouds! It ___ rain.', options: ['is going to', 'wills', 'will to', 'rains'], answer: 0 },
      ],
      gap: [
        { text: 'She ___ be 30 next month. (will)', answer: 'will' },
        { text: 'They ___ get married in June. (plan: going to)', answer: 'are going to' },
        { text: 'I think it ___ be a great party.', answer: 'will' },
      ],
      order: [
        { words: ['going', 'We\'re', 'to', 'a', 'buy', 'house'], answer: 'We\'re going to buy a house' },
        { words: ['will', 'I', 'you', 'call', 'later'], answer: 'I will call you later' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-g3', block: 'grammar', title: 'Obligación y consejo', bookKey: 'cobuild-grammar-2017', difficulty: 0.55,
    content: {
      mcq: [
        { q: 'Students ___ wear a uniform at that school.', options: ['have to', 'has to', 'must to', 'should to'], answer: 0 },
        { q: 'You look tired. You ___ rest.', options: ['should', 'must to', 'have', 'may to'], answer: 0 },
        { q: 'Take an umbrella. It ___ rain later.', options: ['might', 'must', 'should', 'have to'], answer: 0 },
      ],
      gap: [
        { text: 'You ___ smoke here. It\'s prohibited. (obligación negativa)', answer: 'mustn\'t' },
        { text: 'If it rains, we ___ stay home. (first conditional)', answer: 'will' },
        { text: 'He ___ work on Saturdays. (obligación)', answer: 'has to' },
      ],
      order: [
        { words: ['should', 'You', 'a', 'see', 'doctor'], answer: 'You should see a doctor' },
        { words: ['have', 'I', 'to', 'today', 'study'], answer: 'I have to study today' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-v1', block: 'vocab', title: 'Vacaciones y planes', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.5,
    content: {
      pairs: [
        { es: 'el hospedaje', en: 'the accommodation' },
        { es: 'la reservación', en: 'the booking' },
        { es: 'la invitación', en: 'the invitation' },
        { es: 'el itinerario', en: 'the itinerary' },
        { es: 'la sugerencia', en: 'the suggestion' },
        { es: 'las vacaciones', en: 'the holidays' },
      ],
      mcq: [
        { q: 'You reserve a table with a…', options: ['booking', 'bill', 'menu', 'tip'], answer: 0 },
        { q: '«Make a suggestion» means…', options: ['hacer una sugerencia', 'dar un regalo', 'cancelar un plan', 'pedir ayuda'], answer: 0 },
        { q: 'An «invitation» is for…', options: ['invitar a alguien', 'pedir permiso', 'quejarse', 'pagar la cuenta'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-v2', block: 'vocab', title: 'Conectores y adverbios', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.55,
    content: {
      mcq: [
        { q: '___, I would like to thank everyone.', options: ['Finally', 'Finally of all', 'In final', 'Finalize'], answer: 0 },
        { q: 'She sings very ___.', options: ['well', 'good', 'best', 'better'], answer: 0, hint: 'Adverbio de modo' },
        { q: 'He is ___ exhausted after the match.', options: ['completely', 'complete', 'completing', 'completion'], answer: 0 },
      ],
      pairs: [
        { es: 'por lo tanto', en: 'therefore' },
        { es: 'sin embargo', en: 'however' },
        { es: 'además', en: 'moreover' },
        { es: 'por ejemplo', en: 'for example' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-w1', block: 'writing', title: 'Narraciones y correos', bookKey: 'cutting-edge-elem-2013', difficulty: 0.5,
    content: {
      pairs: [
        { es: 'Querida Ana, ¿cómo estás?', en: 'Dear Ana, how are you?' },
        { es: 'Te escribo para invitarte a mi cumpleaños.', en: 'I am writing to invite you to my birthday.' },
        { es: 'La fiesta empieza a las siete.', en: 'The party starts at seven.' },
        { es: 'Espero que puedas venir.', en: 'I hope you can come.' },
        { es: 'Escríbeme pronto.', en: 'Write back soon.' },
      ],
      order: [
        { words: ['was', 'Last', 'winter', 'very', 'cold'], answer: 'Last winter was very cold' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-w2', block: 'writing', title: 'Planes y opiniones', bookKey: 'straightforward-int-2012', difficulty: 0.55,
    content: {
      pairs: [
        { es: 'El próximo año voy a estudiar inglés.', en: 'Next year I am going to study English.' },
        { es: 'En mi opinión, la película es excelente.', en: 'In my opinion, the movie is excellent.' },
        { es: 'Creo que es una buena idea.', en: 'I think it is a good idea.' },
        { es: 'Vamos a viajar en diciembre.', en: 'We are going to travel in December.' },
        { es: 'No estoy seguro, pero tal vez sí.', en: 'I am not sure, but maybe yes.' },
      ],
      order: [
        { words: ['to', 'I\'m', 'to', 'going', 'learn', 'French'], answer: 'I\'m going to learn French' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-s1', block: 'speaking', title: 'Vacaciones y planes', bookKey: 'speakout-a1-2022', difficulty: 0.5,
    content: {
      dialogue: [
        { es: '¿Qué vas a hacer en tus vacaciones?', en: 'What are you going to do on your holidays?' },
        { es: 'Voy a visitar la costa.', en: 'I am going to visit the coast.' },
        { es: '¿Ya reservaste el hotel?', en: 'Did you book the hotel yet?' },
        { es: 'Sí, pagué todo ayer.', en: 'Yes, I paid for everything yesterday.' },
        { es: '¡Mejor deberías descansar!', en: 'You should rest more!' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-s2', block: 'speaking', title: 'Sugerencias y ayuda', bookKey: 'cutting-edge-elem-2013', difficulty: 0.55,
    content: {
      dialogue: [
        { es: 'Deberías probar este restaurante.', en: 'You should try this restaurant.' },
        { es: '¿Me puedes ayudar con esto?', en: 'Can you help me with this?' },
        { es: 'Claro, dime qué necesitas.', en: 'Sure, tell me what you need.' },
        { es: '¿Por qué no vamos juntos?', en: 'Why don\'t we go together?' },
        { es: 'Buena idea, gracias.', en: 'Good idea, thanks.' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-s3', block: 'speaking', title: 'Problemas cotidianos', bookKey: 'english-file-beginner-2019', difficulty: 0.55,
    content: {
      dialogue: [
        { es: 'Mi computadora no funciona.', en: 'My computer doesn\'t work.' },
        { es: 'Deberías reiniciarla.', en: 'You should restart it.' },
        { es: 'Ya lo intenté, pero nada.', en: 'I already tried, but nothing.' },
        { es: 'Tal vez necesites ayuda técnica.', en: 'Maybe you need technical support.' },
        { es: 'Tienes razón, los llamaré.', en: 'You are right, I will call them.' },
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-l1', block: 'listening', title: 'Anuncios e indicaciones', bookKey: 'collins-life-listening-2012', difficulty: 0.5,
    content: {
      dictation: [
        'The museum is open every day except Mondays.',
        'Turn left at the traffic lights.',
        'The next train arrives in ten minutes.',
        'Tickets are cheaper if you book online.',
        'The tour starts at the main entrance.',
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-l2', block: 'listening', title: 'Conversaciones moderadas', bookKey: 'collins-life-listening-2012', difficulty: 0.55,
    content: {
      dictation: [
        'We are going to visit my aunt next weekend.',
        'You should bring a jacket, it might get cold.',
        'The restaurant recommends booking in advance.',
        'I will help you with the bags.',
        'They have to leave early tomorrow morning.',
      ],
    },
  },
  {
    moduleId: 4, lessonKey: 'm4-r1', block: 'review', title: 'Repaso del módulo 4', bookKey: 'empower-starter-2022', difficulty: 0.55,
    content: {
      mcq: [
        { q: 'Don\'t worry about the bill — I ___ pay it.', options: ['will', 'am going', 'go to', 'paying'], answer: 0 },
        { q: 'Visitors ___ register at reception.', options: ['have to', 'should to', 'must to', 'has to'], answer: 0 },
      ],
      gap: [
        { text: 'If you study, you ___ pass. (will)', answer: 'will' },
        { text: 'We ___ going to move next year.', answer: 'are' },
      ],
      pairs: [
        { es: 'Deberías hablar con ella.', en: 'You should talk to her.' },
        { es: 'Voy a reservar los boletos hoy.', en: 'I am going to book the tickets today.' },
      ],
      reading: [{
        title: 'Un cambio de planes',
        text: 'Last month, Laura booked a trip to the mountains. She was going to leave on Friday, but the weather forecast said it would snow all weekend, so she decided to wait. She called the hotel and changed her booking to the next month. Her friends told her that winter is not the best season for hiking anyway, and they suggested visiting in spring, when the flowers are open and the days are longer.',
        questions: [
          { q: 'Why did Laura change her trip?', options: ['It would snow', 'She was sick', 'The hotel was closed', 'She had no money'], answer: 0 },
          { q: 'When do her friends recommend going?', options: ['In spring', 'In winter', 'Next Friday', 'Never'], answer: 0 },
        ],
      }],
    },
  },

  // ===== MÓDULO 5 — A2.1 Comunicación funcional =====
  {
    moduleId: 5, lessonKey: 'm5-g1', block: 'grammar', title: 'Present Perfect introductorio', bookKey: 'murphy-english-2019', difficulty: 0.6,
    content: {
      mcq: [
        { q: 'I ___ never been to Asia.', options: ['have', 'has', 'am', 'did'], answer: 0 },
        { q: 'She has ___ finished her homework.', options: ['just', 'yet', 'ever', 'since'], answer: 0 },
        { q: 'Have you eaten ___?', options: ['yet', 'just', 'ever already', 'since'], answer: 0 },
      ],
      gap: [
        { text: 'They have ___ in this city for ten years. (live, participio)', answer: 'lived' },
        { text: 'We haven\'t decided ___.', answer: 'yet' },
        { text: '___ you ever tried sushi?', answer: 'Have' },
      ],
      order: [
        { words: ['has', 'The', 'already', 'left', 'train'], answer: 'The train has already left' },
        { words: ['have', 'I', 'my', 'lost', 'keys'], answer: 'I have lost my keys' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-g2', block: 'grammar', title: 'Past Continuous', bookKey: 'eastwood-opg-2019', difficulty: 0.6,
    content: {
      mcq: [
        { q: 'I ___ dinner when the phone rang.', options: ['was cooking', 'cooked', 'have cooked', 'cook'], answer: 0 },
        { q: 'What ___ you doing at midnight?', options: ['were', 'was', 'are', 'did'], answer: 0 },
        { q: 'They ___ waiting when the bus arrived.', options: ['were', 'was', 'are', 'have'], answer: 0 },
      ],
      gap: [
        { text: 'She ___ reading when I called. (negativo)', answer: 'wasn\'t' },
        { text: 'While we ___, it started to rain. (walk)', answer: 'were walking' },
        { text: 'The sun ___ shining this morning.', answer: 'was' },
      ],
      order: [
        { words: ['was', 'He', 'when', 'working', 'I', 'arrived'], answer: 'He was working when I arrived' },
        { words: ['were', 'doing', 'What', 'you', 'at', 'eight'], answer: 'What were you doing at eight' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-g3', block: 'grammar', title: 'Infinitivo y gerundio', bookKey: 'cobuild-grammar-2017', difficulty: 0.65,
    content: {
      mcq: [
        { q: 'I want ___ a new language.', options: ['to learn', 'learning', 'learn', 'learnt'], answer: 0 },
        { q: 'She enjoys ___ to music.', options: ['listening', 'to listen', 'listen', 'listened'], answer: 0 },
        { q: 'This is the man ___ helped me.', options: ['who', 'which', 'what', 'where'], answer: 0 },
      ],
      gap: [
        { text: 'He decided ___ the job. (accept)', answer: 'to accept' },
        { text: 'Do you mind ___ the window? (open)', answer: 'opening' },
        { text: 'That\'s the book ___ I told you about.', answer: 'that' },
      ],
      order: [
        { words: ['to', 'They', 'travel', 'decided', 'together'], answer: 'They decided to travel together' },
        { words: ['swimming', 'She', 'goes', 'on', 'Mondays'], answer: 'She goes swimming on Mondays' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-v1', block: 'vocab', title: 'Experiencias de vida', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.6,
    content: {
      pairs: [
        { es: 'la experiencia', en: 'the experience' },
        { es: 'la entrevista', en: 'the interview' },
        { es: 'el problema', en: 'the problem' },
        { es: 'la solución', en: 'the solution' },
        { es: 'el logro', en: 'the achievement' },
        { es: 'el fracaso', en: 'the failure' },
      ],
      mcq: [
        { q: 'A «job interview» is…', options: ['una entrevista de trabajo', 'una oferta', 'una renuncia', 'una reunión social'], answer: 0 },
        { q: 'The opposite of «failure» is…', options: ['success', 'problem', 'attempt', 'mistake'], answer: 0 },
        { q: '«To solve a problem» means…', options: ['resolver un problema', 'crear un problema', 'ignorar un problema', 'explicar un problema'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-v2', block: 'vocab', title: 'Cuantificadores avanzados', bookKey: 'word-skills-elem-2020', difficulty: 0.65,
    content: {
      mcq: [
        { q: 'There were ___ people at the concert that we left.', options: ['so many', 'so much', 'too much', 'enough'], answer: 0 },
        { q: 'I have ___ free time these days.', options: ['little', 'few', 'a few', 'many'], answer: 0, hint: 'Incontable' },
        { q: '___ candidate must bring an ID.', options: ['Each', 'Every of', 'All of', 'Much'], answer: 0 },
      ],
      pairs: [
        { es: 'una gran cantidad de', en: 'a great deal of' },
        { es: 'varios', en: 'several' },
        { es: 'pocos', en: 'few' },
        { es: 'suficiente', en: 'enough' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-w1', block: 'writing', title: 'Experiencias personales', bookKey: 'cutting-edge-elem-2013', difficulty: 0.6,
    content: {
      pairs: [
        { es: 'Nunca he estado en Europa.', en: 'I have never been to Europe.' },
        { es: 'Ya he terminado mi tarea.', en: 'I have already finished my homework.' },
        { es: 'Estaba cocinando cuando llegaste.', en: 'I was cooking when you arrived.' },
        { es: 'Aprendí a nadar cuando era niño.', en: 'I learned to swim when I was a child.' },
        { es: 'Esta es la mejor experiencia de mi vida.', en: 'This is the best experience of my life.' },
      ],
      order: [
        { words: ['have', 'We', 'each', 'known', 'other', 'for', 'years'], answer: 'We have known each other for years' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-w2', block: 'writing', title: 'Problemas y recomendaciones', bookKey: 'straightforward-int-2012', difficulty: 0.65,
    content: {
      pairs: [
        { es: 'Le escribo para explicar un problema.', en: 'I am writing to explain a problem.' },
        { es: 'El pedido llegó tarde.', en: 'The order arrived late.' },
        { es: 'Le recomiendo revisar la dirección.', en: 'I recommend checking the address.' },
        { es: 'Ojalá puedan resolverlo pronto.', en: 'I hope you can solve it soon.' },
        { es: 'Mi opinión es que falta información.', en: 'My opinion is that information is missing.' },
      ],
      order: [
        { words: ['mind', 'Would', 'closing', 'you', 'the', 'door'], answer: 'Would you mind closing the door' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-s1', block: 'speaking', title: 'Contar experiencias', bookKey: 'speakout-a1-2022', difficulty: 0.6,
    content: {
      dialogue: [
        { es: 'He trabajado aquí por dos años.', en: 'I have worked here for two years.' },
        { es: '¿Cuál ha sido tu mejor experiencia?', en: 'What has been your best experience?' },
        { es: 'Viajar a Japón fue increíble.', en: 'Traveling to Japan was amazing.' },
        { es: 'Nunca he visto algo así.', en: 'I have never seen anything like that.' },
        { es: '¿Qué estabas haciendo en ese momento?', en: 'What were you doing at that moment?' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-s2', block: 'speaking', title: 'Explicar y resolver', bookKey: 'cutting-edge-elem-2013', difficulty: 0.65,
    content: {
      dialogue: [
        { es: 'Tengo un problema con mi cuenta.', en: 'I have a problem with my account.' },
        { es: '¿Puede explicar qué pasó?', en: 'Can you explain what happened?' },
        { es: 'Olvidé mi contraseña.', en: 'I forgot my password.' },
        { es: 'Podemos restablecerla.', en: 'We can reset it.' },
        { es: 'Perfecto, gracias por la solución.', en: 'Perfect, thanks for the solution.' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-s3', block: 'speaking', title: 'Comparar alternativas', bookKey: 'english-file-beginner-2019', difficulty: 0.65,
    content: {
      dialogue: [
        { es: '¿Cuál opción es mejor para ti?', en: 'Which option is better for you?' },
        { es: 'Creo que la primera es más rápida.', en: 'I think the first one is faster.' },
        { es: 'Pero la segunda es más barata.', en: 'But the second one is cheaper.' },
        { es: 'Recomiendo elegir la más barata.', en: 'I recommend choosing the cheaper one.' },
        { es: 'De acuerdo, tomemos esa.', en: 'Agreed, let\'s take that one.' },
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-l1', block: 'listening', title: 'Entrevistas e historias', bookKey: 'collins-life-listening-2012', difficulty: 0.6,
    content: {
      dictation: [
        'She has lived in Canada since 2020.',
        'I was working when the meeting started.',
        'He has just finished his studies.',
        'We were traveling when we heard the news.',
        'They haven\'t decided yet.',
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-l2', block: 'listening', title: 'Trabajo y servicios', bookKey: 'collins-life-listening-2012', difficulty: 0.65,
    content: {
      dictation: [
        'Your appointment is scheduled for Thursday.',
        'The technician is fixing the machine now.',
        'We have received your application.',
        'Could you explain the problem again, please?',
        'The manager will call you back this afternoon.',
      ],
    },
  },
  {
    moduleId: 5, lessonKey: 'm5-r1', block: 'review', title: 'Repaso del módulo 5', bookKey: 'empower-starter-2022', difficulty: 0.65,
    content: {
      mcq: [
        { q: 'I ___ to the doctor yesterday.', options: ['went', 'have gone', 'go', 'was going'], answer: 0, hint: 'Tiempo definido: pasado simple' },
        { q: 'He avoided ___ about the accident.', options: ['talking', 'to talk', 'talk', 'talked'], answer: 0 },
      ],
      gap: [
        { text: 'Have you ___ been to London? (alguna vez)', answer: 'ever' },
        { text: 'While she ___, the doorbell rang. (cook)', answer: 'was cooking' },
      ],
      pairs: [
        { es: 'He vivido aquí toda mi vida.', en: 'I have lived here all my life.' },
        { es: '¿Qué hacías a las diez?', en: 'What were you doing at ten?' },
      ],
      reading: [{
        title: 'Una carrera inesperada',
        text: 'Sofía has worked as a graphic designer for five years. Last year, while she was working on a normal project, her client asked her to design a company logo. She had never designed a logo before, but she decided to try. The client loved it and recommended her to other companies. Since then, she has designed more than twenty logos, and she is now thinking about starting her own studio next year.',
        questions: [
          { q: 'How long has Sofía worked as a designer?', options: ['Five years', 'One year', 'Twenty years', 'She doesn\'t work'], answer: 0 },
          { q: 'What is she thinking about doing next year?', options: ['Starting her own studio', 'Changing careers', 'Traveling to Asia', 'Studying again'], answer: 0 },
        ],
      }],
    },
  },

  // ===== MÓDULO 6 — A2.2 Mayor autonomía =====
  {
    moduleId: 6, lessonKey: 'm6-g1', block: 'grammar', title: 'Present Perfect vs Past Simple', bookKey: 'murphy-english-2019', difficulty: 0.7,
    content: {
      mcq: [
        { q: 'I ___ in Bogotá in 2018.', options: ['arrived', 'have arrived', 'arrive', 'was arriving'], answer: 0, hint: 'Fecha definida' },
        { q: '___ you ever won a prize?', options: ['Have', 'Did', 'Do', 'Were'], answer: 0 },
        { q: 'He moved to Canada last year and ___ there since then.', options: ['has lived', 'lived', 'lives', 'is living'], answer: 0 },
      ],
      gap: [
        { text: 'We ___ this movie three times. (see, presente perfecto)', answer: 'have seen' },
        { text: 'She ___ her keys this morning. (lose, pasado simple)', answer: 'lost' },
        { text: 'They have known each other ___ 2015.', answer: 'since' },
      ],
      order: [
        { words: ['has', 'She', 'worked', 'never', 'here'], answer: 'She has never worked here' },
        { words: ['did', 'you', 'send', 'When', 'the', 'email'], answer: 'When did you send the email' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-g2', block: 'grammar', title: 'Modales y condicionales', bookKey: 'eastwood-opg-2019', difficulty: 0.7,
    content: {
      mcq: [
        { q: 'You ___ park here. It\'s forbidden.', options: ['can\'t', 'mustn\'t to', 'don\'t have', 'shouldn\'t to'], answer: 0 },
        { q: 'If you heat ice, it ___.', options: ['melts', 'will melt', 'melted', 'would melt'], answer: 0, hint: 'Zero conditional' },
        { q: 'If it rains tomorrow, we ___ the picnic.', options: ['will cancel', 'cancel', 'cancelled', 'would cancel'], answer: 0, hint: 'First conditional' },
      ],
      gap: [
        { text: '___ I open the window? (petición de permiso)', answer: 'May' },
        { text: 'You ___ bring your ID to vote. (obligación)', answer: 'must' },
        { text: 'If she calls me, I ___ her the news.', answer: 'will tell' },
      ],
      order: [
        { words: ['to', 'Am', 'allowed', 'I', 'enter'], answer: 'Am I allowed to enter' },
        { words: ['be', 'late,', 'the', 'If', 'miss', 'bus,', 'you\'ll', 'you'], answer: 'If you miss the bus, you\'ll be late' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-g3', block: 'grammar', title: 'Relativas, pasiva y estilo indirecto', bookKey: 'cobuild-grammar-2017', difficulty: 0.75,
    content: {
      mcq: [
        { q: 'The woman ___ lives next door is a pilot.', options: ['who', 'which', 'whose', 'what'], answer: 0 },
        { q: 'The room ___ cleaned every day.', options: ['is', 'was', 'has', 'does'], answer: 0, hint: 'Pasiva presente' },
        { q: 'He said he ___ tired.', options: ['was', 'is', 'will be', 'has'], answer: 0, hint: 'Estilo indirecto' },
      ],
      gap: [
        { text: 'This is the app ___ I use every day.', answer: 'that' },
        { text: 'The emails were ___ yesterday. (send)', answer: 'sent' },
        { text: 'She said she ___ busy. (estilo indirecto de "I am busy")', answer: 'was' },
      ],
      order: [
        { words: ['by', 'The', 'was', 'letter', 'written', 'him'], answer: 'The letter was written by him' },
        { words: ['she', 'He', 'was', 'said', 'sleeping'], answer: 'He said she was sleeping' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-v1', block: 'vocab', title: 'Phrasal verbs frecuentes', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.7,
    content: {
      pairs: [
        { es: 'cancelar (una cita)', en: 'to call off' },
        { es: 'continuar', en: 'to go on' },
        { es: 'averiarse', en: 'to break down' },
        { es: 'averiguar', en: 'to find out' },
        { es: 'entregar (un trabajo)', en: 'to hand in' },
        { es: 'recoger a alguien', en: 'to pick up' },
      ],
      mcq: [
        { q: 'Our car ___ down on the highway.', options: ['broke', 'stopped', 'fell', 'went off'], answer: 0 },
        { q: '«Look after» means…', options: ['cuidar de', 'buscar atrás', 'mirar después', 'parecerse a'], answer: 0 },
        { q: 'Please hand ___ your reports by Friday.', options: ['in', 'up', 'on', 'off'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-v2', block: 'vocab', title: 'Quejas y gestión', bookKey: 'word-skills-elem-2020', difficulty: 0.75,
    content: {
      pairs: [
        { es: 'la queja', en: 'the complaint' },
        { es: 'el reembolso', en: 'the refund' },
        { es: 'el reclamo', en: 'the claim' },
        { es: 'la factura', en: 'the invoice' },
        { es: 'el proveedor', en: 'the supplier' },
        { es: 'el retraso', en: 'the delay' },
      ],
      mcq: [
        { q: 'If a product is broken, you ask for a…', options: ['refund', 'recipe', 'receipt', 'review'], answer: 0 },
        { q: '«To file a complaint» means…', options: ['presentar una queja', 'hacer un pedido', 'pagar una factura', 'dar las gracias'], answer: 0 },
        { q: 'The flight had a two-hour…', options: ['delay', 'refound', 'invoice', 'supply'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-w1', block: 'writing', title: 'Correos formales y quejas', bookKey: 'straightforward-int-2012', difficulty: 0.7,
    content: {
      pairs: [
        { es: 'Estimado señor García:', en: 'Dear Mr. García,' },
        { es: 'Le escribo para presentar una queja.', en: 'I am writing to make a complaint.' },
        { es: 'Solicito un reembolso completo.', en: 'I request a full refund.' },
        { es: 'Agradeceré su pronta respuesta.', en: 'I would appreciate your prompt reply.' },
        { es: 'Atentamente, Laura Méndez.', en: 'Yours sincerely, Laura Méndez.' },
      ],
      order: [
        { words: ['delivery', 'was', 'The', 'delayed', 'order'], answer: 'The order delivery was delayed' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-w2', block: 'writing', title: 'Descripciones y opiniones', bookKey: 'cutting-edge-elem-2013', difficulty: 0.75,
    content: {
      pairs: [
        { es: 'El departamento tiene tres habitaciones.', en: 'The apartment has three bedrooms.' },
        { es: 'Está situado cerca del centro.', en: 'It is located near the city center.' },
        { es: 'En mi opinión, el precio es justo.', en: 'In my opinion, the price is fair.' },
        { es: 'La cocina necesita una reparación.', en: 'The kitchen needs a repair.' },
        { es: 'Recomiendo este lugar sin dudarlo.', en: 'I recommend this place without hesitation.' },
      ],
      order: [
        { words: ['that', 'I', 'service', 'believe', 'excellent', 'the', 'is'], answer: 'I believe that the service is excellent' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-s1', block: 'speaking', title: 'Resolver problemas', bookKey: 'speakout-a1-2022', difficulty: 0.7,
    content: {
      dialogue: [
        { es: 'Quiero presentar una queja.', en: 'I want to make a complaint.' },
        { es: '¿Cuál es el problema exactamente?', en: 'What is the problem exactly?' },
        { es: 'El producto llegó dañado.', en: 'The product arrived damaged.' },
        { es: 'Ofrecemos un reembolso inmediato.', en: 'We offer an immediate refund.' },
        { es: 'Acepto, pero espero que no se repita.', en: 'I accept, but I hope it won\'t happen again.' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-s2', block: 'speaking', title: 'Explicar procedimientos', bookKey: 'cutting-edge-elem-2013', difficulty: 0.75,
    content: {
      dialogue: [
        { es: 'Primero, enciende la computadora.', en: 'First, turn on the computer.' },
        { es: 'Después, abre la aplicación.', en: 'Then, open the application.' },
        { es: 'Escribe tu usuario y contraseña.', en: 'Type your username and password.' },
        { es: 'Finalmente, presiona el botón enviar.', en: 'Finally, press the send button.' },
        { es: 'Si falla, reinicia el proceso.', en: 'If it fails, restart the process.' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-s3', block: 'speaking', title: 'Conversaciones largas', bookKey: 'english-file-beginner-2019', difficulty: 0.75,
    content: {
      dialogue: [
        { es: 'Cuéntame sobre tu nuevo trabajo.', en: 'Tell me about your new job.' },
        { es: 'Llevo un mes y me gusta mucho.', en: 'I have been there for a month and I really like it.' },
        { es: '¿Cuáles son tus funciones?', en: 'What are your duties?' },
        { es: 'Administro las redes sociales de la empresa.', en: 'I manage the company\'s social media.' },
        { es: 'Suena a un gran cambio para ti.', en: 'It sounds like a big change for you.' },
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-l1', block: 'listening', title: 'Teléfonos y servicio', bookKey: 'collins-life-listening-2012', difficulty: 0.7,
    content: {
      dictation: [
        'Your call is important to us, please hold the line.',
        'I am calling about my recent order.',
        'The package was delivered this morning.',
        'Could you repeat your account number, please?',
        'Our customer service team will contact you.',
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-l2', block: 'listening', title: 'Entrevistas y noticias', bookKey: 'collins-life-listening-2012', difficulty: 0.75,
    content: {
      dictation: [
        'The company announced a new office in the city.',
        'She was interviewed about her invention.',
        'The report says prices increased last month.',
        'Experts recommend reviewing the contract carefully.',
        'The project has been delayed until further notice.',
      ],
    },
  },
  {
    moduleId: 6, lessonKey: 'm6-r1', block: 'review', title: 'Repaso del módulo 6', bookKey: 'empower-starter-2022', difficulty: 0.75,
    content: {
      mcq: [
        { q: 'This is the engineer ___ project won the award.', options: ['whose', 'who', 'which', 'that\'s'], answer: 0 },
        { q: 'If I ___ more time, I would call them now.', options: ['had', 'have', 'will have', 'would have'], answer: 0, hint: 'Second conditional' },
      ],
      gap: [
        { text: 'The bridge was ___ in 1990. (build)', answer: 'built' },
        { text: 'He said he ___ the report the next day. (enviaría)', answer: 'would send' },
      ],
      pairs: [
        { es: 'El paquete fue entregado ayer.', en: 'The package was delivered yesterday.' },
        { es: 'Dijo que llegaría tarde.', en: 'He said he would arrive late.' },
      ],
      reading: [{
        title: 'Una queja resuelta',
        text: 'When Elena received her new washing machine, she discovered that it was damaged. She called the store immediately and explained the problem. The employee apologized and told her that the company policy was clear: damaged products are replaced within forty-eight hours. Two days later, a technician delivered a new machine and took the old one. Elena wrote a positive review because she felt the complaint had been handled professionally.',
        questions: [
          { q: 'What was wrong with the washing machine?', options: ['It was damaged', 'It was too small', 'It was old', 'It was expensive'], answer: 0 },
          { q: 'What did the company do?', options: ['It replaced the product', 'It gave a refund', 'It fixed it at home', 'It said no'], answer: 0 },
        ],
      }],
    },
  },

  // ===== MÓDULO 7 — A2+ Complejidad =====
  {
    moduleId: 7, lessonKey: 'm7-g1', block: 'grammar', title: 'Past Perfect y Second Conditional', bookKey: 'murphy-english-2019', difficulty: 0.8,
    content: {
      mcq: [
        { q: 'When we arrived, the film ___ already started.', options: ['had', 'has', 'was', 'did'], answer: 0 },
        { q: 'If I ___ rich, I would travel the world.', options: ['were', 'am', 'will be', 'have been'], answer: 0 },
        { q: 'She ___ finished the report before the meeting began.', options: ['had', 'has', 'have', 'was'], answer: 0 },
      ],
      gap: [
        { text: 'He told me he ___ seen the movie. (past perfect)', answer: 'had' },
        { text: 'If they ___ more time, they would visit us.', answer: 'had' },
        { text: 'The train ___ left by the time we got there. (past perfect de leave)', answer: 'had left' },
      ],
      order: [
        { words: ['had', 'We', 'before', 'eaten', 'he', 'arrived'], answer: 'We had eaten before he arrived' },
        { words: ['would', 'she', 'If', 'studied,', 'pass', 'she'], answer: 'If she studied, she would pass' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-g2', block: 'grammar', title: 'Pasiva y Reported Speech', bookKey: 'eastwood-opg-2019', difficulty: 0.8,
    content: {
      mcq: [
        { q: 'The documents ___ being reviewed now.', options: ['are', 'is', 'were', 'have'], answer: 0 },
        { q: 'She said she ___ come to the party.', options: ['would', 'will', 'does', 'shall'], answer: 0 },
        { q: 'The novel ___ written in 1962.', options: ['was', 'is', 'has', 'were'], answer: 0 },
      ],
      gap: [
        { text: 'He asked me where I ___. (estilo indirecto de "where do you live")', answer: 'lived' },
        { text: 'The results will ___ announced tomorrow.', answer: 'be' },
        { text: 'They said they ___ finished. (habían)', answer: 'had' },
      ],
      order: [
        { words: ['was', 'The', 'built', 'house', 'last', 'year'], answer: 'The house was built last year' },
        { words: ['she', 'He', 'would', 'said', 'call'], answer: 'He said she would call' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-g3', block: 'grammar', title: 'Relative clauses y used to', bookKey: 'cobuild-grammar-2017', difficulty: 0.85,
    content: {
      mcq: [
        { q: 'The café ___ we met has closed.', options: ['where', 'which', 'who', 'when'], answer: 0 },
        { q: 'I ___ to smoke, but I quit five years ago.', options: ['used', 'use', 'am used', 'using'], answer: 0 },
        { q: 'That\'s the author ___ book won the prize.', options: ['whose', 'who\'s', 'which', 'that'], answer: 0 },
      ],
      gap: [
        { text: 'People ___ speak faster here than in the capital. (used to / solían)', answer: 'used to' },
        { text: 'There ___ to be a cinema on this street.', answer: 'used' },
        { text: 'She remembered the day ___ they first met.', answer: 'when' },
      ],
      order: [
        { words: ['to', 'I', 'walk', 'used', 'to', 'school'], answer: 'I used to walk to school' },
        { words: ['where', 'This', 'was', 'is', 'the', 'born', 'hospital', 'he'], answer: 'This is the hospital where he was born' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-v1', block: 'vocab', title: 'Colocaciones y conectores', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.8,
    content: {
      pairs: [
        { es: 'tomar una decisión', en: 'to make a decision' },
        { es: 'poner atención', en: 'to pay attention' },
        { es: 'por un lado', en: 'on the one hand' },
        { es: 'por otro lado', en: 'on the other hand' },
        { es: 'en resumen', en: 'in short' },
        { es: 'mientras tanto', en: 'meanwhile' },
      ],
      mcq: [
        { q: 'Choose the correct collocation:', options: ['make a mistake', 'do a mistake', 'make wrong', 'do an error'], answer: 0 },
        { q: '«On the other hand» introduces…', options: ['a contrasting point', 'an example', 'a conclusion', 'a question'], answer: 0 },
        { q: 'Choose the correct collocation:', options: ['pay attention', 'make attention', 'put attention', 'do attention'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-v2', block: 'vocab', title: 'Oraciones complejas', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.85,
    content: {
      mcq: [
        { q: 'She left early ___ avoid the traffic.', options: ['to', 'for', 'avoiding', 'because'], answer: 0 },
        { q: '___ being tired, he kept running.', options: ['Despite', 'Although', 'However', 'Because'], answer: 0, hint: 'Despite + gerundio' },
        { q: 'He speaks English ___ he were British.', options: ['as if', 'like if', 'so that', 'in case'], answer: 0 },
      ],
      pairs: [
        { es: 'con el fin de', en: 'in order to' },
        { es: 'a pesar de', en: 'in spite of' },
        { es: 'a menos que', en: 'unless' },
        { es: 'en caso de que', en: 'in case' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-w1', block: 'writing', title: 'Ensayos y argumentos', bookKey: 'straightforward-int-2012', difficulty: 0.8,
    content: {
      pairs: [
        { es: 'La tecnología ha cambiado la educación.', en: 'Technology has changed education.' },
        { es: 'Por un lado, facilita el acceso a la información.', en: 'On the one hand, it makes access to information easier.' },
        { es: 'Por otro lado, puede distraer a los estudiantes.', en: 'On the other hand, it can distract students.' },
        { es: 'En mi opinión, los beneficios son mayores.', en: 'In my opinion, the benefits are greater.' },
        { es: 'En resumen, hay que usarla con moderación.', en: 'In short, it must be used with moderation.' },
      ],
      order: [
        { words: ['argue', 'Some', 'that', 'people', 'it', 'is', 'safer'], answer: 'Some people argue that it is safer' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-w2', block: 'writing', title: 'Reseñas y correos formales', bookKey: 'straightforward-int-2012', difficulty: 0.85,
    content: {
      pairs: [
        { es: 'La película cuenta la historia de una familia.', en: 'The movie tells the story of a family.' },
        { es: 'Las actuaciones son sobresalientes.', en: 'The performances are outstanding.' },
        { es: 'Sin embargo, el final es predecible.', en: 'However, the ending is predictable.' },
        { es: 'Le recomiendo la película con reserva.', en: 'I recommend the movie with reservations.' },
        { es: 'Estimo su respuesta antes del viernes.', en: 'I look forward to your reply before Friday.' },
      ],
      order: [
        { words: ['I', 'writing', 'am', 'regarding', 'to', 'the', 'inquiry'], answer: 'I am writing to regarding the inquiry' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-s1', block: 'speaking', title: 'Defender una opinión', bookKey: 'speakout-a1-2022', difficulty: 0.8,
    content: {
      dialogue: [
        { es: 'Creo que el trabajo remoto es mejor.', en: 'I believe remote work is better.' },
        { es: '¿Cuáles son tus razones?', en: 'What are your reasons?' },
        { es: 'Se ahorra tiempo de transporte.', en: 'It saves commuting time.' },
        { es: 'Aun así, la oficina fomenta equipo.', en: 'Even so, the office builds teamwork.' },
        { es: 'Ambas opciones tienen ventajas.', en: 'Both options have advantages.' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-s2', block: 'speaking', title: 'Hablar varios minutos', bookKey: 'cutting-edge-elem-2013', difficulty: 0.85,
    content: {
      dialogue: [
        { es: 'Hoy voy a hablar sobre mi ciudad.', en: 'Today I am going to talk about my city.' },
        { es: 'Es conocida por su comida y su clima.', en: 'It is known for its food and its weather.' },
        { es: 'Lo que más me gusta es el centro histórico.', en: 'What I like the most is the historic center.' },
        { es: 'Sin embargo, el tráfico es un problema.', en: 'However, traffic is a problem.' },
        { es: 'En conclusión, es un gran lugar para vivir.', en: 'In conclusion, it is a great place to live.' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-s3', block: 'speaking', title: 'Situaciones hipotéticas', bookKey: 'english-file-beginner-2019', difficulty: 0.85,
    content: {
      dialogue: [
        { es: '¿Qué harías con un millón de pesos?', en: 'What would you do with a million pesos?' },
        { es: 'Si tuviera tanto dinero, viajaría por Asia.', en: 'If I had that much money, I would travel around Asia.' },
        { es: 'Yo abriría mi propio negocio.', en: 'I would open my own business.' },
        { es: '¿Dónde lo abrirías?', en: 'Where would you open it?' },
        { es: 'Probablemente en mi ciudad natal.', en: 'Probably in my hometown.' },
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-l1', block: 'listening', title: 'Conversaciones naturales', bookKey: 'collins-life-listening-2012', difficulty: 0.8,
    content: {
      dictation: [
        'She said the results would be ready by noon.',
        'The building was designed by a local architect.',
        'I used to live near the university.',
        'If I were you, I would accept the offer.',
        'The interview had already started when he arrived.',
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-l2', block: 'listening', title: 'Intención del hablante', bookKey: 'collins-life-listening-2012', difficulty: 0.85,
    content: {
      dictation: [
        'We regret to inform you that the event is cancelled.',
        'Congratulations! You have been selected for the program.',
        'Please note that prices are subject to change.',
        'The speaker will answer questions at the end.',
        'Listeners who join later can watch the recording online.',
      ],
    },
  },
  {
    moduleId: 7, lessonKey: 'm7-r1', block: 'review', title: 'Repaso del módulo 7', bookKey: 'empower-starter-2022', difficulty: 0.85,
    content: {
      mcq: [
        { q: 'The thieves ___ by the police last night.', options: ['were caught', 'caught', 'was caught', 'have caught'], answer: 0 },
        { q: 'He asked me ___ I needed help.', options: ['if', 'that', 'what', 'did'], answer: 0 },
      ],
      gap: [
        { text: 'If she had studied, she ___ passed. (would)', answer: 'would have' },
        { text: 'There ___ to be more trees in this park.', answer: 'used' },
      ],
      pairs: [
        { es: 'Me dijeron que la reunión era hoy.', en: 'I was told that the meeting was today.' },
        { es: 'Si tuviera tiempo, aprendería otro idioma.', en: 'If I had time, I would learn another language.' },
      ],
      reading: [{
        title: 'La decisión de Ricardo',
        text: 'Ricardo had always wanted to be a chef, but his parents had sent him to business school. After graduating, he worked in a bank for three years. One evening, while he was watching a cooking show, he realized he was not happy. If he had followed his passion earlier, he would have saved a lot of time, but he does not regret his studies completely: today he runs a restaurant where the business skills he learned help him every day.',
        questions: [
          { q: 'What did Ricardo study?', options: ['Business', 'Cooking', 'Design', 'Nothing'], answer: 0 },
          { q: 'What does he do now?', options: ['He runs a restaurant', 'He works in a bank', 'He hosts a show', 'He studies'], answer: 0 },
        ],
      }],
    },
  },
]
