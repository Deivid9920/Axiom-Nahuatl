// R15 — Constructor de contenido inmersivo por nodo.
// A partir del banco del «Libro» deriva un paquete pedagógico completo:
// historia (input comprensible), vocabulario para SRS, chunks, preguntas de
// descubrimiento (notice) y tarea de producción (escritura + oral).
// Todo es algorítmico: ninguna pieza usa LLM.

import type { BankDef } from './types'
import { NODE_STORIES_A, type StoryChapter } from './stories_a'
import { NODE_STORIES_B } from './stories_b'
import { NODE_STORIES_C } from './stories_c'
import { CLIL_TEXTS, type ClilText } from './clil'

export type { StoryChapter } from './stories_a'
export { CLIL_TEXTS } from './clil'
export type { ClilText } from './clil'

const NODE_STORIES: Record<string, StoryChapter> = {
  ...NODE_STORIES_A,
  ...NODE_STORIES_B,
  ...NODE_STORIES_C,
}

export interface VocabLite {
  en: string
  es: string
}

export interface NoticeItem {
  sentence: string // contexto mostrado (frase de la historia o del banco)
  prompt: string // pregunta en español
  options: string[] // 3 opciones (la correcta incluida)
  answer: number
}

export interface ProduceTask {
  writing: {
    promptEs: string
    targets: { en: string; es: string }[] // estructuras que debe usar
    minWords: number
  }
  speaking: {
    instructionEs: string
    expected: string // línea EN esperada (para repetir/responder)
    supportEs: string // apoyo en español
  }
}

export interface NodeContent {
  story: StoryChapter
  audioLines: string[] // frases de la historia para audio TTS secuencial
  vocab: VocabLite[] // hasta 8 ítems ES->EN para la cola SRS
  chunks: string[] // colocaciones/chunks objetivo del nodo
  notice: NoticeItem[] // 2 preguntas «descubre el significado en contexto»
  task: ProduceTask
  isProject: boolean // true en nodos de repaso: sesión de proyecto CLIL
}

const STORY_FALLBACK: StoryChapter = {
  title: 'Practice makes progress',
  text: 'Lupita opens her notebook every morning. She reads, she listens, she repeats. Some days are easy and some days are hard, but she never stops. "Little and often," says Emma. "That is the secret." Lupita smiles and turns the page.',
}

function splitSentences(text: string): string[] {
  return text
    .replace(/([.!?])\s+/g, '$1|')
    .split('|')
    .map(s => s.trim())
    .filter(Boolean)
}

function storyFor(bank: BankDef): StoryChapter {
  // Repaso -> texto CLIL (sesión de proyecto); resto -> capítulo de la historia
  if (bank.block === 'review') {
    const clil = CLIL_TEXTS[`m${bank.moduleId}`]
    if (clil) return { title: clil.title, text: clil.text }
  }
  return NODE_STORIES[bank.lessonKey] || STORY_FALLBACK
}

export function clilForModule(moduleId: number): ClilText | undefined {
  return CLIL_TEXTS[`m${moduleId}`]
}

export function storyForLessonKey(lessonKey: string): StoryChapter | undefined {
  return NODE_STORIES[lessonKey]
}

function vocabFrom(bank: BankDef): VocabLite[] {
  if (bank.content.pairs?.length) return bank.content.pairs.slice(0, 8)
  // Bancos sin pares (gramática/listening): huecos y ordenar como ítems de frase
  const out: VocabLite[] = []
  for (const g of bank.content.gap || []) {
    if (out.length >= 4) break
    out.push({ en: g.answer, es: g.hint ? `${g.text} (${g.hint})` : g.text })
  }
  for (const o of bank.content.order || []) {
    if (out.length >= 6) break
    out.push({ en: o.answer, es: 'ordenar: ' + o.words.join(' / ') })
  }
  for (const d of bank.content.dictation || []) {
    if (out.length >= 8) break
    out.push({ en: d, es: 'escucha y escribe' })
  }
  // Bancos de speaking (sólo diálogo): las líneas del diálogo son vocabulario ES->EN
  for (const d of bank.content.dialogue || []) {
    if (out.length >= 8) break
    out.push({ en: d.en, es: d.es })
  }
  return out
}

function chunksFrom(bank: BankDef, vocab: VocabLite[]): string[] {
  const chunks: string[] = []
  // Pares de 2+ palabras son chunks naturales
  for (const p of bank.content.pairs || []) {
    if (chunks.length >= 3) break
    if (p.en.trim().split(/\s+/).length >= 2) chunks.push(p.en)
  }
  // Respuestas de ordenar son frases modelo (1 chunk extra)
  const order = (bank.content.order || [])[0]
  if (order && chunks.length < 4) chunks.push(order.answer)
  if (!chunks.length && vocab.length) chunks.push(vocab[0].en)
  return chunks
}

