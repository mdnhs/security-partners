import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { buildSitemap } from "@/lib/seo/sitemap"
import { getSiteOrigin, listSitemapEntries } from "@/server/modules/seo/queries"

/** /sitemap.xml from published pages, services and articles (spec §10). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection()
  const [origin, entries] = await Promise.all([
    getSiteOrigin(),
    listSitemapEntries(),
  ])
  return buildSitemap(entries, origin)
}
