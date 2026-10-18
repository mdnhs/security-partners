import type { MetadataRoute } from "next"

import { absoluteUrl } from "./urls"

export type SitemapSource = {
  path: string
  lastModified: Date | null
  noindex: boolean
  /** The record's canonical override; listed only when it is this URL. */
  canonical: string | null
}

/** Indexable canonical URLs, each once, in source order (spec §10). */
export function buildSitemap(
  sources: readonly SitemapSource[],
  origin: string
): MetadataRoute.Sitemap {
  const seen = new Set<string>()
  const out: MetadataRoute.Sitemap = []
  for (const source of sources) {
    if (source.noindex) continue
    const url = absoluteUrl(origin, source.path)
    if (source.canonical && source.canonical !== url) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push(
      source.lastModified ? { url, lastModified: source.lastModified } : { url }
    )
  }
  return out
}

export const ROBOTS_DISALLOW = ["/admin", "/api"] as const

/** Uploaded media is served under /api/v1/media/file/ and stays crawlable. */
export function buildRobots(origin: string): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/api/v1/media/file/"],
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: absoluteUrl(origin, "/sitemap.xml"),
  }
}
