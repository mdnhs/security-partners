import "server-only"

import { siteOrigin } from "@/lib/seo/urls"
import { getEnv } from "@/server/env"

/** Origin for canonical URLs, sitemap, robots and JSON-LD. Request time only. */
export function publicOrigin(productionUrl: string | null): string {
  return siteOrigin(productionUrl, getEnv().BETTER_AUTH_URL)
}
