import type { MetadataRoute } from "next"
import { connection } from "next/server"

import { buildRobots } from "@/lib/seo/sitemap"
import { getSiteOrigin } from "@/server/modules/seo/queries"

/** /robots.txt: the sitemap on the production origin; no admin or API. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection()
  return buildRobots(await getSiteOrigin())
}
