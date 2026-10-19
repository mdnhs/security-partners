import "server-only"

import { and, asc, eq, getTableColumns, isNotNull, sql } from "drizzle-orm"

import type { DraftDocument } from "@/blocks/document"
import type { DbOrTx } from "@/server/db/client"
import { builderPages, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

const withEditor = {
  ...getTableColumns(builderPages),
  updatedByName: users.name,
}

function editQuery(db: DbOrTx) {
  return db
    .select(withEditor)
    .from(builderPages)
    .leftJoin(users, eq(users.id, builderPages.updatedBy))
}

/** One builder page plus the name of whoever changed it last (admin editor). */
export async function findBuilderPageForEdit(db: DbOrTx, id: string) {
  const [row] = await editQuery(db).where(eq(builderPages.id, id))
  return row ?? null
}

export type BuilderPageRow = NonNullable<
  Awaited<ReturnType<typeof findBuilderPageForEdit>>
>

/**
 * The admin list: columns only, never the documents. `dirty` mirrors
 * versionedDto (unpublished, or draft ≠ published; jsonb equality ignores
 * key order like isDeepEqual).
 */
export function listBuilderPageSummaries(db: DbOrTx) {
  return db
    .select({
      id: builderPages.id,
      slug: builderPages.slug,
      title: builderPages.title,
      status: builderPages.status,
      dirty: sql<boolean>`(${builderPages.published} is null or ${builderPages.draft} <> ${builderPages.published})`,
      updatedAt: builderPages.updatedAt,
      updatedByName: users.name,
    })
    .from(builderPages)
    .leftJoin(users, eq(users.id, builderPages.updatedBy))
    .orderBy(asc(builderPages.title), asc(builderPages.slug))
}

/**
 * Locks the page row FOR UPDATE (delete): a draft save that holds the row
 * finishes first, and one that starts later waits and then finds no row.
 */
export async function lockBuilderPage(db: DbOrTx, id: string) {
  const [row] = await db
    .select({
      slug: builderPages.slug,
      version: builderPages.version,
      published: builderPages.published,
    })
    .from(builderPages)
    .where(eq(builderPages.id, id))
    .for("update")
  return row ?? null
}

export async function insertBuilderPage(
  db: DbOrTx,
  values: {
    slug: string
    title: string
    draft: DraftDocument
    createdBy: string
  }
): Promise<string> {
  const [row] = await db
    .insert(builderPages)
    .values({ ...values, updatedBy: values.createdBy, status: "draft" })
    .returning({ id: builderPages.id })
  return row.id
}

/** Versioned columns plus the page's own (title, slug). */
export type BuilderPagePatch = VersionedPatch<DraftDocument> & {
  title?: string
  slug?: string
}

/** Optimistic-lock update: only when `version` is current; null otherwise. */
export async function updateBuilderPageIfVersion(
  db: DbOrTx,
  id: string,
  version: number,
  patch: BuilderPagePatch
): Promise<BuilderPageRow | null> {
  const [updated] = await db
    .update(builderPages)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(builderPages.id, id), eq(builderPages.version, version)))
    .returning({ id: builderPages.id })
  return updated ? findBuilderPageForEdit(db, id) : null
}

export async function deleteBuilderPageRow(
  db: DbOrTx,
  id: string
): Promise<boolean> {
  const rows = await db
    .delete(builderPages)
    .where(eq(builderPages.id, id))
    .returning({ id: builderPages.id })
  return rows.length > 0
}

/** Public read by address (published and draft columns). */
export async function findBuilderPageBySlug(db: DbOrTx, slug: string) {
  const [row] = await db
    .select({
      id: builderPages.id,
      title: builderPages.title,
      seo: builderPages.seo,
      draft: builderPages.draft,
      published: builderPages.published,
      updatedAt: builderPages.updatedAt,
    })
    .from(builderPages)
    .where(eq(builderPages.slug, slug))
  return row ?? null
}

export async function isPublishedBuilderSlug(
  db: DbOrTx,
  slug: string
): Promise<boolean> {
  const rows = await db
    .select({ id: builderPages.id })
    .from(builderPages)
    .where(and(eq(builderPages.slug, slug), isNotNull(builderPages.published)))
    .limit(1)
  return rows.length > 0
}

/** True when a published builder page shows a (not hidden) newsletter block. */
export async function hasPublishedNewsletterBlock(
  db: DbOrTx
): Promise<boolean> {
  const rows = await db
    .select({ id: builderPages.id })
    .from(builderPages)
    .where(
      sql`${builderPages.published} -> 'blocks' @> '[{"type":"newsletter","hidden":false}]'::jsonb`
    )
    .limit(1)
  return rows.length > 0
}
