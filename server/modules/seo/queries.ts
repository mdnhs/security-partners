import "server-only"

import { cacheLife, cacheTag } from "next/cache"
import { z } from "zod"

import { contactPlaceholders, interpolate } from "@/lib/interpolate"
import { builderPath } from "@/lib/schemas/api/builder-pages"
import { SLUG_PATTERN } from "@/lib/schemas/common"
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
  cacheTag(
    tag.services,
    tag.articles,
    tag.builderPages,
    ...PAGE_KEYS.map((key) => tag.page(key))
  )
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
  if (row.kind === "builder") return builderPath(row.key)
  return isPageKey(row.key) ? PAGE_PATHS[row.key] : null
}

export type OgSubject = {
  kind: OgKind
  title: string
  siteName: string
  productionUrl: string | null
}

/** Longest slug the schema accepts (lib/schemas/common.ts `slug`). */
const MAX_SLUG = 120

/**
 * Whether `id` can name a share-card subject: a registered page key, a
 * builder page's id (uuid), or a well-formed service/article slug. Checked
 * before any lookup or cache entry, so random ids cost nothing.
 */
export function isOgSubjectId(kind: OgKind, id: string): boolean {
  if (kind === "page") return isPageKey(id)
  if (kind === "builder") return z.uuid().safeParse(id).success
  return id.length <= MAX_SLUG && SLUG_PATTERN.test(id)
}

/** Cache tags of a share card: the record and the settings it shows. */
export function ogSubjectTags(kind: OgKind, id: string): string[] {
  // Builder cards are keyed by id; builder tags by slug: any builder
  // publish, rename or delete expires them (rare writes).
  const record =
    kind === "page"
      ? tag.page(id)
      : kind === "service"
        ? tag.service(id)
        : kind === "builder"
          ? tag.builderPages
          : tag.article(id)
  return [
    record,
    tag.settings("site"),
    tag.settings("seo.defaults"),
    tag.settings("contact"),
  ]
}

/**
 * What a share card shows. Published rows only (never draft mode). Every
 * published record has a card (page-meta always points og:image at it): a
 * blank or missing name falls back to the default title, then the site
 * name. null for an invalid id, an unknown or unpublished record, or an
 * unpublished `site` setting.
 */
export async function getOgSubject(
  kind: OgKind,
  id: string
): Promise<OgSubject | null> {
  if (!isOgSubjectId(kind, id)) return null
  return loadOgSubject(kind, id)
}

async function loadOgSubject(
  kind: OgKind,
  id: string
): Promise<OgSubject | null> {
  "use cache"
  cacheLife("max")
  cacheTag(...ogSubjectTags(kind, id))
  const name = await findPublishedName(getDb(), kind, id)
  if (name === undefined) return null
  const [site, defaults, contact] = await Promise.all([
    getPublishedSettings("site"),
    getPublishedSettings("seo.defaults"),
    getPublishedSettings("contact"),
  ])
  if (!site) return null
  const title = filled(name) ?? filled(defaults?.title) ?? site.name
  return {
    kind,
    // Unpublished contact settings: show the placeholders as stored.
    title: contact ? interpolate(title, contactPlaceholders(contact)) : title,
    siteName: site.name,
    productionUrl: site.productionUrl,
  }
}
