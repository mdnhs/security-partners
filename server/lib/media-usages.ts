import "server-only"

import { collectMediaFields, type MediaField } from "@/lib/media"
import type { DbOrTx } from "@/server/db/client"
import {
  deleteMediaUsages,
  existingMediaIds,
  listMediaReferencingEntities,
  listMediaUsagesFor,
  lockMediaReferencingEntity,
  nonImageMediaIds,
  nonLottieMediaIds,
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

const NOT_IMAGE_MESSAGE = "This file is not an image. Choose an image."

function notAnImage(usages: MediaField[]): AppError {
  const fieldErrors: Record<string, string[]> = {}
  for (const usage of usages) fieldErrors[usage.field] = [NOT_IMAGE_MESSAGE]
  return new AppError("VALIDATION_FAILED", "Some files are not images", {
    fieldErrors,
  })
}

/**
 * The media fields that take a Lottie animation instead of an image, by
 * entity ("<entityType>:<entityId>") and field path. Every other media
 * field is an image field.
 */
const LOTTIE_FIELDS: Record<string, ReadonlySet<string>> = {
  "settings:site": new Set(["logoAnimation"]),
}

const NOT_LOTTIE_MESSAGE =
  "This file is not a Lottie animation. Choose a .json or .lottie animation."

function notALottie(usages: MediaField[]): AppError {
  const fieldErrors: Record<string, string[]> = {}
  for (const usage of usages) fieldErrors[usage.field] = [NOT_LOTTIE_MESSAGE]
  return new AppError("VALIDATION_FAILED", "Some files are not animations", {
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
 * Every media field in the content schemas is an image field except the
 * LOTTIE_FIELDS, so a new reference of the wrong kind (a PDF or a Lottie
 * picked through the API for an image, an image for an animation) → 422 on
 * its field too; references the entity already had are left alone.
 */
export async function syncMediaUsages(
  tx: DbOrTx,
  entityType: string,
  entityId: string,
  ...values: unknown[]
): Promise<MediaField[]> {
  return syncUsages(tx, entityType, entityId, values, true)
}

async function syncUsages(
  tx: DbOrTx,
  entityType: string,
  entityId: string,
  values: unknown[],
  requireImages: boolean
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
  if (requireImages) {
    // The picker only offers images; the server must not trust that. Only
    // references NEW to this entity are checked: values stored before this
    // rule (e.g. a published PDF reference) must never block a save, an
    // SEO edit or the publish that replaces them.
    const lottieFields = LOTTIE_FIELDS[`${entityType}:${entityId}`]
    const isLottieField = (u: MediaField) => !!lottieFields?.has(u.field)
    const stored = await listMediaUsagesFor(tx, entityType, entityId)
    // Image fields: files this entity already used in an image field.
    // Animation fields: only the same file in the same field.
    const known = new Set(
      stored.filter((u) => !isLottieField(u)).map((u) => u.mediaId)
    )
    const knownInField = new Set(stored.map((u) => `${u.mediaId} ${u.field}`))
    const imageRefs = usages.filter(
      (u) => !isLottieField(u) && !known.has(u.mediaId)
    )
    const lottieRefs = usages.filter(
      (u) => isLottieField(u) && !knownInField.has(`${u.mediaId} ${u.field}`)
    )
    const notImages = await nonImageMediaIds(tx, [
      ...new Set(imageRefs.map((u) => u.mediaId)),
    ])
    const wrongKind = imageRefs.filter((u) => notImages.has(u.mediaId))
    if (wrongKind.length > 0) throw notAnImage(wrongKind)
    const notLottie = await nonLottieMediaIds(tx, [
      ...new Set(lottieRefs.map((u) => u.mediaId)),
    ])
    const wrongLottie = lottieRefs.filter((u) => notLottie.has(u.mediaId))
    if (wrongLottie.length > 0) throw notALottie(wrongLottie)
  }
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
        // Records what is stored as-is (no image check): the rows must
        // protect every referenced file from deletion, whatever its kind.
        return (
          await syncUsages(
            tx,
            entity.entityType,
            entity.entityId,
            values,
            false
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
