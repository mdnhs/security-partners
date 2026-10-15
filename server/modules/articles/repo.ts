import "server-only"

import { desc, eq, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { articleCategories, articles, users } from "@/server/db/schema"

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
