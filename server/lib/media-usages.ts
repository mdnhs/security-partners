import "server-only"

import { collectMediaFields, type MediaField } from "@/lib/media"
import type { DbOrTx } from "@/server/db/client"
import {
  deleteMediaUsages,
  existingMediaIds,
  listMediaReferencingEntities,
  lockMediaReferencingEntity,
  replaceMediaUsages,
} from "@/server/modules/media/repo"

import { AppError } from "./errors"
import { FOREIGN_KEY_VIOLATION, pgErrorCode } from "./pg-errors"

const MISSING_MESSAGE =
  "This image is no longer in the media library. Choose another."

/** 422 for references to media rows that do not exist (the backfill skips these entities). */
class MissingMediaError extends AppError {}

function missingMedia(usages: MediaField[]): AppError {
  const fieldErrors: Record<string, string[]> = {}
  for (const usage of usages) fieldErrors[usage.field] = [MISSING_MESSAGE]
  return new MissingMediaError("VALIDATION_FAILED", "Some images are missing", {
    fieldErrors,
  })
}

/** The media id named by an FK violation's detail: `Key (media_id)=(<id>) …`. */
function mediaIdOfFkError(err: unknown): string | undefined {
  const e = err as { detail?: unknown; cause?: { detail?: unknown } } | null
  const detail = e?.cause?.detail ?? e?.detail
  if (typeof detail !== "string") return undefined
  return /\(media_id\)=\(([^)]+)\)/.exec(detail)?.[1]
}

/**
 * Rewrites the media_usages rows of one entity from the values it stores
 * (e.g. draft + published), inside the caller's transaction. media_usages
 * restricts deleting media in use (ledger ruling), so every save keeps
 * these rows exact. A reference to a missing media row → 422 on its field,
 * also when the row is deleted between the check and the insert (FK 23503).
 */
export async function syncMediaUsages(
  tx: DbOrTx,
  entityType: string,
  entityId: string,
  ...values: unknown[]
): Promise<MediaField[]> {
  const unique = new Map<string, MediaField>()
  for (const value of values)
    for (const usage of collectMediaFields(value))
      unique.set(`${usage.mediaId} ${usage.field}`, usage)
  const usages = [...unique.values()]
  const found = await existingMediaIds(tx, [
    ...new Set(usages.map((u) => u.mediaId)),
  ])
  const missing = usages.filter((u) => !found.has(u.mediaId))
  if (missing.length > 0) throw missingMedia(missing)
  try {
    await replaceMediaUsages(tx, entityType, entityId, usages)
  } catch (err) {
    if (pgErrorCode(err) !== FOREIGN_KEY_VIOLATION) throw err
    // Deleted by someone else after the check: the transaction is aborted,
    // so name the fields from the error instead of querying again.
    const gone = mediaIdOfFkError(err)
    const affected = usages.filter((u) => u.mediaId === gone)
    throw missingMedia(affected.length > 0 ? affected : usages)
  }
  return usages
}

/** Removes the usage rows of a deleted entity (same transaction as the delete). */
export async function clearMediaUsages(
  tx: DbOrTx,
  entityType: string,
  entityId: string
): Promise<void> {
  await deleteMediaUsages(tx, entityType, entityId)
}

/**
 * Recomputes media_usages for every entity that can reference media
 * (ledger carry: seeded references were never tracked). Same shapes as the
 * services' syncs, so the rows equal what the next save would write.
 * Returns the number of usage rows.
 *
 * Each entity runs in its own (nested) transaction: its row is locked FOR
 * UPDATE and re-read right before the sync, so an admin save that commits
 * meanwhile is not overwritten with stale references (the save holds the
 * row until its own sync commits; we then read what it wrote). An entity
 * that references missing media is skipped (savepoint rolled back, its
 * existing rows kept) and logged by id, so one bad reference never rolls
 * back a whole seed.
 */
export async function backfillMediaUsages(db: DbOrTx): Promise<number> {
  let total = 0
  const skipped: string[] = []
  for (const entity of await listMediaReferencingEntities(db)) {
    try {
      total += await db.transaction(async (tx) => {
        const values = await lockMediaReferencingEntity(tx, entity)
        if (!values) return 0 // deleted meanwhile (its delete cleared its rows)
        return (
          await syncMediaUsages(
            tx,
            entity.entityType,
            entity.entityId,
            ...values
          )
        ).length
      })
    } catch (err) {
      if (!(err instanceof MissingMediaError)) throw err
      skipped.push(`${entity.entityType}:${entity.entityId}`)
    }
  }
  if (skipped.length > 0)
    console.warn(
      `[media] usages backfill skipped entities with missing media: ${skipped.join(", ")}`
    )
  return total
}
