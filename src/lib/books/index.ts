// Índice del corpus «Libros»: agrega fuentes + bancos para el seed y el motor.
import { BOOK_SOURCES, type BookSourceDef } from './sources'
import { BANKS_A } from './banks_a'
import { BANKS_B } from './banks_b'
import { BANKS_C } from './banks_c'
import type { BankDef } from './types'

export { BOOK_SOURCES } from './sources'
export type { BookSourceDef } from './sources'
export type { BankDef, BankContent, McqItem, GapItem, OrderItem, PairItem, ReadingText } from './types'
export { COURSE_MODULES, BLOCK_HOURS, BLOCK_LABELS, getModule } from './modules'
export type { CourseModule, ModuleLesson } from './modules'
export { deriveNodeContent, clilForModule, storyForLessonKey } from './content'
export type { NodeContent, VocabLite, NoticeItem, ProduceTask, StoryChapter, ClilText } from './content'

export const BANKS: BankDef[] = [...BANKS_A, ...BANKS_B, ...BANKS_C]

// Bank por lección: 'm1-g1' -> BankDef
export function bankForLesson(lessonKey: string): BankDef | undefined {
  return BANKS.find(b => b.lessonKey === lessonKey)
}
