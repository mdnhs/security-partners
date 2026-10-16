import "server-only"

import { and, eq, inArray } from "drizzle-orm"

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
