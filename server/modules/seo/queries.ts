import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import { contactPlaceholders, interpolate } from "@/lib/interpolate"
import { filled } from "@/lib/seo/effective"
import type { SitemapSource } from "@/lib/seo/sitemap"
import type { OgKind } from "@/lib/seo/urls"
import { getDb } from "@/server/db/client"
import { tag } from "@/server/lib/cache-tags"
import { publicOrigin } from "@/server/lib/site-origin"
import { getPublishedSettings } from "@/server/modules/settings/queries"
import { isPageKey, PAGE_KEYS, PAGE_PATHS } from "@/templates/registry"

import { findPublishedName, listSitemapRows, type SitemapRow } from "./repo"

// Public, published-only readers for /sitemap.xml, /robots.txt and the
// generated share cards (never draft mode).

const latest = (a: Date | null, b: Date | null) =>
  a && b ? (a > b ? a : b) : (a ?? b)

/**
 * Origin for absolute public URLs: the published settings.site.productionUrl,
 * else the app's own origin (BETTER_AUTH_URL). Expires with settings:site.
 */
export async function getSiteOrigin(): Promise<string> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings("site"))
  const site = await getPublishedSettings("site")
  return publicOrigin(site?.productionUrl ?? null)
}

/**
 * Sitemap sources from published rows only (draft mode is never read).
 * Expires with every publish/unpublish, slug change, delete and SEO save
 * (services, articles and page:* tags; seo/service.ts invalidates the same).
 */
export async function listSitemapEntries(): Promise<SitemapSource[]> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.services, tag.articles, ...PAGE_KEYS.map((key) => tag.page(key)))
  const rows = await listSitemapRows(getDb())
  const out: SitemapSource[] = []
  for (const row of rows) {
    const path = pathOf(row)
    if (path === null) continue
    out.push({
      path,
      lastModified: latest(row.publishedAt, row.lastPublish),
      noindex: row.seo.noindex === true,
      canonical: filled(row.seo.canonical),
    })
  }
  return out
}

/** Public path of a row; null for a page row the registry does not know. */
function pathOf(row: SitemapRow): string | null {
  if (row.kind === "service") return `/services/${row.key}`
  if (row.kind === "article") return `/blog/${row.key}`
  return isPageKey(row.key) ? PAGE_PATHS[row.key] : null
}

export type OgSubject = {
  kind: OgKind
  title: string
  siteName: string
  productionUrl: string | null
}

const recordTag = (kind: OgKind, id: string) =>
  kind === "page"
    ? tag.page(id)
    : kind === "service"
      ? tag.service(id)
      : tag.article(id)

/** What a share card shows. Published rows only (never draft mode). */
export async function getOgSubject(
  kind: OgKind,
  id: string
): Promise<OgSubject | null> {
  "use cache"
  cacheLife("max")
  cacheTag(
    recordTag(kind, id),
    tag.settings("site"),
    tag.settings("seo.defaults"),
    tag.settings("contact")
  )
  const name = await findPublishedName(getDb(), kind, id)
  if (name === undefined) return null
  const [site, defaults, contact] = await Promise.all([
    getPublishedSettings("site"),
    getPublishedSettings("seo.defaults"),
    getPublishedSettings("contact"),
  ])
  if (!site || !defaults || !contact) return null
  return {
    kind,
    title: interpolate(name ?? defaults.title, contactPlaceholders(contact)),
    siteName: site.name,
    productionUrl: site.productionUrl,
  }
}
