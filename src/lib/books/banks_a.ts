// Bancos de ejercicios originales — módulos 1 a 3 (A1.1, A1.2, A1+).
// Alcance didáctico según «Modulos ingles Axiom.pdf»; contenido redactado
// de forma original por Axiom (ver política en el PDF técnico).
import type { BankDef } from './types'

export const BANKS_A: BankDef[] = [
  // ===== MÓDULO 1 — A1.1 Supervivencia lingüística =====
  {
    moduleId: 1, lessonKey: 'm1-g1', block: 'grammar', title: 'Pronombres y verbo to be', bookKey: 'murphy-essential-2015', difficulty: 0.15,
    content: {
      mcq: [
        { q: '___ am a student.', options: ['I', 'He', 'She', 'They'], answer: 0, hint: 'Primera persona singular' },
        { q: 'She ___ my teacher.', options: ['is', 'am', 'are', 'be'], answer: 0 },
        { q: 'They ___ from Mexico.', options: ['are', 'is', 'am', 'be'], answer: 0 },
      ],
      gap: [
        { text: 'You ___ my friend.', answer: 'are' },
        { text: 'I ___ happy today.', answer: 'am' },
        { text: 'He ___ a doctor.', answer: 'is' },
      ],
      order: [
        { words: ['is', 'name', 'My', 'Ana'], answer: 'My name is Ana' },
        { words: ['am', 'I', 'from', 'Mexico'], answer: 'I am from Mexico' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-g2', block: 'grammar', title: 'Artículos, sustantivos y demostrativos', bookKey: 'murphy-essential-2015', difficulty: 0.2,
    content: {
      mcq: [
        { q: 'This is ___ apple.', options: ['an', 'a', 'the', 'some'], answer: 0, hint: 'Empieza con sonido de vocal' },
        { q: '___ books are new.', options: ['These', 'This', 'That', 'It'], answer: 0 },
        { q: 'I have two ___.', options: ['children', 'childs', 'childrens', 'child'], answer: 0, hint: 'Plural irregular' },
      ],
      gap: [
        { text: '___ is my pen, here on the desk.', answer: 'This', hint: 'cerca (singular)' },
        { text: 'Look at ___ birds in the sky.', answer: 'those', hint: 'lejos (plural)' },
        { text: 'She is ___ engineer.', answer: 'an' },
      ],
      order: [
        { words: ['are', 'These', 'my', 'keys'], answer: 'These are my keys' },
        { words: ['is', 'That', 'your', 'bag'], answer: 'That is your bag' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-g3', block: 'grammar', title: 'Posesivos, preguntas y There is/are', bookKey: 'eastwood-opg-2019', difficulty: 0.25,
    content: {
      mcq: [
        { q: '___ is your name?', options: ['What', 'Who', 'Where', 'How'], answer: 0 },
        { q: 'This is ___ car.', options: ['Juan\'s', 'Juan', 'Juans\'', 'of Juan'], answer: 0, hint: 'Posesivo con \'s' },
        { q: '___ there a bank near here?', options: ['Is', 'Are', 'Am', 'Be'], answer: 0 },
      ],
      gap: [
        { text: '___ are my keys? — On the table.', answer: 'Where' },
        { text: 'There ___ two windows in the room.', answer: 'are' },
        { text: 'This is ___ brother. (de ella)', answer: 'her' },
      ],
      order: [
        { words: ['is', 'There', 'a', 'cat', 'here'], answer: 'There is a cat here' },
        { words: ['old', 'How', 'you', 'are'], answer: 'How old are you' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-v1', block: 'vocab', title: 'Vocabulario de presentación personal', bookKey: 'vocab-in-use-elem-2017', difficulty: 0.15,
    content: {
      pairs: [
        { es: 'el país', en: 'the country' },
        { es: 'la nacionalidad', en: 'the nationality' },
        { es: 'el ingeniero', en: 'the engineer' },
        { es: 'la maestra', en: 'the teacher' },
        { es: 'la dirección', en: 'the address' },
        { es: 'casado', en: 'married' },
      ],
      mcq: [
        { q: 'How do you say «ocupación» in English?', options: ['job', 'nationality', 'address', 'country'], answer: 0 },
        { q: '«Where are you from?» asks about your…', options: ['nationality', 'age', 'family', 'job'], answer: 0 },
        { q: 'Completa: I ___ 25 years old.', options: ['am', 'have', 'is', 'are'], answer: 0, hint: 'En inglés la edad se dice con to be' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-v2', block: 'vocab', title: 'Sonidos básicos del inglés', bookKey: 'ship-or-sheep-2006', difficulty: 0.2,
    content: {
      mcq: [
        { q: 'Which word has the long sound /iː/?', options: ['sheep', 'ship', 'sit', 'chip'], answer: 0 },
        { q: '«ship» and «sheep» differ in…', options: ['the vowel sound', 'the final consonant', 'the stress', 'nothing'], answer: 0 },
        { q: 'How do you say «hermana» in English?', options: ['sister', 'brother', 'mother', 'daughter'], answer: 0 },
      ],
      pairs: [
        { es: 'el hermano', en: 'the brother' },
        { es: 'el padre', en: 'the father' },
        { es: 'la madre', en: 'the mother' },
        { es: 'la familia', en: 'the family' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-w1', block: 'writing', title: 'Datos personales y formularios', bookKey: 'english-file-beginner-2019', difficulty: 0.2,
    content: {
      pairs: [
        { es: 'Me llamo David.', en: 'My name is David.' },
        { es: 'Tengo veinticinco años.', en: 'I am twenty-five years old.' },
        { es: 'Soy de México.', en: 'I am from Mexico.' },
        { es: 'Mi correo es ana@mail.com.', en: 'My email is ana@mail.com.' },
        { es: 'No estoy casado.', en: 'I am not married.' },
      ],
      order: [
        { words: ['am', 'I', 'a', 'student'], answer: 'I am a student' },
        { words: ['is', 'What', 'your', 'phone', 'number'], answer: 'What is your phone number' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-w2', block: 'writing', title: 'Describir personas y lugares', bookKey: 'headway-beginner-2019', difficulty: 0.25,
    content: {
      pairs: [
        { es: 'Ella es alta y simpática.', en: 'She is tall and friendly.' },
        { es: 'La casa es grande y vieja.', en: 'The house is big and old.' },
        { es: 'El gato está debajo de la mesa.', en: 'The cat is under the table.' },
        { es: 'Mi ciudad es pequeña pero bonita.', en: 'My city is small but beautiful.' },
        { es: 'Hay un parque cerca de aquí.', en: 'There is a park near here.' },
      ],
      order: [
        { words: ['is', 'The', 'book', 'on', 'the', 'table'], answer: 'The book is on the table' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-s1', block: 'speaking', title: 'Saludar y presentarse', bookKey: 'speakout-a1-2022', difficulty: 0.15,
    content: {
      dialogue: [
        { es: 'Hola, ¿cómo estás?', en: 'Hello, how are you?' },
        { es: 'Bien, gracias. ¿Y tú?', en: 'Fine, thanks. And you?' },
        { es: '¿Cómo te llamas?', en: 'What is your name?' },
        { es: 'Me llamo Laura. Mucho gusto.', en: 'My name is Laura. Nice to meet you.' },
        { es: '¡Nos vemos mañana!', en: 'See you tomorrow!' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-s2', block: 'speaking', title: 'Dar información personal', bookKey: 'speakout-a1-2022', difficulty: 0.2,
    content: {
      dialogue: [
        { es: '¿Cuántos años tienes?', en: 'How old are you?' },
        { es: 'Tengo treinta años.', en: 'I am thirty years old.' },
        { es: '¿Cuál es tu trabajo?', en: 'What is your job?' },
        { es: 'Soy ingeniero.', en: 'I am an engineer.' },
        { es: '¿De dónde eres?', en: 'Where are you from?' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-s3', block: 'speaking', title: 'Identificar personas y objetos', bookKey: 'english-file-beginner-2019', difficulty: 0.25,
    content: {
      dialogue: [
        { es: '¿Quién es él?', en: 'Who is he?' },
        { es: 'Él es mi hermano.', en: 'He is my brother.' },
        { es: '¿Qué es eso?', en: 'What is that?' },
        { es: 'Es una computadora nueva.', en: 'It is a new computer.' },
        { es: 'Estos son mis libros.', en: 'These are my books.' },
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-l1', block: 'listening', title: 'Nombres, números y saludos', bookKey: 'navigate-a1-2016', difficulty: 0.15,
    content: {
      dictation: [
        'My name is Carlos.',
        'I am from Peru.',
        'She is my teacher.',
        'Good morning, everyone.',
        'There are four chairs.',
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-l2', block: 'listening', title: 'Instrucciones y preguntas básicas', bookKey: 'navigate-a1-2016', difficulty: 0.25,
    content: {
      dictation: [
        'Open the door, please.',
        'Where is the station?',
        'This is my phone number.',
        'The hotel is next to the bank.',
        'How old is your sister?',
      ],
    },
  },
  {
    moduleId: 1, lessonKey: 'm1-r1', block: 'review', title: 'Repaso del módulo 1', bookKey: 'empower-starter-2022', difficulty: 0.25,
    content: {
      mcq: [
        { q: '___ your parents at home?', options: ['Are', 'Is', 'Am', 'Be'], answer: 0 },
        { q: 'The pens are ___ the drawer.', options: ['in', 'on', 'under', 'at'], answer: 0 },
      ],
      gap: [
        { text: '___ they from Brazil?', answer: 'Are' },
        { text: 'There ___ a lamp on the desk.', answer: 'is' },
      ],
      pairs: [
        { es: 'Mi hermana es maestra.', en: 'My sister is a teacher.' },
        { es: '¿Dónde está el baño?', en: 'Where is the bathroom?' },
      ],
      reading: [{
        title: 'Marta presenta a su familia',
        text: 'Hi! My name is Marta. I am from Colombia. I am a student. My family is small: my mother, my father and my brother. Our house is small but beautiful. There is a big tree in front of the house.',
        questions: [
          { q: 'Where is Marta from?', options: ['Colombia', 'Mexico', 'Peru', 'Spain'], answer: 0 },
          { q: 'How many people are in her family?', options: ['Three', 'Four', 'Five', 'Two'], answer: 0 },
        ],
      }],
    },
  },

  // ===== MÓDULO 2 — A1.2 Vida cotidiana básica =====
  {
    moduleId: 2, lessonKey: 'm2-g1', block: 'grammar', title: 'Present Simple y tercera persona', bookKey: 'murphy-essential-2015', difficulty: 0.3,
    content: {
      mcq: [
        { q: 'He ___ in a bank.', options: ['works', 'work', 'working', 'is work'], answer: 0, hint: 'Tercera persona: -s' },
        { q: '___ you like coffee?', options: ['Do', 'Does', 'Are', 'Is'], answer: 0 },
        { q: 'She ___ eat meat.', options: ['doesn\'t', 'don\'t', 'isn\'t', 'not'], answer: 0 },
      ],
      gap: [
        { text: 'My father ___ TV every night. (watch)', answer: 'watches' },
        { text: '___ they live in Lima?', answer: 'Do' },
        { text: 'Ana ___ to school by bus. (go)', answer: 'goes' },
      ],
      order: [
        { words: ['does', 'What', 'time', 'start', 'it'], answer: 'What time does it start' },
        { words: ['don\'t', 'We', 'on', 'work', 'Sundays'], answer: 'We don\'t work on Sundays' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-g2', block: 'grammar', title: 'Have got y capacidad con can', bookKey: 'eastwood-opg-2019', difficulty: 0.3,
    content: {
      mcq: [
        { q: 'I ___ two brothers.', options: ['have got', 'has got', 'am got', 'does have'], answer: 0 },
        { q: 'She ___ swim very well.', options: ['can', 'cans', 'can to', 'does can'], answer: 0 },
        { q: '___ he play the guitar?', options: ['Can', 'Cans', 'Does can', 'Is'], answer: 0 },
      ],
      gap: [
        { text: 'My sister ___ got a new bike.', answer: 'has' },
        { text: 'I ___ drive, but I can\'t fly a plane.', answer: 'can' },
        { text: 'We ___ got time today.', answer: 'haven\'t' },
      ],
      order: [
        { words: ['can', 'you', 'the', 'play', 'piano'], answer: 'Can you play the piano' },
        { words: ['got', 'I', 'a', 'haven\'t', 'car'], answer: 'I haven\'t got a car' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-g3', block: 'grammar', title: 'Cuantificadores y comparativos', bookKey: 'cobuild-grammar-2017', difficulty: 0.35,
    content: {
      mcq: [
        { q: 'There is ___ milk in the fridge.', options: ['some', 'a', 'an', 'many'], answer: 0, hint: 'Incontable en afirmativo' },
        { q: 'How ___ sugar do you want?', options: ['much', 'many', 'lot', 'few'], answer: 0 },
        { q: 'An elephant is ___ than a dog.', options: ['bigger', 'big', 'biggest', 'more big'], answer: 0 },
      ],
      gap: [
        { text: 'Are there ___ apples left?', answer: 'any' },
        { text: 'I don\'t have ___ money.', answer: 'much' },
        { text: 'Today is ___ than yesterday. (hot)', answer: 'hotter' },
      ],
      order: [
        { words: ['many', 'How', 'do', 'want', 'you', 'eggs'], answer: 'How many eggs do you want' },
        { words: ['cheaper', 'This', 'is', 'that', 'one', 'than'], answer: 'This is cheaper than that one' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-v1', block: 'vocab', title: 'Rutinas, comida y compras', bookKey: 'vocab-in-use-elem-2017', difficulty: 0.3,
    content: {
      pairs: [
        { es: 'despertarse', en: 'to wake up' },
        { es: 'el desayuno', en: 'breakfast' },
        { es: 'la tienda', en: 'the shop' },
        { es: 'el mercado', en: 'the market' },
        { es: 'siempre', en: 'always' },
        { es: 'el precio', en: 'the price' },
      ],
      mcq: [
        { q: 'You buy bread at the…', options: ['bakery', 'library', 'hospital', 'airport'], answer: 0 },
        { q: 'The opposite of «always» is…', options: ['never', 'usually', 'often', 'sometimes'], answer: 0 },
        { q: '«Have lunch» means…', options: ['comer el almuerzo', 'desayunar', 'cenar tarde', 'hacer la compra'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-v2', block: 'vocab', title: 'Ritmo y frecuencia', bookKey: 'word-skills-elem-2020', difficulty: 0.35,
    content: {
      mcq: [
        { q: 'I go to the gym ___ a week (three times).', options: ['three times', 'three', 'third', 'thrice'], answer: 0 },
        { q: 'Choose the correct order: …', options: ['I usually get up at seven.', 'I get usually up at seven.', 'Usually I at seven get up.', 'I at seven usually get up.'], answer: 0, hint: 'El adverbio va antes del verbo principal' },
        { q: '«on Mondays» means…', options: ['los lunes', 'el lunes', 'para el lunes', 'desde el lunes'], answer: 0 },
      ],
      pairs: [
        { es: 'de vez en cuando', en: 'from time to time' },
        { es: 'los fines de semana', en: 'at weekends' },
        { es: 'por la mañana', en: 'in the morning' },
        { es: 'de lunes a viernes', en: 'from Monday to Friday' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-w1', block: 'writing', title: 'Rutinas y mensajes cortos', bookKey: 'english-file-beginner-2019', difficulty: 0.3,
    content: {
      pairs: [
        { es: 'Me despierto a las seis.', en: 'I wake up at six.' },
        { es: 'Ella trabaja los sábados.', en: 'She works on Saturdays.' },
        { es: '¿A qué hora desayunas?', en: 'What time do you have breakfast?' },
        { es: 'No como carne.', en: 'I don\'t eat meat.' },
        { es: 'Salgo de casa a las ocho.', en: 'I leave home at eight.' },
      ],
      order: [
        { words: ['usually', 'He', 'home', 'at', 'is'], answer: 'He is usually at home' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-w2', block: 'writing', title: 'Correos informales y familia', bookKey: 'headway-beginner-2019', difficulty: 0.35,
    content: {
      pairs: [
        { es: 'Mi hermano tiene diez años.', en: 'My brother is ten years old.' },
        { es: 'Mis padres viven en Guadalajara.', en: 'My parents live in Guadalajara.' },
        { es: '¿Cómo está tu familia?', en: 'How is your family?' },
        { es: 'Escribo este correo para saludarte.', en: 'I write this email to say hello.' },
        { es: 'Espero verte pronto.', en: 'I hope to see you soon.' },
      ],
      order: [
        { words: ['got', 'She', 'a', 'has', 'dog'], answer: 'She has got a dog' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-s1', block: 'speaking', title: 'Hablar de tu rutina', bookKey: 'speakout-a1-2022', difficulty: 0.3,
    content: {
      dialogue: [
        { es: 'Me levanto temprano todos los días.', en: 'I get up early every day.' },
        { es: '¿A qué hora terminas de trabajar?', en: 'What time do you finish work?' },
        { es: 'Termino a las cinco y media.', en: 'I finish at half past five.' },
        { es: 'Los domingos descanso.', en: 'On Sundays I rest.' },
        { es: '¿Sabes cocinar?', en: 'Can you cook?' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-s2', block: 'speaking', title: 'Gustos, comida y compras', bookKey: 'cutting-edge-elem-2013', difficulty: 0.35,
    content: {
      dialogue: [
        { es: 'Me gusta el café con leche.', en: 'I like coffee with milk.' },
        { es: '¿Cuánto cuesta esto?', en: 'How much is this?' },
        { es: 'Quiero un kilo de manzanas, por favor.', en: 'I want a kilo of apples, please.' },
        { es: 'No me gusta el pescado.', en: 'I don\'t like fish.' },
        { es: '¿Aceptan tarjeta?', en: 'Do you accept cards?' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-s3', block: 'speaking', title: 'Conversaciones breves', bookKey: 'english-file-beginner-2019', difficulty: 0.35,
    content: {
      dialogue: [
        { es: '¿Tienes hermanos?', en: 'Do you have any brothers or sisters?' },
        { es: 'Sí, tengo una hermana.', en: 'Yes, I have one sister.' },
        { es: '¿Qué haces los fines de semana?', en: 'What do you do at weekends?' },
        { es: 'Voy al cine con mis amigos.', en: 'I go to the cinema with my friends.' },
        { es: '¡Qué bien! Yo también.', en: 'That\'s nice! Me too.' },
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-l1', block: 'listening', title: 'Rutinas y horarios', bookKey: 'navigate-a1-2016', difficulty: 0.3,
    content: {
      dictation: [
        'I get up at seven every day.',
        'She works from Monday to Friday.',
        'The bus leaves at half past eight.',
        'He never eats breakfast at home.',
        'We start work at nine o\'clock.',
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-l2', block: 'listening', title: 'Compras y restaurantes', bookKey: 'collins-life-listening-2012', difficulty: 0.35,
    content: {
      dictation: [
        'How much is this shirt?',
        'I would like a chicken sandwich.',
        'The shop opens at ten in the morning.',
        'Can I pay by card?',
        'A table for two, please.',
      ],
    },
  },
  {
    moduleId: 2, lessonKey: 'm2-r1', block: 'review', title: 'Repaso del módulo 2', bookKey: 'empower-starter-2022', difficulty: 0.35,
    content: {
      mcq: [
        { q: 'My mother ___ coffee every morning.', options: ['drinks', 'drink', 'is drink', 'drinking'], answer: 0 },
        { q: 'There aren\'t ___ eggs in the box.', options: ['any', 'some', 'much', 'a'], answer: 0 },
      ],
      gap: [
        { text: '___ your brother speak English?', answer: 'Does' },
        { text: 'I have got ___ friends here. (dos o tres)', answer: 'some' },
      ],
      pairs: [
        { es: 'Ella siempre llega temprano.', en: 'She always arrives early.' },
        { es: '¿Cuánto cuesta el billete?', en: 'How much is the ticket?' },
      ],
      reading: [{
        title: 'Un día con Pablo',
        text: 'Pablo is a waiter. He gets up at nine in the morning because he works at night. He has breakfast with his family and then he sleeps for one hour. In the afternoon, he goes to the market with his sister. On Saturdays, the restaurant is full and he finishes very late, but he likes his job because he meets a lot of people.',
        questions: [
          { q: 'When does Pablo work?', options: ['At night', 'In the morning', 'Only weekends', 'He doesn\'t work'], answer: 0 },
          { q: 'Why does he like his job?', options: ['He meets a lot of people', 'It is easy', 'It pays well', 'He sleeps a lot'], answer: 0 },
        ],
      }],
    },
  },

  // ===== MÓDULO 3 — A1+ Expansión de A1 =====
  {
    moduleId: 3, lessonKey: 'm3-g1', block: 'grammar', title: 'Present Continuous', bookKey: 'murphy-essential-2015', difficulty: 0.4,
    content: {
      mcq: [
        { q: 'Look! It ___ outside.', options: ['is raining', 'rains', 'rain', 'raining'], answer: 0 },
        { q: 'What ___ you doing?', options: ['are', 'is', 'do', 'does'], answer: 0 },
        { q: 'They ___ working today. It\'s a holiday.', options: ['aren\'t', 'don\'t', 'isn\'t', 'not are'], answer: 0 },
      ],
      gap: [
        { text: 'I ___ reading a good book now.', answer: 'am' },
        { text: 'She ___ cooking dinner at the moment.', answer: 'is' },
        { text: 'We ___ studying for the exam this week.', answer: 'are' },
      ],
      order: [
        { words: ['is', 'The', 'sleeping', 'baby'], answer: 'The baby is sleeping' },
        { words: ['doing', 'What', 'are', 'they'], answer: 'What are they doing' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-g2', block: 'grammar', title: 'Pasado de to be y Past Simple', bookKey: 'murphy-essential-2015', difficulty: 0.4,
    content: {
      mcq: [
        { q: 'I ___ at home yesterday.', options: ['was', 'were', 'am', 'is'], answer: 0 },
        { q: 'We ___ very tired last night.', options: ['were', 'was', 'are', 'is'], answer: 0 },
        { q: 'She ___ to Paris in 2019.', options: ['went', 'goes', 'go', 'goed'], answer: 0, hint: 'Irregular: go → went' },
      ],
      gap: [
        { text: 'They ___ the film last weekend. (see)', answer: 'saw' },
        { text: '___ you visit your grandmother last Sunday?', answer: 'Did' },
        { text: 'He didn\'t ___ the email. (send)', answer: 'send' },
      ],
      order: [
        { words: ['was', 'The', 'beautiful', 'party'], answer: 'The party was beautiful' },
        { words: ['did', 'you', 'Where', 'go'], answer: 'Where did you go' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-g3', block: 'grammar', title: 'Comparativos y conectores', bookKey: 'eastwood-opg-2019', difficulty: 0.45,
    content: {
      mcq: [
        { q: 'This bag is ___ expensive than that one.', options: ['more', 'much', 'most', 'many'], answer: 0 },
        { q: 'She is the ___ student in the class.', options: ['best', 'better', 'goodest', 'more good'], answer: 0 },
        { q: 'I stayed home ___ it was raining.', options: ['because', 'so', 'but', 'or'], answer: 0 },
      ],
      gap: [
        { text: 'The test was ___ difficult for me. (demasiado)', answer: 'too' },
        { text: 'Is the water ___ to swim? (suficientemente caliente)', answer: 'warm enough' },
        { text: 'He was tired, ___ he kept working.', answer: 'but' },
      ],
      order: [
        { words: ['the', 'is', 'This', 'cheapest', 'hotel'], answer: 'This is the cheapest hotel' },
        { words: ['so', 'It', 'stayed', 'late,', 'was', 'we', 'up'], answer: 'It was late, so we stayed up' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-v1', block: 'vocab', title: 'Viajes y experiencias', bookKey: 'vocab-in-use-preint-2017', difficulty: 0.4,
    content: {
      pairs: [
        { es: 'el equipaje', en: 'the luggage' },
        { es: 'la maleta', en: 'the suitcase' },
        { es: 'el vuelo', en: 'the flight' },
        { es: 'la foto', en: 'the photo' },
        { es: 'el recuerdo', en: 'the memory' },
        { es: 'la playa', en: 'the beach' },
      ],
      mcq: [
        { q: 'You take a plane from the…', options: ['airport', 'station', 'port', 'garage'], answer: 0 },
        { q: '«sightseeing» means…', options: ['visitar lugares turísticos', 'comprar regalos', 'descansar en el hotel', 'tomar fotos'], answer: 0 },
        { q: 'A «trip» is…', options: ['un viaje', 'un boleto', 'una maleta', 'un mapa'], answer: 0 },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-v2', block: 'vocab', title: 'Pronombres indefinidos', bookKey: 'cobuild-grammar-2017', difficulty: 0.45,
    content: {
      mcq: [
        { q: '___ knocked at the door, but I don\'t know who.', options: ['Someone', 'Anyone', 'No one', 'Everyone'], answer: 0 },
        { q: 'Is there ___ I can help you with?', options: ['anything', 'something', 'nothing', 'everything'], answer: 0 },
        { q: '___ enjoyed the party. It was great!', options: ['Everybody', 'Nobody', 'Anybody', 'No one'], answer: 0 },
      ],
      pairs: [
        { es: 'alguien', en: 'someone' },
        { es: 'nadie', en: 'nobody' },
        { es: 'cualquier cosa', en: 'anything' },
        { es: 'todo el mundo', en: 'everybody' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-w1', block: 'writing', title: 'Narrar acontecimientos simples', bookKey: 'cutting-edge-elem-2013', difficulty: 0.4,
    content: {
      pairs: [
        { es: 'El fin de semana pasado viajé a Oaxaca.', en: 'Last weekend I traveled to Oaxaca.' },
        { es: 'Visité un museo muy interesante.', en: 'I visited a very interesting museum.' },
        { es: 'Comimos en un restaurante tradicional.', en: 'We ate at a traditional restaurant.' },
        { es: 'El viaje fue corto pero increíble.', en: 'The trip was short but amazing.' },
        { es: 'No pude tomar muchas fotos.', en: 'I couldn\'t take many photos.' },
      ],
      order: [
        { words: ['was', 'The', 'last', 'trip', 'year'], answer: 'The trip was last year' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-w2', block: 'writing', title: 'Describir y comparar', bookKey: 'straightforward-int-2012', difficulty: 0.45,
    content: {
      pairs: [
        { es: 'En la foto hay dos personas.', en: 'In the photo there are two people.' },
        { es: 'La mujer lleva un vestido azul.', en: 'The woman is wearing a blue dress.' },
        { es: 'Mi ciudad es más grande que la tuya.', en: 'My city is bigger than yours.' },
        { es: 'Este café es mejor que el otro.', en: 'This coffee is better than the other one.' },
        { es: 'Ambos lugares son muy bonitos.', en: 'Both places are very beautiful.' },
      ],
      order: [
        { words: ['than', 'She', 'runs', 'her', 'faster', 'brother'], answer: 'She runs faster than her brother' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-s1', block: 'speaking', title: 'Experiencias pasadas', bookKey: 'speakout-a1-2022', difficulty: 0.4,
    content: {
      dialogue: [
        { es: '¿Qué hiciste el fin de semana?', en: 'What did you do at the weekend?' },
        { es: 'Fui a la playa con mi familia.', en: 'I went to the beach with my family.' },
        { es: '¿Te divertiste?', en: 'Did you have fun?' },
        { es: 'Sí, fue un día perfecto.', en: 'Yes, it was a perfect day.' },
        { es: '¿Tomaste fotos?', en: 'Did you take photos?' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-s2', block: 'speaking', title: 'Comparar y opinar', bookKey: 'cutting-edge-elem-2013', difficulty: 0.45,
    content: {
      dialogue: [
        { es: 'Prefiero el té al café.', en: 'I prefer tea to coffee.' },
        { es: '¿Por qué te gusta más?', en: 'Why do you like it more?' },
        { es: 'Porque es más tranquilo.', en: 'Because it is calmer.' },
        { es: 'Creo que este es mejor.', en: 'I think this one is better.' },
        { es: 'No estoy de acuerdo, pero vale.', en: 'I don\'t agree, but okay.' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-s3', block: 'speaking', title: 'Planes y conversación larga', bookKey: 'english-file-beginner-2019', difficulty: 0.45,
    content: {
      dialogue: [
        { es: '¿Qué vas a hacer mañana?', en: 'What are you going to do tomorrow?' },
        { es: 'Voy a visitar a mis abuelos.', en: 'I am going to visit my grandparents.' },
        { es: '¿Quieres venir conmigo?', en: 'Do you want to come with me?' },
        { es: 'Claro, me encantaría.', en: 'Sure, I would love that.' },
        { es: 'Entonces nos vemos a las diez.', en: 'Then I will see you at ten.' },
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-l1', block: 'listening', title: 'Conversaciones sobre experiencias', bookKey: 'collins-life-listening-2012', difficulty: 0.4,
    content: {
      dictation: [
        'I was in Chile last summer.',
        'They visited the museum yesterday.',
        'She didn\'t like the hotel.',
        'We were very tired after the trip.',
        'He bought a souvenir for his mother.',
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-l2', block: 'listening', title: 'Información específica', bookKey: 'navigate-a1-2016', difficulty: 0.45,
    content: {
      dictation: [
        'The train leaves at four fifteen.',
        'My flight number is AB two three zero.',
        'The meeting is on Tuesday at noon.',
        'Call me when you arrive at the hotel.',
        'The tickets cost eighty dollars.',
      ],
    },
  },
  {
    moduleId: 3, lessonKey: 'm3-r1', block: 'review', title: 'Repaso del módulo 3', bookKey: 'empower-starter-2022', difficulty: 0.45,
    content: {
      mcq: [
        { q: 'Be quiet! The baby ___.', options: ['is sleeping', 'sleeps', 'slept', 'sleep'], answer: 0 },
        { q: 'I ___ my keys yesterday.', options: ['lost', 'lose', 'loses', 'am losing'], answer: 0 },
      ],
      gap: [
        { text: 'They ___ at the party last night. (divertirse, were + adjetivo)', answer: 'happy' },
        { text: 'Is this jacket ___ than mine? (small)', answer: 'smaller' },
      ],
      pairs: [
        { es: 'Estoy estudiando para el examen.', en: 'I am studying for the exam.' },
        { es: '¿Fuiste a la fiesta anoche?', en: 'Did you go to the party last night?' },
      ],
      reading: [{
        title: 'Un viaje a la costa',
        text: 'Last March, Daniel and his friends took a bus to the coast. The trip was long, but they were excited. They stayed in a small hotel near the beach. Every morning they swam in the sea, and in the evenings they walked around the town. The food was cheap and delicious. Daniel says it was the best trip of his life, and he wants to go back next year with more friends.',
        questions: [
          { q: 'How did they travel?', options: ['By bus', 'By plane', 'By car', 'By train'], answer: 0 },
          { q: 'What did they do every morning?', options: ['They swam in the sea', 'They cooked', 'They slept', 'They worked'], answer: 0 },
        ],
      }],
    },
  },
]
