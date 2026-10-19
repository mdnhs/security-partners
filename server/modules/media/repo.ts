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
  notInArray,
  notLike,
  or,
  sql,
} from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { containsPattern } from "@/server/db/like"
import {
  articles,
  builderPages,
  clients,
  groupCompanies,
  media,
  type MEDIA_DRIVERS,
  mediaUsages,
  pages,
  services,
  settings,
  teamMembers,
} from "@/server/db/schema"

type MediaRow = typeof media.$inferSelect

export async function findMediaById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(media).where(eq(media.id, id))
  return row ?? null
}

/**
 * Same, FOR UPDATE until the transaction ends: replace, edit and delete of
 * one file run one after another (a second replace sees the first one's key).
 */
export async function lockMediaRow(
  db: DbOrTx,
  id: string
): Promise<MediaRow | null> {
  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.id, id))
    .for("update")
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

/** The subset of `ids` whose stored file is not an image (e.g. a PDF). */
export async function nonImageMediaIds(
  db: DbOrTx,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await db
    .select({ id: media.id })
    .from(media)
    .where(and(inArray(media.id, ids), notLike(media.mime, "image/%")))
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
  const pattern = opts.q ? containsPattern(opts.q) : null
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

/** Usage rows of one file (usages panel, delete refusal). */
export function listMediaUsages(db: DbOrTx, mediaId: string) {
  return db
    .select({
      entityType: mediaUsages.entityType,
      entityId: mediaUsages.entityId,
      field: mediaUsages.field,
    })
    .from(mediaUsages)
    .where(eq(mediaUsages.mediaId, mediaId))
    .orderBy(
      asc(mediaUsages.entityType),
      asc(mediaUsages.entityId),
      asc(mediaUsages.field)
    )
}

/** Display names of usage targets, keyed "<entityType>:<entityId>". */
export async function usageTargets(
  db: DbOrTx,
  usages: { entityType: string; entityId: string }[]
): Promise<Map<string, string>> {
  const ids = (type: string) => [
    ...new Set(
      usages.filter((u) => u.entityType === type).map((u) => u.entityId)
    ),
  ]
  const names = new Map<string, string>()
  const add = (type: string, rows: { id: string; name: string | null }[]) => {
    for (const row of rows) names.set(`${type}:${row.id}`, row.name ?? "")
  }
  const serviceIds = ids("service")
  if (serviceIds.length)
    add(
      "service",
      await db
        .select({
          id: services.id,
          name: sql<string | null>`${services.draft}->>'title'`,
        })
        .from(services)
        .where(inArray(services.id, serviceIds))
    )
  const articleIds = ids("article")
  if (articleIds.length)
    add(
      "article",
      await db
        .select({
          id: articles.id,
          name: sql<string | null>`${articles.draft}->>'title'`,
        })
        .from(articles)
        .where(inArray(articles.id, articleIds))
    )
  const teamIds = ids("team")
  if (teamIds.length)
    add(
      "team",
      await db
        .select({ id: teamMembers.id, name: teamMembers.name })
        .from(teamMembers)
        .where(inArray(teamMembers.id, teamIds))
    )
  const clientIds = ids("client")
  if (clientIds.length)
    add(
      "client",
      await db
        .select({ id: clients.id, name: clients.name })
        .from(clients)
        .where(inArray(clients.id, clientIds))
    )
  const groupIds = ids("groupCompany")
  if (groupIds.length)
    add(
      "groupCompany",
      await db
        .select({ id: groupCompanies.id, name: groupCompanies.name })
        .from(groupCompanies)
        .where(inArray(groupCompanies.id, groupIds))
    )
  const builderIds = ids("builder-page")
  if (builderIds.length)
    add(
      "builder-page",
      await db
        .select({ id: builderPages.id, name: builderPages.title })
        .from(builderPages)
        .where(inArray(builderPages.id, builderIds))
    )
  return names
}

export async function updateMediaRow(
  db: DbOrTx,
  id: string,
  patch: Partial<
    Omit<typeof media.$inferInsert, "id" | "createdAt" | "createdBy">
  >
): Promise<MediaRow | null> {
  const [row] = await db
    .update(media)
    .set(patch)
    .where(eq(media.id, id))
    .returning()
  return row ?? null
}

/** Throws the FK error (23503) when a RESTRICT reference still points at it. */
export async function deleteMediaRow(db: DbOrTx, id: string): Promise<boolean> {
  const deleted = await db
    .delete(media)
    .where(eq(media.id, id))
    .returning({ id: media.id })
  return deleted.length > 0
}

/** One entity that can reference media (media_usages entity type + id). */
export type MediaReferencingEntity = { entityType: string; entityId: string }

/**
 * Every entity that can reference media: pages, non-integration settings
 * (integrations never hold media), services, articles, team members,
 * clients, group companies.
 */
export async function listMediaReferencingEntities(
  db: DbOrTx
): Promise<MediaReferencingEntity[]> {
  const of = (entityType: string, rows: { id: string }[]) =>
    rows.map((row) => ({ entityType, entityId: row.id }))
  return [
    ...of("page", await db.select({ id: pages.key }).from(pages)),
    ...of(
      "settings",
      await db
        .select({ id: settings.key })
        .from(settings)
        .where(notLike(settings.key, "integrations.%"))
    ),
    ...of("service", await db.select({ id: services.id }).from(services)),
    ...of("article", await db.select({ id: articles.id }).from(articles)),
    ...of("team", await db.select({ id: teamMembers.id }).from(teamMembers)),
    ...of("client", await db.select({ id: clients.id }).from(clients)),
    ...of(
      "groupCompany",
      await db.select({ id: groupCompanies.id }).from(groupCompanies)
    ),
    ...of(
      "builder-page",
      await db.select({ id: builderPages.id }).from(builderPages)
    ),
  ]
}

/**
 * Locks one entity's row FOR UPDATE and returns the values its service
 * syncs into media_usages (Phase 4/5 shapes: versioned JSON draft +
 * published; collections as { photo } / { logo }). null = row gone.
 */
export async function lockMediaReferencingEntity(
  db: DbOrTx,
  { entityType, entityId }: MediaReferencingEntity
): Promise<unknown[] | null> {
  switch (entityType) {
    case "page": {
      const [row] = await db
        .select({
          draft: pages.draft,
          published: pages.published,
          seo: pages.seo,
        })
        .from(pages)
        .where(eq(pages.key, entityId))
        .for("update")
      return row ? [row.draft, row.published, { seo: row.seo }] : null
    }
    case "settings": {
      const [row] = await db
        .select({ draft: settings.draft, published: settings.published })
        .from(settings)
        .where(eq(settings.key, entityId))
        .for("update")
      return row ? [row.draft, row.published] : null
    }
    case "service": {
      const [row] = await db
        .select({
          draft: services.draft,
          published: services.published,
          seo: services.seo,
        })
        .from(services)
        .where(eq(services.id, entityId))
        .for("update")
      return row ? [row.draft, row.published, { seo: row.seo }] : null
    }
    case "article": {
      const [row] = await db
        .select({
          draft: articles.draft,
          published: articles.published,
          seo: articles.seo,
        })
        .from(articles)
        .where(eq(articles.id, entityId))
        .for("update")
      return row ? [row.draft, row.published, { seo: row.seo }] : null
    }
    case "team": {
      const [row] = await db
        .select({ photoId: teamMembers.photoId })
        .from(teamMembers)
        .where(eq(teamMembers.id, entityId))
        .for("update")
      return row
        ? [{ photo: row.photoId ? { mediaId: row.photoId } : null }]
        : null
    }
    case "client": {
      const [row] = await db
        .select({ logoId: clients.logoId })
        .from(clients)
        .where(eq(clients.id, entityId))
        .for("update")
      return row ? [{ logo: { mediaId: row.logoId } }] : null
    }
    case "groupCompany": {
      const [row] = await db
        .select({ logoId: groupCompanies.logoId })
        .from(groupCompanies)
        .where(eq(groupCompanies.id, entityId))
        .for("update")
      return row ? [{ logo: { mediaId: row.logoId } }] : null
    }
    case "builder-page": {
      const [row] = await db
        .select({
          draft: builderPages.draft,
          published: builderPages.published,
          seo: builderPages.seo,
        })
        .from(builderPages)
        .where(eq(builderPages.id, entityId))
        .for("update")
      return row ? [row.draft, row.published, { seo: row.seo }] : null
    }
    default:
      return null
  }
}

/** The next disk rows to move to R2, oldest first (static rows never move). */
export function listDiskMediaBatch(
  db: DbOrTx,
  opts: { limit: number; excludeIds: string[] }
) {
  return db
    .select({ id: media.id, key: media.key, mime: media.mime })
    .from(media)
    .where(
      and(
        eq(media.driver, "disk"),
        opts.excludeIds.length
          ? notInArray(media.id, opts.excludeIds)
          : undefined
      )
    )
    .orderBy(asc(media.createdAt), asc(media.id))
    .limit(opts.limit)
}

/** disk → r2 only while the row still holds this key on disk (replace/delete win). */
export async function markMovedToR2(
  db: DbOrTx,
  id: string,
  key: string
): Promise<boolean> {
  const moved = await db
    .update(media)
    .set({ driver: "r2" })
    .where(and(eq(media.id, id), eq(media.driver, "disk"), eq(media.key, key)))
    .returning({ id: media.id })
  return moved.length > 0
}
