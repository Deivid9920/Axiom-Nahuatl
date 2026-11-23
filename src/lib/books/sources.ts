// Fuentes editoriales de referencia («Libros»). Metadatos de catalogación reales;
// el contenido de los bancos es original de Axiom y sólo sigue sus scopes.
// Bibliografía completa en el PDF técnico de la R14.

export interface BookSourceDef {
  key: string
  title: string
  author: string
  publisher: string
  year: number
  cefrScope: string
  block: 'grammar' | 'vocabulary' | 'pronunciation' | 'methodology' | 'exam' | 'reading'
}

export const BOOK_SOURCES: BookSourceDef[] = [
  { key: 'cefr-2001', title: 'Common European Framework of Reference for Languages: Learning, teaching, assessment', author: 'Council of Europe', publisher: 'Cambridge University Press', year: 2001, cefrScope: 'A1-C2', block: 'methodology' },
  { key: 'cefr-companion-2020', title: 'CEFR: Companion volume', author: 'Council of Europe', publisher: 'Council of Europe Publishing', year: 2020, cefrScope: 'A1-C2', block: 'methodology' },
  { key: 'murphy-essential-2015', title: 'Essential Grammar in Use', author: 'Raymond Murphy', publisher: 'Cambridge University Press', year: 2015, cefrScope: 'A1-A2', block: 'grammar' },
  { key: 'murphy-english-2019', title: 'English Grammar in Use', author: 'Raymond Murphy', publisher: 'Cambridge University Press', year: 2019, cefrScope: 'B1-B2', block: 'grammar' },
  { key: 'eastwood-opg-2019', title: 'Oxford Practice Grammar: Intermediate', author: 'John Eastwood', publisher: 'Oxford University Press', year: 2019, cefrScope: 'A2-B1', block: 'grammar' },
  { key: 'swan-peu-2016', title: 'Practical English Usage', author: 'Michael Swan', publisher: 'Oxford University Press', year: 2016, cefrScope: 'A1-C2', block: 'grammar' },
  { key: 'cobuild-grammar-2017', title: 'COBUILD English Grammar', author: 'Collins COBUILD', publisher: 'HarperCollins Publishers', year: 2017, cefrScope: 'A2-B2', block: 'grammar' },
  { key: 'vocab-in-use-elem-2017', title: 'English Vocabulary in Use: Elementary', author: 'Michael McCarthy & Felicity O\'Dell', publisher: 'Cambridge University Press', year: 2017, cefrScope: 'A1-A2', block: 'vocabulary' },
  { key: 'vocab-in-use-preint-2017', title: 'English Vocabulary in Use: Pre-intermediate and Intermediate', author: 'Stuart Redman', publisher: 'Cambridge University Press', year: 2017, cefrScope: 'A2-B1', block: 'vocabulary' },
  { key: 'word-skills-elem-2020', title: 'Oxford Word Skills: Elementary', author: 'Ruth Gairns & Stuart Redman', publisher: 'Oxford University Press', year: 2020, cefrScope: 'A1-A2', block: 'vocabulary' },
  { key: 'pron-in-use-2017', title: 'English Pronunciation in Use: Intermediate', author: 'Mark Hancock', publisher: 'Cambridge University Press', year: 2017, cefrScope: 'A2-B2', block: 'pronunciation' },
  { key: 'ship-or-sheep-2006', title: 'Ship or Sheep? An Intermediate Pronunciation Course', author: 'Ann Baker', publisher: 'Cambridge University Press', year: 2006, cefrScope: 'A1-B1', block: 'pronunciation' },
  { key: 'sound-foundations-2005', title: 'Sound Foundations: Learning and Teaching Pronunciation', author: 'Adrian Underhill', publisher: 'Macmillan Education', year: 2005, cefrScope: 'A1-C2', block: 'pronunciation' },
  { key: 'english-file-beginner-2019', title: 'English File: Beginner', author: 'Christina Latham-Koenig, Clive Oxenden & Jerry Lambert', publisher: 'Oxford University Press', year: 2019, cefrScope: 'A1', block: 'methodology' },
  { key: 'headway-beginner-2019', title: 'Headway: Beginner', author: 'Liz Soars & John Soars', publisher: 'Oxford University Press', year: 2019, cefrScope: 'A1', block: 'methodology' },
  { key: 'speakout-a1-2022', title: 'Speakout: A1', author: 'Frances Eales & Steve Oakes', publisher: 'Pearson', year: 2022, cefrScope: 'A1', block: 'methodology' },
  { key: 'cutting-edge-elem-2013', title: 'Cutting Edge: Elementary', author: 'Sarah Cunningham, Peter Moor & Araminta Crace', publisher: 'Pearson Education', year: 2013, cefrScope: 'A1-A2', block: 'methodology' },
  { key: 'straightforward-int-2012', title: 'Straightforward: Intermediate', author: 'Philip Kerr & Ceri Jones', publisher: 'Macmillan Education', year: 2012, cefrScope: 'B1', block: 'methodology' },
  { key: 'navigate-a1-2016', title: 'Navigate: A1 Beginner', author: 'Paul Dummett & John Hughes', publisher: 'Oxford University Press', year: 2016, cefrScope: 'A1', block: 'reading' },
  { key: 'empower-starter-2022', title: 'Cambridge English Empower: Starter/A1', author: 'Adrian Doff, Craig Thaine, Herbert Puchta, Jeff Stranks & Peter Lewis-Jones', publisher: 'Cambridge University Press', year: 2022, cefrScope: 'A1', block: 'exam' },
  { key: 'collins-life-listening-2012', title: 'Collins English for Life: Listening B1+', author: 'Ian Badger', publisher: 'HarperCollins Publishers', year: 2012, cefrScope: 'B1', block: 'exam' },
  { key: 'b1-preliminary-2020', title: 'B1 Preliminary Handbook for Teachers', author: 'Cambridge Assessment English', publisher: 'Cambridge Assessment English', year: 2020, cefrScope: 'B1', block: 'exam' },
  { key: 'bookworms-2008', title: 'Oxford Bookworms Library (Starter-Stage 6)', author: 'Jennifer Bassett (ed.)', publisher: 'Oxford University Press', year: 2008, cefrScope: 'A1-B2', block: 'reading' },
  { key: 'penguin-readers-2021', title: 'Penguin Readers (niveles 1-3)', author: 'Varios autores', publisher: 'Penguin Books', year: 2021, cefrScope: 'A1-B1', block: 'reading' },
]
