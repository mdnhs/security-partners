import "server-only"

import { and, asc, desc, eq, isNotNull, type SQL, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

import type { SeoKind } from "@/lib/schemas/api/seo"
import type { Seo } from "@/lib/schemas/common"
import type { OgKind } from "@/lib/seo/urls"
import type { DbOrTx } from "@/server/db/client"
import {
  articles,
  builderPages,
  pages,
  revisions,
  services,
} from "@/server/db/schema"

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

const builderColumns = {
  id: builderPages.id,
  slug: builderPages.slug,
  seo: builderPages.seo,
  published: sql<boolean>`${builderPages.published} is not null`,
  title: builderPages.title,
  /** The page hero's intro (a hero.page block is always first). */
  description: field(builderPages, "blocks", "0", "data", "description"),
}

const page = (row: Omit<SeoRow, "kind" | "slug" | "description">): SeoRow => ({
  kind: "page",
  slug: null,
  description: null,
  ...row,
})

/** Every page, service, article and builder page (published or not) for the SEO overview. */
export async function listSeoRows(db: DbOrTx): Promise<SeoRow[]> {
  const [pageRows, serviceRows, articleRows, builderRows] = await Promise.all([
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
    db
      .select(builderColumns)
      .from(builderPages)
      .orderBy(asc(builderPages.title), asc(builderPages.slug)),
  ])
  return [
    ...pageRows.map(page),
    ...serviceRows.map((row) => ({ kind: "service" as const, ...row })),
    ...articleRows.map((row) => ({ kind: "article" as const, ...row })),
    ...builderRows.map((row) => ({ kind: "builder" as const, ...row })),
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
  if (kind === "builder") {
    const [row] = await db
      .select(builderColumns)
      .from(builderPages)
      .where(eq(builderPages.id, id))
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
  const table =
    kind === "service" ? services : kind === "builder" ? builderPages : articles
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
  else if (kind === "builder")
    await db.update(builderPages).set({ seo }).where(eq(builderPages.id, id))
  else await db.update(articles).set({ seo }).where(eq(articles.id, id))
}

export type SitemapRow = {
  kind: "page" | "service" | "article"
  /** Page key or slug. */
  key: string
  seo: Seo
  publishedAt: Date | null
  /** Time of the newest revision (one is written per publish). */
  lastPublish: Date | null
}

/** Newest revision of one record (prefix of revisions_entity_version_unique). */
const lastPublish = (entityType: string, entityId: SQL) =>
  sql<Date | null>`(select max(${revisions.createdAt}) from ${revisions} where ${revisions.entityType} = ${entityType} and ${revisions.entityId} = ${entityId})`.mapWith(
    revisions.createdAt
  )

/** Published pages, services and articles for the sitemap (never drafts). */
export async function listSitemapRows(db: DbOrTx): Promise<SitemapRow[]> {
  const [pageRows, serviceRows, articleRows] = await Promise.all([
    db
      .select({
        key: pages.key,
        seo: pages.seo,
        publishedAt: pages.publishedAt,
        lastPublish: lastPublish("page", sql`${pages.key}`),
      })
      .from(pages)
      .where(isNotNull(pages.published))
      .orderBy(asc(pages.key)),
    db
      .select({
        key: services.slug,
        seo: services.seo,
        publishedAt: services.publishedAt,
        lastPublish: lastPublish("service", sql`${services.id}::text`),
      })
      .from(services)
      .where(isNotNull(services.published))
      .orderBy(asc(services.sortOrder), asc(services.slug)),
    db
      .select({
        key: articles.slug,
        seo: articles.seo,
        publishedAt: articles.publishedAt,
        lastPublish: lastPublish("article", sql`${articles.id}::text`),
      })
      .from(articles)
      .where(isNotNull(articles.published))
      .orderBy(desc(articles.publishedAt), asc(articles.slug)),
  ])
  return [
    ...pageRows.map((row) => ({ kind: "page" as const, ...row })),
    ...serviceRows.map((row) => ({ kind: "service" as const, ...row })),
    ...articleRows.map((row) => ({ kind: "article" as const, ...row })),
  ]
}

/**
 * The published name of a record: a page's hero title, a service's or
 * article's title. null when the record is published but has no name of
 * its own (home, or a page without a hero title): the caller uses the
 * site title. undefined when the record is unknown or not published
 * (drafts never reach share cards).
 */
export async function findPublishedName(
  db: DbOrTx,
  kind: OgKind,
  id: string
): Promise<string | null | undefined> {
  if (kind === "page") {
    const [row] = await db
      .select({ published: pages.published })
      .from(pages)
      .where(eq(pages.key, id))
    if (!row?.published) return undefined
    if (id === "home") return null
    const title = (row.published as { hero?: { title?: unknown } }).hero?.title
    return typeof title === "string" ? title : null
  }
  if (kind === "service") {
    const [row] = await db
      .select({ title: sql<string | null>`${services.published}->>'title'` })
      .from(services)
      .where(and(eq(services.slug, id), isNotNull(services.published)))
    return row ? row.title : undefined
  }
  const [row] = await db
    .select({ title: sql<string | null>`${articles.published}->>'title'` })
    .from(articles)
    .where(and(eq(articles.slug, id), isNotNull(articles.published)))
  return row ? row.title : undefined
}
