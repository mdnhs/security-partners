import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { ConsentBanner } from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import { CustomCodeSnippets } from "@/components/consent/custom-code"
import { RouteChangeEvent } from "@/components/consent/route-change-event"
import { TrackingScripts } from "@/components/consent/tracking-scripts"
import { JsonLd } from "@/components/seo/json-ld"
import { consentMaxAgeSeconds } from "@/lib/analytics/consent"
import { placementSnippets } from "@/lib/analytics/snippets"
import { publicOrigin } from "@/server/lib/site-origin"
import { loadPublicMarketing } from "@/server/modules/marketing/public"
import { loadSiteSources } from "@/server/modules/pages/sources"
import { consentBannerCopy } from "@/templates/shared/consent"
import { siteJsonLd } from "@/templates/shared/structured-data"

/**
 * Site-wide additions: the business JSON-LD; the consent banner and
 * consent-gated tags only when tracking is enabled (spec §10 — otherwise
 * nothing visible, so the public design stays pixel-identical); the
 * owner's custom code. Rendered inside <Suspense> in the root layout. The
 * two loads fail independently: without marketing settings the JSON-LD
 * still renders; without site sources nothing does, so a database outage
 * still reaches the page's error.tsx instead of breaking the layout.
 *
 * Custom code must stay server-rendered here: its loader is an inline
 * <script> emitted in the HTML, and a script element React inserts on the
 * client never runs. This layout does not re-render on client navigation,
 * so the loader matches routes in the browser; RouteChangeEvent tells it
 * when the path changes.
 */
export async function SiteExtras() {
  await connection()
  const [sources, loaded] = await Promise.allSettled([
    loadSiteSources(),
    loadPublicMarketing(),
  ])
  for (const result of [sources, loaded])
    if (result.status === "rejected") unstable_rethrow(result.reason)
  if (sources.status === "rejected") return null
  const s = sources.value
  const marketing = loaded.status === "fulfilled" ? loaded.value : null
  const tracking = marketing?.tracking
  const consent = marketing?.consent
  const copy =
    tracking?.enabled && consent ? consentBannerCopy(s, consent) : null
  const code = marketing?.customCode
  const hasSnippets =
    !!code &&
    (placementSnippets(code, "head").length > 0 ||
      placementSnippets(code, "body").length > 0)
  return (
    <>
      <JsonLd
        data={siteJsonLd(s, publicOrigin(s.settings.site.productionUrl))}
      />
      {marketing && copy ? (
        <ConsentProvider
          version={copy.version}
          maxAgeSeconds={consentMaxAgeSeconds(copy.reconsentMonths)}
        >
          <ConsentBanner copy={copy} />
          <TrackingScripts ids={marketing.ids} />
        </ConsentProvider>
      ) : null}
      {code && hasSnippets ? (
        <>
          <CustomCodeSnippets settings={code} placement="head" />
          <CustomCodeSnippets settings={code} placement="body" />
          <RouteChangeEvent />
        </>
      ) : null}
    </>
  )
}
