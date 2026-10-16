import "server-only"

import { hasPermission } from "@/lib/auth/permissions"
import type { Paginated } from "@/lib/schemas/api/list"
import type { MediaItem, MediaListQuery } from "@/lib/schemas/api/media"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { forbidden, notFound } from "@/server/lib/errors"

import { mediaUrl } from "./queries"
import { findMediaById, listMediaRows } from "./repo"

type MediaRow = NonNullable<Awaited<ReturnType<typeof findMediaById>>>

function toItem(row: MediaRow): MediaItem {
  return {
    id: row.id,
    url: mediaUrl(row),
    alt: row.alt,
    mime: row.mime,
    width: row.width,
    height: row.height,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
  }
}

function assertCanRead(actor: Actor) {
  if (!hasPermission(actor.roles, { media: ["read"] })) throw forbidden()
}

/** Library rows for the picker (Phase 6 adds upload, alt/focal edits, usages). */
export async function listMedia(
  actor: Actor,
  query: MediaListQuery
): Promise<Paginated<MediaItem>> {
  assertCanRead(actor)
  const { rows, total } = await listMediaRows(getDb(), {
    q: query.q || undefined,
    imagesOnly: query.kind === "image",
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(toItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getMediaItem(
  actor: Actor,
  id: string
): Promise<MediaItem> {
  assertCanRead(actor)
  const row = await findMediaById(getDb(), id)
  if (!row) throw notFound("Media")
  return toItem(row)
}
