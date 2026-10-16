import "server-only"

import { collectMediaFields, type MediaField } from "@/lib/media"
import type { DbOrTx } from "@/server/db/client"
import {
  deleteMediaUsages,
  existingMediaIds,
  replaceMediaUsages,
} from "@/server/modules/media/repo"

import { AppError } from "./errors"

/**
 * Rewrites the media_usages rows of one entity from the values it stores
 * (e.g. draft + published), inside the caller's transaction. media_usages
 * restricts deleting media in use (ledger ruling), so every save keeps
 * these rows exact. A reference to a missing media row → 422 on its field.
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
  if (missing.length > 0) {
    const fieldErrors: Record<string, string[]> = {}
    for (const usage of missing)
      fieldErrors[usage.field] = [
        "This image is no longer in the media library. Choose another.",
      ]
    throw new AppError("VALIDATION_FAILED", "Some images are missing", {
      fieldErrors,
    })
  }
  await replaceMediaUsages(tx, entityType, entityId, usages)
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
