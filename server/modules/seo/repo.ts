import "server-only"

import { asc, eq, type SQL, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import type { SeoKind } from "@/lib/schemas/api/seo"
import type { Seo } from "@/lib/schemas/common"
import type { DbOrTx } from "@/server/db/client"
import { articles, pages, services } from "@/server/db/schema"

/** What the SEO overview needs of one record (no whole content documents). */
export type SeoRow = {
  kind: SeoKind
  /** Page key or row id. */
  id: string
  slug: string | null
  seo: Seo
  published: boolean
  /** Page hero title, service or article title (published, else draft). */
  title: string | null
  /** Service intro / article excerpt (published, else draft); null for pages. */
  description: string | null
}

type Versioned = { draft: AnyPgColumn; published: AnyPgColumn }

/** One text field of the live content, or of the draft when unpublished. */
const field = (table: Versioned, ...path: string[]): SQL<string | null> => {
  const at = `{${path.join(",")}}`
  return sql<string | null>`case when ${table.published} is null
    then ${table.draft} #>> ${at}::text[]
    else ${table.published} #>> ${at}::text[] end`
}

const pageColumns = {
  id: pages.key,
  seo: pages.seo,
  published: sql<boolean>`${pages.published} is not null`,
  title: field(pages, "hero", "title"),
}
const serviceColumns = {
  id: services.id,
  slug: services.slug,
  seo: services.seo,
  published: sql<boolean>`${services.published} is not null`,
  title: field(services, "title"),
  description: field(services, "detail", "intro"),
}
const articleColumns = {
  id: articles.id,
  slug: articles.slug,
  seo: articles.seo,
  published: sql<boolean>`${articles.published} is not null`,
  title: field(articles, "title"),
  description: field(articles, "excerpt"),
}

const page = (row: Omit<SeoRow, "kind" | "slug" | "description">): SeoRow => ({
  kind: "page",
  slug: null,
  description: null,
  ...row,
})

/** Every page, service and article (published or not) for the SEO overview. */
export async function listSeoRows(db: DbOrTx): Promise<SeoRow[]> {
  const [pageRows, serviceRows, articleRows] = await Promise.all([
    db.select(pageColumns).from(pages).orderBy(asc(pages.key)),
    db
      .select(serviceColumns)
      .from(services)
      .orderBy(asc(services.sortOrder), asc(services.slug)),
    db
      .select(articleColumns)
      .from(articles)
      .orderBy(
        sql`${articles.publishedAt} desc nulls last`,
        asc(articles.slug)
      ),
  ])
  return [
    ...pageRows.map(page),
    ...serviceRows.map((row) => ({ kind: "service" as const, ...row })),
    ...articleRows.map((row) => ({ kind: "article" as const, ...row })),
  ]
}

export async function findSeoRow(
  db: DbOrTx,
  kind: SeoKind,
  id: string
): Promise<SeoRow | null> {
  if (kind === "page") {
    const [row] = await db
      .select(pageColumns)
      .from(pages)
      .where(eq(pages.key, id))
    return row ? page(row) : null
  }
  if (kind === "service") {
    const [row] = await db
      .select(serviceColumns)
      .from(services)
      .where(eq(services.id, id))
    return row ? { kind, ...row } : null
  }
  const [row] = await db
    .select(articleColumns)
    .from(articles)
    .where(eq(articles.id, id))
  return row ? { kind, ...row } : null
}

export type SeoMediaRow = {
  slug: string | null
  seo: Seo
  draft: unknown
  published: unknown
}

/**
 * Locks the record's row (FOR UPDATE) and returns what its media_usages
 * are synced from. A concurrent draft save waits for this transaction, or
 * this read waits for it, so neither syncs from stale content.
 */
export async function lockSeoMediaRow(
  db: DbOrTx,
  kind: SeoKind,
  id: string
): Promise<SeoMediaRow | null> {
  if (kind === "page") {
    const [row] = await db
      .select({
        seo: pages.seo,
        draft: pages.draft,
        published: pages.published,
      })
      .from(pages)
      .where(eq(pages.key, id))
      .for("update")
    return row ? { slug: null, ...row } : null
  }
  const table = kind === "service" ? services : articles
  const [row] = await db
    .select({
      slug: table.slug,
      seo: table.seo,
      draft: table.draft,
      published: table.published,
    })
    .from(table)
    .where(eq(table.id, id))
    .for("update")
  return row ?? null
}

/** Writes only the seo column: the record's version and draft stay as they are. */
export async function updateSeoColumn(
  db: DbOrTx,
  kind: SeoKind,
  id: string,
  seo: Seo
): Promise<void> {
  if (kind === "page")
    await db.update(pages).set({ seo }).where(eq(pages.key, id))
  else if (kind === "service")
    await db.update(services).set({ seo }).where(eq(services.id, id))
  else await db.update(articles).set({ seo }).where(eq(articles.id, id))
}
