import "server-only"

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  isNotNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"

import type { ContentStatus } from "@/lib/schemas/api/content"
import type { Sort } from "@/lib/schemas/api/list"
import type { ArticleContent } from "@/lib/schemas/content/article"
import type { DbOrTx } from "@/server/db/client"
import { articleCategories, articles, users } from "@/server/db/schema"
import type { VersionedPatch } from "@/server/lib/versioning"

// ---------------------------------------------------------------- public site

const columns = {
  id: articles.id,
  slug: articles.slug,
  draft: articles.draft,
  published: articles.published,
  publishedAt: articles.publishedAt,
  readTimeMinutes: articles.readTimeMinutes,
  seo: articles.seo,
  category: { slug: articleCategories.slug, name: articleCategories.name },
  authorName: users.name,
  authorTitle: users.title,
}

function baseQuery(db: DbOrTx) {
  return db
    .select(columns)
    .from(articles)
    .innerJoin(articleCategories, eq(articles.categoryId, articleCategories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
}

/** Newest first (unpublished drafts first in draft mode). */
export function listArticleRows(
  db: DbOrTx,
  filter: { categorySlug?: string } = {}
) {
  const query = baseQuery(db)
  const filtered = filter.categorySlug
    ? query.where(eq(articleCategories.slug, filter.categorySlug))
    : query
  return filtered.orderBy(
    sql`${articles.publishedAt} desc nulls first`,
    desc(articles.createdAt)
  )
}

export async function findArticleBySlug(db: DbOrTx, slug: string) {
  const [row] = await baseQuery(db).where(eq(articles.slug, slug))
  return row ?? null
}

export type ArticleRow = NonNullable<
  Awaited<ReturnType<typeof findArticleBySlug>>
>

// ---------------------------------------------------------------- admin

const authors = alias(users, "article_author")
const editors = alias(users, "article_editor")

const adminColumns = {
  ...getTableColumns(articles),
  categoryName: articleCategories.name,
  categorySlug: articleCategories.slug,
  authorName: authors.name,
  authorTitle: authors.title,
  updatedByName: editors.name,
}

function adminQuery(db: DbOrTx) {
  return db
    .select(adminColumns)
    .from(articles)
    .innerJoin(articleCategories, eq(articleCategories.id, articles.categoryId))
    .leftJoin(authors, eq(authors.id, articles.authorId))
    .leftJoin(editors, eq(editors.id, articles.updatedBy))
}

/** One article with its category, byline and last editor (admin editor). */
export async function findArticleForEdit(db: DbOrTx, id: string) {
  const [row] = await adminQuery(db).where(eq(articles.id, id))
  return row ?? null
}

export type ArticleEditRow = NonNullable<
  Awaited<ReturnType<typeof findArticleForEdit>>
>

const title = sql<string>`${articles.draft}->>'title'`
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (m) => `\\${m}`)

export type ArticleSortField =
  "updatedAt" | "publishedAt" | "title" | "scheduledAt"

/** Admin list: filters, text search on title/slug, sort, pagination. */
export async function listArticlesForAdmin(
  db: DbOrTx,
  opts: {
    q?: string
    status?: ContentStatus
    categoryId?: string
    authorId?: string
    sort: Sort<ArticleSortField>
    page: number
    pageSize: number
  }
) {
  const conditions: SQL[] = []
  if (opts.q) {
    const pattern = `%${escapeLike(opts.q)}%`
    conditions.push(or(ilike(title, pattern), ilike(articles.slug, pattern))!)
  }
  if (opts.status) conditions.push(eq(articles.status, opts.status))
  if (opts.categoryId) conditions.push(eq(articles.categoryId, opts.categoryId))
  if (opts.authorId) conditions.push(eq(articles.authorId, opts.authorId))
  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [{ total }] = await db
    .select({ total: count() })
    .from(articles)
    .where(where)
  const column =
    opts.sort.field === "title"
      ? title
      : opts.sort.field === "publishedAt"
        ? articles.publishedAt
        : opts.sort.field === "scheduledAt"
          ? articles.scheduledAt
          : articles.updatedAt
  const order =
    opts.sort.dir === "asc"
      ? sql`${column} asc nulls last`
      : sql`${column} desc nulls last`
  const rows = await adminQuery(db)
    .where(where)
    .orderBy(order, asc(articles.slug))
    .limit(opts.pageSize)
    .offset((opts.page - 1) * opts.pageSize)
  return { rows, total }
}

export async function insertArticle(
  db: DbOrTx,
  values: {
    slug: string
    categoryId: string
    authorId: string | null
    draft: ArticleContent
    updatedBy: string
  }
): Promise<string> {
  const [row] = await db
    .insert(articles)
    .values({ ...values, status: "draft" })
    .returning({ id: articles.id })
  return row.id
}

/** Versioned columns plus the article's own (all optional except via the caller). */
export type ArticlePatch = Omit<VersionedPatch<ArticleContent>, "updatedBy"> & {
  updatedBy?: string | null
  scheduledAt?: Date | null
  readTimeMinutes?: number | null
  slug?: string
  categoryId?: string
  authorId?: string | null
}

/** Optimistic-lock update: only when `version` is current; null otherwise. */
export async function updateArticleIfVersion(
  db: DbOrTx,
  id: string,
  version: number,
  patch: ArticlePatch
): Promise<ArticleEditRow | null> {
  const [updated] = await db
    .update(articles)
    .set({ ...patch, version: version + 1 })
    .where(and(eq(articles.id, id), eq(articles.version, version)))
    .returning({ id: articles.id })
  return updated ? findArticleForEdit(db, id) : null
}

export async function deleteArticleIfVersion(
  db: DbOrTx,
  id: string,
  version: number
): Promise<boolean> {
  const rows = await db
    .delete(articles)
    .where(and(eq(articles.id, id), eq(articles.version, version)))
    .returning({ id: articles.id })
  return rows.length > 0
}

export async function categoryExists(db: DbOrTx, id: string) {
  const [row] = await db
    .select({ id: articleCategories.id })
    .from(articleCategories)
    .where(eq(articleCategories.id, id))
  return Boolean(row)
}

/** A user who might sign an article: their role and whether they already sign one. */
export async function findBylineCandidate(
  db: DbOrTx,
  id: string
): Promise<{ role: string | null; signsArticle: boolean } | null> {
  const [row] = await db
    .select({
      role: users.role,
      signsArticle: sql<boolean>`exists (select 1 from ${articles} where ${articles.authorId} = ${users.id})`,
    })
    .from(users)
    .where(eq(users.id, id))
  return row ?? null
}

export function listCategoryOptions(db: DbOrTx) {
  return db
    .select({
      id: articleCategories.id,
      slug: articleCategories.slug,
      name: articleCategories.name,
    })
    .from(articleCategories)
    .orderBy(asc(articleCategories.sortOrder), asc(articleCategories.name))
}

/** Every user with what a byline needs (filtered by role in the service). */
export function listUsersForByline(db: DbOrTx) {
  return db
    .select({
      id: users.id,
      name: users.name,
      title: users.title,
      role: users.role,
    })
    .from(users)
    .orderBy(asc(users.name))
}

/** Users who already sign an article (e.g. the seeded no-login bylines). */
export async function bylineAuthorIds(db: DbOrTx): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ id: articles.authorId })
    .from(articles)
    .where(isNotNull(articles.authorId))
  return new Set(rows.flatMap((r) => (r.id ? [r.id] : [])))
}

/** Scheduled articles due at `now`, row-locked; rows another worker holds are skipped. */
export function lockDueScheduledArticles(db: DbOrTx, now: Date, limit = 20) {
  return db
    .select({ id: articles.id })
    .from(articles)
    .where(
      and(eq(articles.status, "scheduled"), lte(articles.scheduledAt, now))
    )
    .orderBy(asc(articles.scheduledAt))
    .limit(limit)
    .for("update", { skipLocked: true })
}
