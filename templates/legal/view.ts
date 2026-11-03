import type { PageHeroProps } from "@/components/home/page-hero"
import type { WithMedia } from "@/lib/media"
import type { RichTextDoc } from "@/lib/schemas/common"
import type { SiteSources } from "@/templates/shared/sources"
import { pageHeroView } from "@/templates/shared/views"

export type LegalView = {
  hero: PageHeroProps
  body: WithMedia<RichTextDoc>
}

export function legalView(s: SiteSources, key: "privacy" | "terms"): LegalView {
  const page = s.pages[key].data
  return {
    hero: pageHeroView(s, page.hero),
    body: page.body,
  }
}
