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
 * owner's custom code. Rendered inside <Suspense> in the root layout; on
 * any failure it renders nothing, so a database outage still reaches the
 * page's error.tsx instead of breaking the layout.
 */
export async function SiteExtras() {
  await connection()
  const data = await loadExtras()
  if (!data) return null
  const { s, marketing } = data
  const { tracking, consent, customCode } = marketing
  return (
    <>
      <JsonLd
        data={siteJsonLd(s, publicOrigin(s.settings.site.productionUrl))}
      />
      {tracking.enabled && consent ? (
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
      <CustomCode html={customCode.headHtml} target="head" />
      <CustomCode html={customCode.bodyEndHtml} target="body" />
    </>
  )
}

/** Site sources and published marketing settings; null when they cannot be loaded. */
async function loadExtras() {
  try {
    const [s, marketing] = await Promise.all([
      loadSiteSources(),
      loadPublicMarketing(),
    ])
    return { s, marketing }
  } catch (error) {
    unstable_rethrow(error)
    return null
  }
}
