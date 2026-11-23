// Historias inmersivas del curso (R15) — módulos 1 a 4 (A1).
// Cada nodo tiene un capítulo propio de una historia continua: Lupita, una
// ingeniera mexicana, se instala en York (Inglaterra). El texto usa las
// estructuras objetivo del nodo en contexto real (input comprensible, i+1).
// Contenido original de Axiom; alcance según bibliografía editorial de sources.ts.

export interface StoryChapter {
  title: string
  text: string
}

export const NODE_STORIES_A: Record<string, StoryChapter> = {
  // ===== MÓDULO 1 — A1.1 Supervivencia lingüística =====
  'm1-g1': {
    title: 'Welcome to York',
    text: 'My name is Lupita. I am from Mexico. I am an engineer, and I am twenty-six years old. Now I am in York, a beautiful city in England. My new friend is Emma. She is a teacher. We are happy. Her brother Tom is a student. He is twenty. It is a sunny day, and this is the first page of my English life.',
  },
  'm1-g2': {
    title: 'This is my house',
    text: 'This is my new house. It is a small house with an old door. Look at these boxes — they are my books. That is Emma\'s bike, over there. Those are Tom\'s shoes near the window. On the table there is an apple from the market, and the apple is big. A cat is on the wall. The cat is black, and now it is my cat too!',
  },
  'm1-g3': {
    title: 'Where are my keys?',
    text: 'Where are my keys? They are in my bag. What is this? It is a photo of my family. My brother\'s name is Diego, and my mother\'s eyes are kind. There is a park near the house, and there are two big trees in the park. Is there a bank here? Yes, there is. How old are you? I am twenty-six. These are the questions of my first week.',
  },
  'm1-v1': {
    title: 'The form at school',
    text: 'Today Lupita fills a form at the language school. Her nationality is Mexican, and her country is Mexico. Her address is 12 Blake Street, York. Her job is engineer — she works with computers. She is single, not married. Emma is a teacher; her occupation is important because she teaches children. Tom is a student of music. Now the school knows the students: their names, ages and jobs.',
  },
  'm1-v2': {
    title: 'Ship or sheep?',
    text: 'Emma teaches Lupita the sounds of English. "Ship or sheep?" asks Emma. Lupita listens and repeats: ship... sheep. "Bit — beat. Sit — seat." The vowel sounds are long and short, and her tongue is tired. Lupita practices: "This is a ship. That is a sheep." Emma laughs: "Perfect! Your pronunciation is very good now." Sound by sound, English opens its doors.',
  },
  'm1-w1': {
    title: 'First day, first form',
    text: 'It is the first day at the language school. The teacher gives the students a form. Lupita writes her name: Guadalupe Díaz. Her age: twenty-six. Her nationality: Mexican. Her email: lupita@mail.com. Her occupation: engineer. Tom writes his form next to her. "Check your spelling, please," says the teacher. Lupita checks: everything is correct. The forms are ready for the school office.',
  },
  'm1-w2': {
    title: 'My house and my friend',
    text: 'Lupita writes about her new life. "My house is small and old, but it is beautiful. There are two bedrooms and a green garden. My room is quiet and warm. Emma is tall and friendly. Her eyes are brown, and she is a teacher. York is an old city: the streets are small and the people are kind. My new life is good."',
  },
  'm1-s1': {
    title: 'Nice to meet you',
    text: 'Lupita meets Emma at the station. "Hello! I am Lupita. Nice to meet you." — "Nice to meet you too. Welcome to York!" says Emma. "How are you?" — "I am fine, thank you. And you?" — "Very well, thanks." They spell their names for the forms: E-M-M-A, L-U-P-I-T-A. In the evening Lupita says: "Good night, Emma. See you tomorrow!"',
  },
  'm1-s2': {
    title: 'Two students talk',
    text: 'Tom is a new student, and he talks with Lupita. "Where are you from?" — "I am from Mexico. And you?" — "I am from Canada. How old are you?" — "I am twenty-six. What is your job?" — "I am a music student. My sister is a doctor." They talk about their families for an hour. Conversation is easy when the questions are simple and the interest is real.',
  },
  'm1-s3': {
    title: 'Who is that man?',
    text: 'In the classroom, Lupita looks around. "Who is that man?" — "He is Mr. Bell, the director," says Emma. "Is that woman a student?" — "Yes, she is. Her name is Sofia." Lupita points at a big box. "What is this?" — "It is a projector. And these are the new books." Now Lupita knows the people and the objects in her school.',
  },
  'm1-l1': {
    title: 'At the school office',
    text: 'At the school office, Lupita listens carefully. "Good morning! What is your name?" — "Lupita Díaz." — "How do you spell your last name?" — "D-I-A-Z." — "Your phone number, please?" — "It is 7-4-4-1-2-0." — "Thank you. Your class is in Room 3." Lupita writes everything twice. Understanding names and numbers is the first key of a new school.',
  },
  'm1-l2': {
    title: 'Listen and repeat',
    text: 'The teacher speaks slowly and clearly. "Open your books, please. Look at page ten. Listen and repeat: good morning, good afternoon, good evening. Now answer: Where are you from?" The students answer one by one. "Close your books. Stand up, please. Sit down, Tom!" The class laughs. Lupita understands every instruction. Simple words, clear actions — the class is a game she can play.',
  },

  // ===== MÓDULO 2 — A1.2 Vida cotidiana básica =====
  'm2-g1': {
    title: 'Three routines',
    text: 'Emma works at a primary school. She gets up at seven and drinks tea. Lupita starts work at nine: she checks the plans and writes reports. Tom studies music at the university, and he plays the guitar every evening. Does Lupita like York? Yes, she does. Does Emma drive? No, she doesn\'t — she goes by bike. Their routines are different, but their friendship is strong.',
  },
  'm2-g2': {
    title: 'I can cook rice',
    text: 'Lupita has got a new job at a design studio. She has got a small desk and a big window. "Can you swim?" asks Tom. "Yes, I can. Can you cook?" — "I can cook rice, but I can\'t cook Mexican food!" Emma has got a car, but she can\'t drive it well. Everyone has got a talent, and everyone has got a dream. What can you do?',
  },
  'm2-g3': {
    title: 'At the market',
    text: 'At the market, Lupita buys some apples and some bread. She doesn\'t want any milk because she has got two litres at home. How much sugar do we need? How many eggs? The apples are cheaper than the pears, but the pears are sweeter. Emma\'s tea is stronger than Lupita\'s coffee. Shopping is a maths lesson: much, many, some, any — and a good conversation.',
  },
  'm2-v1': {
    title: 'The supermarket classroom',
    text: 'Lupita\'s day has new words. In the morning she has breakfast: cereal and coffee. At noon she has lunch in the studio: a sandwich and an apple. For dinner, Emma cooks pasta. On Saturday they go shopping: the bakery, the butcher, the greengrocer. Lupita learns the names: bread, chicken, onions, potatoes. The supermarket is a classroom with trolleys.',
  },
  'm2-v2': {
    title: 'Always, never, sometimes',
    text: 'Emma asks Lupita about her week. "How often do you cook?" — "Twice a week, usually on Sunday." — "Do you always have tea at five?" — "Never! I drink coffee in the morning." Tom sometimes plays football on Wednesday, and they always walk in the park in summer. Lupita writes the words in her notebook: always, usually, often, sometimes, never. Time has a rhythm now.',
  },
  'm2-w1': {
    title: 'A message to Mamá',
    text: 'Lupita writes a message to her mother. "Hi, Mamá! My routine is calm. I get up at seven and have breakfast with Emma. I work from nine to six, and I don\'t cook every day because Emma loves cooking. On weekends we visit the market and buy flowers. Love, Lupita." Her mother answers with a voice message. Writing about routines is easy when your days have a shape.',
  },
  'm2-w2': {
    title: 'An email to Diego',
    text: 'Lupita writes an email to her brother. "Hi Diego, How are you? York is beautiful. My host sister Emma is thirty-four years old. She is a teacher: patient and funny. Her brother William is a chef, and he cooks amazing cakes! My family is far, but I am happy here. Write soon. Kisses, Lupita." Family words are the same in every language: love first.',
  },
  'm2-s1': {
    title: 'Describing my day',
    text: 'In her speaking class, Lupita describes her day. "I usually get up at seven. I take the bus at half past eight and start work at nine. In the afternoon I have a coffee break with my colleagues. I get home at seven." The teacher asks: "What about Sundays?" — "On Sundays I relax. I call my family and I walk in the park."',
  },
  'm2-s2': {
    title: 'A sandwich, please',
    text: 'Lupita is at the café with Emma. "I\'d like a chicken sandwich, please." — "Anything to drink?" — "An orange juice, please." — "Here you are. That\'s four pounds fifty." Then at the shop: "How much is this bread?" — "One pound twenty." — "I\'d like two, please." Money, food and polite words: English for real life fits in a shopping bag.',
  },
  'm2-s3': {
    title: 'Small talk',
    text: 'Small talk is a sport, and Lupita practices in the studio kitchen. "Nice weather today!" — "Yes, beautiful. Do you like York?" — "I love it. And you?" — "Me too. Do you like football?" — "Yes! My team is América." — "Mine is York City!" Two minutes of English, again and again. Every short conversation makes the next one easier.',
  },
  'm2-l1': {
    title: 'Sarah, the nurse',
    text: 'Lupita listens to a radio program about routines. "Sarah is a nurse. She gets up at five in the morning. She starts work at six and finishes at two. In the afternoon she sleeps. On Friday she goes to the cinema with her sister." Lupita writes the times: five, six, two. Understanding schedules is understanding lives.',
  },
  'm2-l2': {
    title: 'Eight pounds forty',
    text: 'In the listening lab, Lupita hears a dialogue. "Can I help you?" — "Yes, please. I\'d like a cheeseburger and chips." — "Anything else?" — "A lemonade, please." — "That\'s eight pounds forty." Then another voice: "Welcome to the Grand Hotel. Breakfast is from seven to ten." Lupita catches the prices and the times. Real conversations, real numbers.',
  },

  // ===== MÓDULO 3 — A1+ Expansión =====
  'm3-g1': {
    title: 'Right now',
    text: 'Right now, Lupita is sitting in the studio. She is drawing a new logo. Her colleague James is talking on the phone, and it is raining outside — again! — but nobody is complaining. Emma is cooking dinner at home; the kitchen smells of soup. Is Lupita working hard? Yes, she is. Is she thinking about Mexico? Always. The present continuous captures life as it happens.',
  },
  'm3-g2': {
    title: 'Two days in London',
    text: 'Last week was special. Lupita was in London for two days. The conference was interesting, and the hotel was small but clean. She visited the British Museum and walked in Hyde Park. She took the Tube and got lost twice! She met a Mexican family at the hotel, and they were very kind. "How was your trip?" asked Emma. "It was fantastic," said Lupita.',
  },
  'm3-g3': {
    title: 'Quieter, colder, friendlier',
    text: 'Life in York is quieter than life in Mexico City, but it is also colder. Lupita\'s new flat is bigger than the old one, and the kitchen is the best room in the house. She likes winter because Christmas is beautiful, but she doesn\'t like the rain, so she takes the bus. Emma says York is the friendliest city in England. Lupita agrees — and she has proof.',
  },
  'm3-v1': {
    title: 'The Edinburgh trip',
    text: 'Lupita plans a trip to Edinburgh. She packs her suitcase: clothes, camera and passport. She books the tickets online — the train is faster than the bus, but it is more expensive. In the city she takes photos of everything: the station, the castle, the fog. Travel opens the album of life. Her favourite souvenir? A postcard of Arthur\'s Seat.',
  },
  'm3-v2': {
    title: 'Anybody here?',
    text: 'The studio is empty. Is anybody here? Nobody answers. Lupita looks for her charger. It is somewhere on the desk — or maybe in the meeting room. "Does anybody know where my charger is?" James answers: "Ask Emma. She knows everything." "Everybody asks Emma," laughs Lupita. "She is the oracle of the studio." Someone, anyone, nothing — the grammar of mystery.',
  },
  'm3-w1': {
    title: 'A perfect day',
    text: 'Lupita writes in her diary. "Last Saturday I went to Whitby with Emma. We took the bus at nine, and the sea was incredible: blue and wild. We ate fish and chips on the beach. It was cold, but delicious. I bought a small shell for my mother. We got home at eight. It was a perfect day." Simple past, simple memories, forever.',
  },
  'm3-w2': {
    title: 'Two photos of York',
    text: 'The studio has a photo contest, and Lupita writes about two photos. "The first photo is York at night: the Minster is tall and golden, and the streets are quiet. The second photo is the market in the morning: noisy, colourful and full of people. York is calmer than Mexico City, but the market here is as friendly as home. Both photos are beautiful."',
  },
  'm3-s1': {
    title: 'Oaxaca, last year',
    text: 'In class, students tell their stories. Lupita\'s turn: "Last year I visited Oaxaca with my family. We saw the pyramids of Monte Albán, and the weather was hot. We ate mole and tlayudas — delicious! I took hundreds of photos." The teacher asks: "What was the best moment?" — "The sunset at the pyramids. It was magic."',
  },
  'm3-s2': {
    title: 'Train or bus?',
    text: '"Which is better: the train or the bus?" asks the teacher. Lupita thinks. "The train is faster and more comfortable, but the bus is cheaper. For a short trip, the bus is fine. In my opinion, the train is better for long journeys." — "And tea or coffee?" — "Coffee! It\'s stronger, and I need energy in the morning!" Everyone laughs. Opinions with reasons: the recipe of conversation.',
  },
  'm3-s3': {
    title: 'Weekend plans',
    text: 'Emma and Lupita plan the weekend. "What are you going to do on Saturday?" — "I\'m going to visit the castle museum. And on Sunday?" — "I\'m going to cook a roast. Can you come?" — "Of course! I\'m going to bring dessert — flan!" Plans in English are promises of good times. The conversation continues for an hour — their longest yet.',
  },
  'm3-l1': {
    title: 'The Peru story',
    text: 'Lupita listens to a podcast: "My name is Peter, and last summer I travelled to Peru. I hiked to Machu Picchu. The walk was hard, but the view was incredible. I met travellers from Japan and Brazil, and we sang songs on the mountain." Lupita understands the whole story — and smiles: the world is full of Lupitas.',
  },
  'm3-l2': {
    title: 'Platform 4',
    text: 'At the station, the speaker announces: "The train to Manchester leaves from platform 4 at 10:35. The café is on platform 2. Tickets are twenty-two pounds." Lupita catches: platform 4, 10:35, twenty-two. Then a tourist asks her: "Where is the exit?" — "Over there, next to the bookshop," she answers. Listening for details is a superpower of travel.',
  },

  // ===== MÓDULO 4 — A1+ Consolidación =====
  'm4-g1': {
    title: 'The story of my job',
    text: 'Two years ago, Lupita finished university. She looked for a job for months. In January, a studio in York answered her application. She was nervous in the interview, but the manager was friendly. She packed her bags, said goodbye to her family and flew to England. She didn\'t speak perfect English then. Now she tells this story without fear — the past is a bridge to the present.',
  },
  'm4-g2': {
    title: 'Paris in May',
    text: 'Next month, Lupita is going to visit Paris. She has already booked the hotel, and her sister will travel with her because she has holidays in May. "We are going to climb the Eiffel Tower," says Lupita. "I think it will be crowded," says Emma, "but the view will be worth it." Plans with going to, predictions with will: the future has two doors.',
  },
  'm4-g3': {
    title: 'The visa problem',
    text: 'Lupita has a problem: her visa. "You have to renew it before June," says Emma. "You mustn\'t wait until the last minute." — "What should I do?" — "You should call the office tomorrow. You shouldn\'t worry: the process is simple." — "May I use your phone? Mine doesn\'t have credit!" Rules, advice and permission: the grammar of growing up.',
  },
  'm4-v1': {
    title: 'The Highlands notebook',
    text: 'Lupita opens her travel notebook. Destination: the Scottish Highlands. Accommodation: a small bed and breakfast. Luggage: one backpack. Activities: hiking, boat trips and castle visits. She checks the weather forecast — rain, of course — and packs an umbrella. Then she invites Emma: "Come with us! It\'ll be an adventure!" Holidays are the vocabulary of dreams.',
  },
  'm4-v2': {
    title: 'First, then, finally',
    text: 'Lupita writes a paragraph about her week. "First, I finished the logo project. Then, I helped James with his presentation. However, the printer didn\'t work! Fortunately, Tom fixed it. After that, we celebrated with coffee and cake. Finally, I went home and slept for ten hours." Connectors are the glue of stories: first, then, however, finally.',
  },
  'm4-w1': {
    title: 'An invitation',
    text: 'Lupita writes to her friend Carla. "Hi Carla! Last weekend I went to Whitby again — this time with Tom and Emma. We visited the abbey and ate the best fish and chips of my life. Next month I\'m going to Paris! Do you want to come? The tickets are cheap in May. Write me soon! Love, Lupita." An email can carry a whole month of joy.',
  },
  'm4-w2': {
    title: 'Plans as maps',
    text: 'The studio asks for a short text: "My plans for next year." Lupita writes: "Next year I am going to save money and visit three countries. I will also study for a design certificate. I think English opens doors, so I\'m going to keep practicing every day. In my opinion, plans are like maps: you can change the route, but you need a destination."',
  },
  'm4-s1': {
    title: 'Planning Scotland',
    text: 'Lupita and Emma plan the Scotland trip aloud. "Where are we going to sleep?" — "In a bed and breakfast in Fort William." — "How are we going to travel?" — "By train to Glasgow, then by bus." — "What should we visit?" — "Loch Ness, definitely. And we must try haggis!" — "Should I book the tickets tonight?" — "Yes, before the prices go up!"',
  },
  'm4-s2': {
    title: 'The broken bike',
    text: 'Tom\'s bike is broken. "Can you help me?" he asks. "What\'s the problem?" — "The chain is stuck." — "You should take it to the repair shop on Stonegate. Or I can lend you my bike tomorrow." — "Really? Thanks!" — "Why don\'t you take the bus today?" — "Good idea. Can you tell me where the stop is?" Helping hands speak simple English.',
  },
  'm4-s3': {
    title: 'The stuck paper',
    text: 'The printer doesn\'t work, and James has a presentation in ten minutes. "The paper is stuck," says Lupita. "Should we call IT?" — "It\'s faster to fix it. Open this door, pull the paper, close it. Try now." — "It works! You\'re a genius!" — "No, I just read the manual!" Problems are conversations in disguise: describe, suggest, solve, thank.',
  },
  'm4-l1': {
    title: 'Gate 12',
    text: 'At the airport, Lupita listens: "Flight AB234 to Paris is now boarding at gate 12. Please have your passport ready. Passengers Ramirez and Smith, please go to the information desk." Then: "Attention: the duty free shop closes in ten minutes." She understands every announcement. Two years ago this noise was confusion. Now it is information.',
  },
  'm4-l2': {
    title: 'The Lake District',
    text: 'Lupita hears a conversation in a podcast. "I think you should visit the Lake District in spring." — "Why spring?" — "Because the weather is mild and the flowers are beautiful. But book early: it gets busy." — "How much is a room?" — "About eighty pounds a night." Lupita catches the opinion, the reason and the price. Conversations at normal speed are doors, not walls.',
  },
}
