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
  notLike,
  or,
} from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import {
  media,
  type MEDIA_DRIVERS,
  mediaUsages,
  settings,
} from "@/server/db/schema"

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

/** Paginated library rows (picker + library). `q` matches alt text, key or file name. */
export async function listMediaRows(
  db: DbOrTx,
  opts: {
    q?: string
    kind?: "image" | "document"
    sort: { field: "createdAt" | "alt"; dir: "asc" | "desc" }
    page: number
    pageSize: number
  }
) {
  const pattern = opts.q ? `%${escapeLike(opts.q)}%` : null
  const where = and(
    opts.kind === "image"
      ? like(media.mime, "image/%")
      : opts.kind === "document"
        ? notLike(media.mime, "image/%")
        : undefined,
    pattern
      ? or(
          ilike(media.alt, pattern),
          ilike(media.key, pattern),
          ilike(media.originalName, pattern)
        )
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

/** Rows stored by one driver (integrations: R2 cannot be disconnected while it holds files). */
export async function countMediaByDriver(
  db: DbOrTx,
  driver: (typeof MEDIA_DRIVERS)[number]
): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(media)
    .where(eq(media.driver, driver))
  return n
}

export async function insertMediaRow(
  db: DbOrTx,
  values: typeof media.$inferInsert
) {
  const [row] = await db.insert(media).values(values).returning()
  return row
}

/** A disk or R2 row by key (the public file route never serves static rows). */
export async function findServableMedia(db: DbOrTx, key: string) {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.key, key), inArray(media.driver, ["disk", "r2"])))
    .limit(1)
  return row ?? null
}

/** Identity of the saved R2 settings row: changes on every save or disconnect + reconnect. */
export type R2SettingsStamp = { version: number; updatedAt: Date }

const R2_SETTINGS_KEY = "integrations.r2"

/** The R2 settings row's stamp without locking (null = R2 not configured). */
export async function readR2Settings(
  db: DbOrTx
): Promise<R2SettingsStamp | null> {
  const [row] = await db
    .select({ version: settings.version, updatedAt: settings.updatedAt })
    .from(settings)
    .where(eq(settings.key, R2_SETTINGS_KEY))
  return row ?? null
}

/**
 * Same, under FOR SHARE until the transaction ends: an R2 Disconnect or
 * save (which lock or change the row) waits for the upload that writes an
 * r2 media row, and an upload sees a Disconnect that committed first.
 */
export async function lockR2Settings(
  db: DbOrTx
): Promise<R2SettingsStamp | null> {
  const [row] = await db
    .select({ version: settings.version, updatedAt: settings.updatedAt })
    .from(settings)
    .where(eq(settings.key, R2_SETTINGS_KEY))
    .for("share")
  return row ?? null
}
