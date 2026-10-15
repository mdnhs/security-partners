import type { TeamProps } from "@/components/home/clients-team-blog"
import type { IconCardsProps } from "@/components/home/icon-cards"
import type { PageHeroProps } from "@/components/home/page-hero"
import type { EnquireBannerProps } from "@/components/home/services"
import type { SiteSources } from "@/templates/shared/sources"
import {
  type ChromeView,
  chromeView,
  enquireBannerView,
  pageHeroView,
  teamView as teamSectionView,
} from "@/templates/shared/views"

export type TeamView = {
  chrome: ChromeView
  hero: PageHeroProps
  team: TeamProps
  officers: IconCardsProps
  enquireBanner: EnquireBannerProps
}

export function teamView(s: SiteSources): TeamView {
  const page = s.pages.team.data
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    team: teamSectionView(s, page.leadership),
    officers: {
      eyebrow: page.officers.eyebrow,
      title: page.officers.title,
      description: page.officers.description,
      items: page.officers.qualities.map((q) => ({
        title: q.title,
        description: q.description,
        icon: q.icon.url,
      })),
      className: "bg-brand-surface",
    },
    enquireBanner: enquireBannerView(s),
  }
}
