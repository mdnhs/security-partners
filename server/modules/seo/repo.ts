import "server-only"

import { asc, desc, eq } from "drizzle-orm"

import type { SeoKind } from "@/lib/schemas/api/seo"
import type { Seo } from "@/lib/schemas/common"
import type { DbOrTx } from "@/server/db/client"
import { articles, pages, services } from "@/server/db/schema"

export type SeoRow = {
  kind: SeoKind
  /** Page key or row id. */
  id: string
  slug: string | null
  seo: Seo
  draft: unknown
  published: unknown
}

/** Every page, service and article (published or not) for the SEO overview. */
export async function listSeoRows(db: DbOrTx): Promise<SeoRow[]> {
  const [pageRows, serviceRows, articleRows] = await Promise.all([
    db
      .select({
        id: pages.key,
        seo: pages.seo,
        draft: pages.draft,
        published: pages.published,
      })
      .from(pages)
      .orderBy(asc(pages.key)),
    db
      .select({
        id: services.id,
        slug: services.slug,
        seo: services.seo,
        draft: services.draft,
        published: services.published,
      })
      .from(services)
      .orderBy(asc(services.sortOrder), asc(services.slug)),
    db
      .select({
        id: articles.id,
        slug: articles.slug,
        seo: articles.seo,
        draft: articles.draft,
        published: articles.published,
      })
      .from(articles)
      .orderBy(desc(articles.publishedAt), asc(articles.slug)),
  ])
  return [
    ...pageRows.map((row) => ({ kind: "page" as const, slug: null, ...row })),
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
      .select({
        id: pages.key,
        seo: pages.seo,
        draft: pages.draft,
        published: pages.published,
      })
      .from(pages)
      .where(eq(pages.key, id))
    return row ? { kind, slug: null, ...row } : null
  }
  if (kind === "service") {
    const [row] = await db
      .select({
        id: services.id,
        slug: services.slug,
        seo: services.seo,
        draft: services.draft,
        published: services.published,
      })
      .from(services)
      .where(eq(services.id, id))
    return row ? { kind, ...row } : null
  }
  const [row] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      seo: articles.seo,
      draft: articles.draft,
      published: articles.published,
    })
    .from(articles)
    .where(eq(articles.id, id))
  return row ? { kind, ...row } : null
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