function noticeFrom(bank: BankDef, story: StoryChapter, vocab: VocabLite[]): NoticeItem[] {
  const sentences = splitSentences(story.text)
  const items: NoticeItem[] = []
  const used = new Set<string>()

  // Colocación determinista por hash para variar la posición de la respuesta
  const arrange = (correct: string, distractors: string[], seed: string): { options: string[]; answer: number } => {
    const options = [correct, ...distractors]
    const hash = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0)
    if (hash % 3 === 1) options.reverse()
    else if (hash % 3 === 2) options.splice(1, 0, options.pop() as string)
    return { options, answer: options.indexOf(correct) }
  }

  // Estrategia A — término del vocabulario apareciendo literalmente en la historia
  for (const v of vocab) {
    if (items.length >= 2) break
    if (used.has(v.en)) continue
    const term = v.en.replace(/^the /, '').toLowerCase()
    const sentence = sentences.find(s => s.toLowerCase().includes(term))
    if (!sentence) continue
    const distractors = vocab.filter(x => x.es !== v.es).slice(0, 2).map(x => x.es)
    if (distractors.length < 2) continue
    used.add(v.en)
    const { options, answer } = arrange(v.es, distractors, v.en)
    items.push({ sentence, prompt: `¿Qué significa «${v.en}» en esta frase?`, options, answer })
  }

  // Estrategia B — descubrir el patrón gramatical: ¿qué encaja en el hueco?
  if (items.length < 2) {
    const answerPool = [
      ...(bank.content.gap || []).map(g => g.answer),
      ...(bank.content.order || []).map(o => o.answer.split(' ')[0]),
      ...vocab.map(v => v.en.replace(/^the /, '')),
    ].filter(w => w && w.length > 1)
    for (const g of bank.content.gap || []) {
      if (items.length >= 2) break
      if (used.has(g.text)) continue
      const distractors = [...new Set(answerPool.filter(w => w.toLowerCase() !== g.answer.toLowerCase()))].slice(0, 2)
      if (distractors.length < 2) continue
      used.add(g.text)
      const { options, answer } = arrange(g.answer, distractors, g.text)
      items.push({ sentence: g.text, prompt: `Completa la frase del tema: ¿qué encaja en el hueco?`, options, answer })
    }
  }

  // Estrategia C — reconocimiento de vocabulario del nodo con apoyo de la historia
  if (items.length < 2) {
    for (const v of vocab) {
      if (items.length >= 2) break
      if (used.has(v.en)) continue
      const distractors = vocab.filter(x => x.en !== v.en).slice(0, 2).map(x => x.en)
      if (distractors.length < 2) continue
      used.add(v.en)
      const { options, answer } = arrange(v.en, distractors, v.en + v.es)
      items.push({
        sentence: sentences[0] || story.title,
        prompt: `Así empieza la historia. ¿Cómo se dice «${v.es}» en inglés?`,
        options,
        answer,
      })
    }
  }

  return items
}

function taskFrom(bank: BankDef, vocab: VocabLite[]): ProduceTask {
  const moduleScale = Math.min(6, bank.moduleId)
  const minWords = 6 + moduleScale * 2 // A1: 8 palabras -> B1: 18 palabras

  // Escritura: usa pares como estructuras objetivo; si no hay, frases del banco
  let targets: { en: string; es: string }[] = (bank.content.pairs || []).slice(0, 3).map(p => ({ en: p.en, es: p.es }))
  if (!targets.length) {
    const order = (bank.content.order || []).slice(0, 2)
    const gap = (bank.content.gap || []).slice(0, 2)
    targets = [
      ...order.map(o => ({ en: o.answer, es: 'frase modelo: ' + o.answer })),
      ...gap.map(g => ({ en: g.answer, es: 'usa la forma: ' + g.answer })),
    ].slice(0, 3)
  }
  if (!targets.length && vocab.length) targets = vocab.slice(0, 2).map(v => ({ en: v.en, es: v.es }))

  // Oral: diálogo guiado del banco, o repetición (shadowing) de una frase modelo
  let speaking: ProduceTask['speaking']
  const dialogue = bank.content.dialogue || []
  if (dialogue.length) {
    speaking = {
      instructionEs: 'Escucha la línea del diálogo y grábala tú: mantén el ritmo y la entonación.',
      expected: dialogue[0].en,
      supportEs: dialogue[0].es,
    }
  } else {
    const dictation = (bank.content.dictation || [])[0]
    const model = dictation || (bank.content.order || [])[0]?.answer || vocab[0]?.en || 'I am learning English.'
    speaking = {
      instructionEs: 'Escucha la frase y repítela en voz alta (shadowing): imita el ritmo, no solo las palabras.',
      expected: model,
      supportEs: 'Consejo: divide la frase en dos partes si es larga.',
    }
  }

  return {
    writing: {
      promptEs: `Escribe de 2 a 4 frases sobre el tema del nodo usando las estructuras que practicaste.`,
      targets,
      minWords,
    },
    speaking,
  }
}

/** Construye el paquete inmersivo completo de un nodo a partir de su banco. */
export function deriveNodeContent(bank: BankDef): NodeContent {
  const story = storyFor(bank)
  const vocab = vocabFrom(bank)
  return {
    story,
    audioLines: splitSentences(story.text),
    vocab,
    chunks: chunksFrom(bank, vocab),
    notice: noticeFrom(bank, story, vocab),
    task: taskFrom(bank, vocab),
    isProject: bank.block === 'review',
  }
}
