// R15 — Operaciones de SRS contra la BD (usa el motor puro de ./index).
import { db } from '@/lib/db'
import { scheduleReview, type SrsState } from './index'

export interface DueItem {
  id: string
  itemKey: string
  kind: string
  front: string
  back: string
  reps: number
}

export async function getDueItems(userId: string, limit = 3): Promise<DueItem[]> {
  const items = await db.reviewItem.findMany({
    where: { userId, dueAt: { lte: new Date() } },
    orderBy: { dueAt: 'asc' },
    take: Math.max(1, limit),
  })
  return items.map(i => ({ id: i.id, itemKey: i.itemKey, kind: i.kind, front: i.front, back: i.back, reps: i.reps }))
}

export async function dueCount(userId: string): Promise<number> {
  return db.reviewItem.count({ where: { userId, dueAt: { lte: new Date() } } })
}

/** Califica un ítem (q 0-1) y reprograma su siguiente aparición. */
export async function gradeReview(userId: string, itemId: string, q: number) {
  const item = await db.reviewItem.findFirst({ where: { id: itemId, userId } })
  if (!item) return null
  const state: SrsState = { ease: item.ease, intervalDays: item.intervalDays, reps: item.reps, lapses: item.lapses }
  const next = scheduleReview(state, q)
  const updated = await db.reviewItem.update({
    where: { id: item.id },
    data: {
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: next.dueAt,
      lastReviewedAt: next.lastReviewedAt,
    },
  })
  return updated
}

export interface NewReviewItem {
  itemKey: string
  kind?: string
  front: string
  back: string
}

/** Registra ítems nuevos en la cola (idempotente por itemKey). Vencen mañana. */
export async function commitNewItems(userId: string, items: NewReviewItem[]) {
  if (!items.length) return 0
  // SQLite no soporta skipDuplicates: dedup manual por (userId, itemKey)
  const existing = await db.reviewItem.findMany({
    where: { userId, itemKey: { in: items.map(i => i.itemKey) } },
    select: { itemKey: true },
  })
  const existingSet = new Set(existing.map(e => e.itemKey))
  const fresh = items.filter(i => !existingSet.has(i.itemKey))
  if (!fresh.length) return 0
  const due = new Date()
  due.setDate(due.getDate() + 1)
  const res = await db.reviewItem.createMany({
    data: fresh.map(i => ({
      userId,
      itemKey: i.itemKey,
      kind: i.kind || 'vocab',
      front: i.front,
      back: i.back,
      dueAt: due,
    })),
  })
  return res.count
}
