import "server-only"

import { and, asc, eq, getTableColumns, isNotNull, max, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { legalPages, redirects, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"
import type { LegalTemplate } from "@/templates/legal/schema"

const withEditor = { ...getTableColumns(legalPages), updatedByName: users.name }

function editQuery(db: DbOrTx) {
  return db
    .select(withEditor)
    .from(legalPages)
    .leftJoin(users, eq(users.id, legalPages.updatedBy))
}

/** One legal page plus the name of whoever changed it last (admin editor). */
export async function findLegalPageForEdit(db: DbOrTx, id: string) {
  const [row] = await editQuery(db).where(eq(legalPages.id, id))
  return row ?? null
}

export type LegalPageRow = NonNullable<
  Awaited<ReturnType<typeof findLegalPageForEdit>>
>

/**
 * The admin list, in footer order: columns only, never the documents.
 * `dirty` mirrors versionedDto (unpublished, or draft differs from published).
 */
export function listLegalPageSummaries(db: DbOrTx) {
  return db
    .select({
      id: legalPages.id,
      slug: legalPages.slug,
      title: legalPages.title,
      status: legalPages.status,
      sortOrder: legalPages.sortOrder,
      dirty: sql<boolean>`(${legalPages.published} is null or ${legalPages.draft} <> ${legalPages.published})`,
      updatedAt: legalPages.updatedAt,
      updatedByName: users.name,
    })
    .from(legalPages)
    .leftJoin(users, eq(users.id, legalPages.updatedBy))
    .orderBy(
      asc(legalPages.sortOrder),
      asc(legalPages.title),
      asc(legalPages.id)
    )
}

/** Every id with its order, to check a reorder names exactly these pages. */
export function listLegalPageIds(db: DbOrTx) {
  return db.select({ id: legalPages.id }).from(legalPages)
}

/** Locks the row FOR UPDATE (delete), like builder pages. */
export async function lockLegalPage(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      slug: legalPages.slug,
      version: legalPages.version,
      published: legalPages.published,
    })
    .from(legalPages)
    .where(eq(legalPages.id, id))
    .for("update")
  return row ?? null
}

/** The next footer position: after every existing page. */
export async function nextSortOrder(db: DbOrTx): Promise<number> {
  const [row] = await db
    .select({ top: max(legalPages.sortOrder) })
    .from(legalPages)
  return (row?.top ?? -1) + 1
}

export async function insertLegalPage(
  db: DbOrTx,
  values: {
    slug: string
    title: string
    draft: LegalTemplate
    sortOrder: number
    createdBy: string
  }
): Promise<string> {
  const [row] = await db
    .insert(legalPages)
    .values({ ...values, updatedBy: values.createdBy, status: "draft" })
    .returning({ id: legalPages.id })
  return row.id
}

/** Versioned columns plus the page's own (title, slug). */
export type LegalPagePatch = VersionedPatch<LegalTemplate> & {
  title?: string
  slug?: string
}

/** Optimistic-lock update: only when `version` is current; null otherwise. */
export async function updateLegalPageIfVersion(
  db: DbOrTx,
  id: string,
  version: number,
  patch: LegalPagePatch
): Promise<LegalPageRow | null> {
  const [updated] = await db
    .update(legalPages)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(legalPages.id, id), eq(legalPages.version, version)))
    .returning({ id: legalPages.id })
  return updated ? findLegalPageForEdit(db, id) : null
}

export async function setSortOrder(
  db: DbOrTx,
  id: string,
  sortOrder: number
): Promise<void> {
  // updated_at is left alone: moving a page is not editing its content.
  await db
    .update(legalPages)
    .set({ sortOrder, updatedAt: sql`${legalPages.updatedAt}` })
    .where(eq(legalPages.id, id))
}

export async function deleteLegalPageRow(
  db: DbOrTx,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(legalPages)
    .where(eq(legalPages.id, id))
    .returning({ id: legalPages.id })
  return rows.length > 0
}

/** Public read by address (published and draft columns). */
export async function findLegalPageBySlug(db: DbOrTx, slug: string) {
  const [row] = await db
    .select({
      id: legalPages.id,
      title: legalPages.title,
      draft: legalPages.draft,
      published: legalPages.published,
      publishedAt: legalPages.publishedAt,
      updatedAt: legalPages.updatedAt,
    })
    .from(legalPages)
    .where(eq(legalPages.slug, slug))
  return row ?? null
}

/** The footer: published pages (address and title), in order. */
export function listPublishedLegalLinks(db: DbOrTx) {
  return db
    .select({ slug: legalPages.slug, title: legalPages.title })
    .from(legalPages)
    .where(isNotNull(legalPages.published))
    .orderBy(
      asc(legalPages.sortOrder),
      asc(legalPages.title),
      asc(legalPages.id)
    )
}

/** Any redirect (On or Off) that starts at `fromPath`: its target, or null. */
export async function findRedirectAt(
  db: DbOrTx,
  fromPath: string
): Promise<{ toPath: string } | null> {
  const [row] = await db
    .select({ toPath: redirects.toPath })
    .from(redirects)
    .where(eq(redirects.fromPath, fromPath))
    .limit(1)
  return row ?? null
}
