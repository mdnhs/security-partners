import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { buildRobots } from "@/lib/seo/sitemap"
import { getSiteOrigin } from "@/server/modules/seo/queries"
import { getPublishedSettings } from "@/server/modules/settings/queries"

/**
 * /robots.txt: the sitemap on the production origin; no admin or API.
 * The published seo.defaults robots mode "noindex" disallows everything.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  const [origin, defaults] = await Promise.all([
    getSiteOrigin(),
    getPublishedSettings("seo.defaults"),
  ])
  return buildRobots(origin, defaults?.robots ?? "index")
}
