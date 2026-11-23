// R15 — Mini-lecciones CLIL «Vida en el Reino Unido» (contenido y lengua
// integrados). Cada módulo tiene un texto cultural propio; se usa en la
// sesión de repaso (nodo r1) como «Proyecto de la semana». El alumno aprende
// SOBRE el mundo angloparlante EN inglés, como en una escuela británica.
// Contenido original de Axiom.

import type { McqItem } from './types'

export interface ClilText {
  title: string
  text: string
  questions: McqItem[]
}

export const CLIL_TEXTS: Record<string, ClilText> = {
  m1: {
    title: 'A Full English Breakfast',
    text: 'In England, many people love a "full English breakfast": eggs, bacon, sausages, beans and toast. It is a big meal! But breakfast is fast for many workers: only tea and toast before the bus. In cafés, you can order a full English all day. Is it healthy? Not every day! But on Sunday, families enjoy it slowly, with the radio on.',
    questions: [
      { q: 'What is NOT in a full English breakfast?', options: ['beans', 'eggs', 'rice', 'bacon'], answer: 2 },
      { q: 'What do many workers have for breakfast?', options: ['tea and toast', 'a big meal', 'sausages', 'eggs and bacon'], answer: 0 },
      { q: 'When do families enjoy the big breakfast?', options: ['on Sunday', 'before work', 'in cafés', 'at night'], answer: 0 },
    ],
  },
  m2: {
    title: 'Shops and Queues',
    text: 'In York, there is a market six days a week. People buy fruit, fish, cheese and flowers. Supermarkets are open until late, but small shops close at five. On Sundays, many shops open only for four hours. And there is one golden rule in Britain: you always queue. People queue for the bus and for bread. Everyone waits for their turn — and jumping the queue is very rude!',
    questions: [
      { q: 'How many days a week is the York market open?', options: ['five', 'six', 'seven', 'four'], answer: 1 },
      { q: 'When do many shops open on Sundays?', options: ['all day', 'never', 'for four hours', 'until late'], answer: 2 },
      { q: 'What is "jumping the queue"?', options: ['waiting your turn', 'not waiting your turn', 'buying bread', 'closing early'], answer: 1 },
    ],
  },
  m3: {
    title: 'The British Seaside',
    text: 'England has a sea everywhere: you are never far from the beach. Towns like Whitby are famous for fish and chips by the harbour. At the seaside, people walk on the pier, eat ice cream and take photos of seagulls — careful, they love your food! The water is cold, even in summer, but the bravest swim anyway. A day at the seaside is a classic British adventure.',
    questions: [
      { q: 'What is Whitby famous for?', options: ['fish and chips', 'mountains', 'deserts', 'skiing'], answer: 0 },
      { q: 'Why are seagulls a problem?', options: ['they sing at night', 'they love your food', 'they are expensive', 'they close the pier'], answer: 1 },
      { q: 'How is the water, even in summer?', options: ['hot', 'warm', 'cold', 'frozen'], answer: 2 },
    ],
  },
  m4: {
    title: 'Bank Holidays',
    text: 'England has special Mondays called "bank holidays": nobody works, and banks close. People travel, visit family or paint the house. Traffic is heavy, trains are full and the weather is a national joke: "If the sun comes out, everyone goes to the park!" On a bank holiday, parks are full of blankets, games and sandwiches. One day off, a million plans.',
    questions: [
      { q: 'What is a bank holiday?', options: ['a bank job', 'a free Monday', 'a music festival', 'a type of train'], answer: 1 },
      { q: 'What is the weather on bank holidays?', options: ['always sunny', 'a national joke', 'always snowy', 'perfect'], answer: 1 },
      { q: 'Where do people go if the sun comes out?', options: ['to work', 'to the bank', 'to the park', 'to bed'], answer: 2 },
    ],
  },
  m5: {
    title: 'The Cuppa',
    text: 'Tea is more than a drink in Britain — it is a language. People drink tea when they are happy, sad, tired or excited. "Put the kettle on" means: something happened, let\'s talk. A proper tea needs boiling water, a minute of patience and usually a splash of milk. Milk first or milk last? That is the great British debate — and people have very strong opinions!',
    questions: [
      { q: 'What does "Put the kettle on" mean?', options: ['let\'s talk', 'goodbye', 'I am angry', 'time to sleep'], answer: 0 },
      { q: 'What do many British people add to tea?', options: ['lemon juice', 'milk', 'salt', 'orange'], answer: 1 },
      { q: 'What is the great British debate?', options: ['milk first or last', 'tea or coffee', 'sugar or honey', 'cup or mug'], answer: 0 },
    ],
  },
  m6: {
    title: 'The Pub',
    text: 'The pub is a British living room. Families come on Sunday for a roast dinner, and friends meet after work. Here is the big difference with restaurants: you order at the bar — there is no table service! Classic food includes fish and chips, pie and mash, and a Sunday roast with Yorkshire pudding. In winter, there is a warm fire. In family pubs, children are welcome until the evening.',
    questions: [
      { q: 'Where do you order in a pub?', options: ['at the table', 'at the bar', 'by phone', 'at the door'], answer: 1 },
      { q: 'What is a Sunday roast?', options: ['a family meal', 'a sport', 'a TV show', 'a drink'], answer: 0 },
      { q: 'Who is welcome in family pubs?', options: ['nobody', 'only adults', 'children until the evening', 'dogs only'], answer: 2 },
    ],
  },
  m7: {
    title: 'The Weather Talk',
    text: 'In England, the weather is a conversation. "Lovely day!" means hello. It can rain four times in one afternoon — sun, clouds, rain, sun. People carry umbrellas everywhere and complain with a smile. The famous London fog is mostly history now, but the rain is very real. There is a golden rule: if you don\'t like the weather, wait five minutes!',
    questions: [
      { q: 'What does "Lovely day!" often mean?', options: ['goodbye', 'hello', 'I am angry', 'it is raining'], answer: 1 },
      { q: 'How many times can it rain in one afternoon?', options: ['never', 'once', 'four times', 'only at night'], answer: 2 },
      { q: 'What is the golden rule about British weather?', options: ['it never changes', 'wait five minutes', 'always snows', 'you need sunglasses'], answer: 1 },
    ],
  },
  m8: {
    title: 'The National Game',
    text: 'Football is the most popular sport in England. Every town has a club, and every club has colours: red, white, blue and gold. On Saturday afternoons, stadiums sing — the fans know a hundred songs! The Premier League is watched all over the world, but the heart of football is local: fathers and daughters in scarves, Sunday leagues in the park, and a ball behind every car.',
    questions: [
      { q: 'When do stadiums "sing"?', options: ['Saturday afternoons', 'Monday mornings', 'never', 'only in summer'], answer: 0 },
      { q: 'What is watched all over the world?', options: ['the Premier League', 'the weather', 'bank holidays', 'the queue'], answer: 0 },
      { q: 'Where is the heart of football?', options: ['in banks', 'in local towns', 'in museums', 'in London only'], answer: 1 },
    ],
  },
  m9: {
    title: 'The Crown',
    text: 'Kings and queens are part of British life. The King is the head of state, but the government makes the laws. Royal events stop the country: weddings, jubilees and coronations. People camp on the street days before, with flags, tea and cakes, to get a good spot. Not everyone loves the monarchy, but everyone agrees on one thing: it is very good theatre.',
    questions: [
      { q: 'Who makes the laws in Britain?', options: ['the King', 'the government', 'the tourists', 'the newspapers'], answer: 1 },
      { q: 'Why do people camp on the street?', options: ['to protest', 'for a good spot at royal events', 'they are homeless', 'for football'], answer: 1 },
      { q: 'What do people agree about the monarchy?', options: ['it is good theatre', 'it is expensive', 'it is modern', 'it is secret'], answer: 0 },
    ],
  },
  m10: {
    title: 'The NHS',
    text: 'The NHS is Britain\'s health system, and it is free at the point of use: no bill when you leave. You register with a GP — a family doctor — who sends you to specialists if you need them. For emergencies, hospitals have A&E, the accident and emergency department. The NHS started in 1948, and for many British people it is a national pride: doctors, nurses and volunteers who care.',
    questions: [
      { q: 'What does "free at the point of use" mean?', options: ['no bill when you leave', 'everything is free', 'only for tourists', 'you pay twice'], answer: 0 },
      { q: 'What is a GP?', options: ['a hospital', 'a family doctor', 'an emergency car', 'a nurse'], answer: 1 },
      { q: 'When did the NHS start?', options: ['1918', '1948', '1968', '1998'], answer: 1 },
    ],
  },
}
