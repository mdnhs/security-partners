import type { PageHeroProps } from "@/components/home/page-hero"
import type { WithMedia } from "@/lib/media"
import { formatPostDate, isoDate, siteTimeZone } from "@/lib/format"
import type { RichTextDoc } from "@/lib/schemas/common"
import type { LegalTemplate } from "@/templates/legal/schema"
import type { SiteSources } from "@/templates/shared/sources"
import { pageHeroView } from "@/templates/shared/views"

export type LegalView = {
  hero: PageHeroProps
  body: WithMedia<RichTextDoc>
  /** Admin-managed legal pages only: when the page was last published. */
  updated?: { iso: string; label: string }
}

export function legalView(s: SiteSources, key: "privacy" | "terms"): LegalView {
  const page = s.pages[key].data
  return {
    hero: pageHeroView(s, page.hero),
    body: page.body,
  }
}

/** An admin-managed legal page (/<slug>): the same view plus its last-updated date. */
export function legalDocView(
  s: SiteSources,
  doc: WithMedia<LegalTemplate>,
  updatedAt: Date
): LegalView {
  const zone = siteTimeZone(s.settings.site.timezone)
  return {
    hero: pageHeroView(s, doc.hero),
    body: doc.body,
    updated: {
      iso: isoDate(updatedAt, zone),
      label: formatPostDate(updatedAt, zone),
    },
  }
}
