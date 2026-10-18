import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { ConsentBanner } from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import { CustomCode } from "@/components/consent/custom-code"
import { TrackingScripts } from "@/components/consent/tracking-scripts"
import { JsonLd } from "@/components/seo/json-ld"
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
 * client never runs.
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
  return (
    <>
      <JsonLd
        data={siteJsonLd(s, publicOrigin(s.settings.site.productionUrl))}
      />
      {tracking?.enabled && consent ? (
        <ConsentProvider>
          <ConsentBanner copy={consentBannerCopy(s, consent)} />
          <TrackingScripts
            ids={{
              gtmId: tracking.gtmId,
              ga4Id: tracking.ga4Id,
              metaPixelId: tracking.metaPixelId,
            }}
          />
        </ConsentProvider>
      ) : null}
      {marketing ? (
        <>
          <CustomCode html={marketing.customCode.headHtml} target="head" />
          <CustomCode html={marketing.customCode.bodyEndHtml} target="body" />
        </>
      ) : null}
    </>
  )
}
