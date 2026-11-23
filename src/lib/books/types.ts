// Tipos del corpus «Libros» (R14). Los bancos contienen ejercicios originales
// de Axiom; las obras citadas se usan sólo como referencia de alcance didáctico.

export interface McqItem { q: string; options: string[]; answer: number; hint?: string }
export interface GapItem { text: string; answer: string; hint?: string } // la respuesta va donde está ___
export interface OrderItem { words: string[]; answer: string }           // palabras desordenadas -> oración correcta
export interface PairItem { es: string; en: string }
export interface ReadingText { title: string; text: string; questions: McqItem[] }

export interface BankContent {
  mcq?: McqItem[]
  gap?: GapItem[]
  order?: OrderItem[]
  pairs?: PairItem[]      // traducción guiada ES→EN (escritura/vocabulario)
  dialogue?: PairItem[]   // líneas guiadas ES→EN (speaking)
  dictation?: string[]    // frases EN para dictado por audio TTS (listening)
  reading?: ReadingText[] // lectura de recepción con preguntas (integrada en repaso/vocabulario)
}

export type BankBlock = 'grammar' | 'writing' | 'speaking' | 'listening' | 'vocab' | 'review'

export interface BankDef {
  moduleId: number
  lessonKey: string       // p. ej. 'm1-g1' — coincide con COURSE_MODULES.lessons[].key
  block: BankBlock
  title: string
  bookKey: string         // obra de referencia editorial (BookSource.key)
  difficulty: number      // 0-1, calibrado contra theta
  content: BankContent
}
