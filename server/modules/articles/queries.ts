import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { draftMode } from "next/headers"

import type { Seo } from "@/lib/schemas/common"
import type { ArticleContent } from "@/lib/schemas/content/article"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"

import { type ArticleRow, findArticleBySlug, listArticleRows } from "./repo"

export type ArticleRecord = {
  id: string
  slug: string
  publishedAt: Date | null
  readTimeMinutes: number | null
  seo: Seo
  category: { slug: string; name: string }
  /** Byline from the author's profile (users.name, users.title). */
  author: { name: string; title: string | null } | null
  content: ArticleContent
}

function toRecord(row: ArticleRow, draft: boolean): ArticleRecord | null {
  const content = draft ? row.draft : row.published
  if (!content) return null
  return {
    id: row.id,
    slug: row.slug,
    publishedAt: row.publishedAt,
    readTimeMinutes: row.readTimeMinutes,
    seo: row.seo,
    category: row.category,
    author:
      row.authorName === null
        ? null
        : { name: row.authorName, title: row.authorTitle },
    content,
  }
}

/** Published articles, newest first; optionally one category (slug) and a limit. */
export async function listArticles(
  options: { category?: string; limit?: number } = {}
): Promise<ArticleRecord[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.articles, tag.categories)
  const { isEnabled: draft } = await draftMode()
  const rows = await listArticleRows(getDb(), {
    categorySlug: options.category,
  })
  const records = rows
    .map((row) => toRecord(row, draft))
    .filter((r): r is ArticleRecord => r !== null)
  return options.limit === undefined ? records : records.slice(0, options.limit)
}

/** One published article; null for an unknown or unpublished slug. */
export async function getArticle(slug: string): Promise<ArticleRecord | null> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.articles, tag.article(slug), tag.categories)
  const { isEnabled: draft } = await draftMode()
  const row = await findArticleBySlug(getDb(), slug)
  return row ? toRecord(row, draft) : null
}
