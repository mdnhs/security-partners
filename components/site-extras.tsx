import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { JsonLd } from "@/components/seo/json-ld"
import { publicOrigin } from "@/server/lib/site-origin"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { siteJsonLd } from "@/templates/shared/structured-data"

/**
 * Site-wide additions with no visible output: the business JSON-LD (Task
 * 10 adds the consent banner/tracking, rendered only when tracking is
 * enabled, and the custom body code). Rendered inside <Suspense> in the
 * root layout; on any failure it renders nothing, so a database outage
 * still reaches the page's error.tsx instead of breaking the layout.
 */
export async function SiteExtras() {
  await connection()
  const business = await businessJsonLd()
  return business ? <JsonLd data={business} /> : null
}

/** The site-wide business JSON-LD, or null when it cannot be loaded. */
async function businessJsonLd() {
  try {
    const s = await loadSiteSources()
    return siteJsonLd(s, publicOrigin(s.settings.site.productionUrl))
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}
