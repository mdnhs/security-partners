import "server-only"

import { cacheLife, cacheTag } from "next/cache"

import type { SitemapSource } from "@/lib/seo/sitemap"
import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { tag } from "@/server/lib/cache-tags"
import { getPublishedSettings } from "@/server/modules/settings/service"
import { isPageKey, PAGE_KEYS, PAGE_PATHS } from "@/templates/registry"

import { listSitemapRows, type SitemapRow } from "./repo"

// Public, published-only readers for /sitemap.xml and /robots.txt (never
// draft mode). Phase 8 Tasks 1/3 add `filled`, `publicOrigin` and a cached
// `getPublishedSettings`; they were not on this base, so the equivalents
// live here — swap at merge if their behaviour matches.

const latest = (a: Date | null, b: Date | null) =>
  a && b ? (a > b ? a : b) : (a ?? b)

/** A non-blank string, else null. */
const filled = (value: string | undefined | null) =>
  value && value.trim() !== "" ? value : null

const originOf = (value: string | null | undefined) => {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * Origin for absolute public URLs: the published settings.site.productionUrl,
 * else the app's own origin (BETTER_AUTH_URL). Expires with settings:site.
 */
export async function getSiteOrigin(): Promise<string> {
  "use cache"
  cacheLife("max")
  cacheTag(tag.settings("site"))
  const site = await getPublishedSettings("site")
  return (
    originOf(site?.productionUrl) ?? new URL(getEnv().BETTER_AUTH_URL).origin
  )
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
