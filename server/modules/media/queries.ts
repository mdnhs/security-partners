import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import {
  collectMediaIds,
  type MediaView,
  replaceMediaRefs,
  type WithMedia,
} from "@/lib/media"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { AppError } from "@/server/lib/errors"

import { findMediaById } from "./repo"

type MediaRow = NonNullable<Awaited<ReturnType<typeof findMediaById>>>

/**
 * Public URL of a media row. "static" files ship in public/ (key is the
 * path), so seeded content renders the same src as the static site. The
 * disk and R2 drivers are wired by the storage layer in Phase 6.
 */
export function mediaUrl(row: Pick<MediaRow, "driver" | "key">): string {
  if (row.driver === "static") return row.key
  if (row.driver === "disk")
    return `/api/v1/media/file/${encodeURIComponent(row.key)}`
  throw new AppError("INTERNAL", "R2 media URLs need the storage driver")
}

export async function getMedia(id: string): Promise<MediaView | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.media(id))
  const row = await findMediaById(getDb(), id)
  if (!row) return null
  return {
    id: row.id,
    url: mediaUrl(row),
    alt: row.alt,
    width: row.width,
    height: row.height,
    blurDataUrl: row.blurDataUrl,
  }
}

/**
 * Replaces every `{ mediaId }` in `value` with its MediaView. A reference
 * to a missing media row is a content bug: it throws (error page) instead
 * of rendering a broken image.
 */
export async function resolveMedia<T>(value: T): Promise<WithMedia<T>> {
  const ids = [...collectMediaIds(value)]
  const views = await Promise.all(ids.map((id) => getMedia(id)))
  const byId = new Map<string, MediaView>()
  ids.forEach((id, i) => {
    const view = views[i]
    if (!view) throw new AppError("INTERNAL", `Media ${id} not found`)
    byId.set(id, view)
  })
  return replaceMediaRefs(value, (id) => byId.get(id)!)
}
