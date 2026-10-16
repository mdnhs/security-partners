import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  like,
  or,
} from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { media, mediaUsages } from "@/server/db/schema"

export async function findMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id))
  return row ?? null
}

/** The subset of `ids` that exist in the media library. */
export async function existingMediaIds(
  db: DbOrTx,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ id: media.id })
    .from(media)
    .where(inArray(media.id, ids))
  return new Set(rows.map((r) => r.id))
}

/** Replaces every media_usages row of one entity (same transaction as the save). */
export async function replaceMediaUsages(
  db: DbOrTx,
  entityType: string,
  entityId: string,
  usages: { mediaId: string; field: string }[]
): Promise<void> {
  await deleteMediaUsages(db, entityType, entityId)
  if (usages.length === 0) return
  await db
    .insert(mediaUsages)
    .values(usages.map((u) => ({ ...u, entityType, entityId })))
}

export async function deleteMediaUsages(
  db: DbOrTx,
  entityType: string,
  entityId: string
): Promise<void> {
  await db
    .delete(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )
}

/** Usage rows of one entity, field order (tests and Phase 6 usages panel). */
export function listMediaUsagesFor(
  db: DbOrTx,
  entityType: string,
  entityId: string
) {
  return db
    .select({ mediaId: mediaUsages.mediaId, field: mediaUsages.field })
    .from(mediaUsages)
    .where(
      and(
        eq(mediaUsages.entityType, entityType),
        eq(mediaUsages.entityId, entityId)
      )
    )
    .orderBy(mediaUsages.field)
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

/** Paginated library rows (picker). `q` matches alt text or file key. */
export async function listMediaRows(
  db: DbOrTx,
  opts: {
    q?: string
    imagesOnly: boolean
    sort: { field: "createdAt" | "alt"; dir: "asc" | "desc" }
    page: number
    pageSize: number
  }
) {
  const pattern = opts.q ? `%${escapeLike(opts.q)}%` : null
  const where = and(
    opts.imagesOnly ? like(media.mime, "image/%") : undefined,
    pattern
      ? or(ilike(media.alt, pattern), ilike(media.key, pattern))
      : undefined
  )
  const [{ total }] = await db
    .select({ total: count() })
    .from(media)
    .where(where)
  const column = opts.sort.field === "alt" ? media.alt : media.createdAt
  const rows = await db
    .select()
    .from(media)
    .where(where)
    .orderBy(
      opts.sort.dir === "asc" ? asc(column) : desc(column),
      asc(media.key)
    )
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}
