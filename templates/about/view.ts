import type { AboutProps } from "@/components/home/about"
import type { StatsProps } from "@/components/about/stats"
import type { ClientsProps } from "@/components/home/clients-team-blog"
import type { IconCardsProps } from "@/components/home/icon-cards"
import type { PageHeroProps } from "@/components/home/page-hero"
import type { EnquireBannerProps } from "@/components/home/services"
import type { SiteSources } from "@/templates/shared/sources"
import {
  aboutSectionView,
  type ChromeView,
  chromeView,
  clientsView,
  enquireBannerView,
  pageHeroView,
} from "@/templates/shared/views"

export type AboutView = {
  chrome: ChromeView
  hero: PageHeroProps
  about: AboutProps
  stats: StatsProps
  values: IconCardsProps
  clients: ClientsProps
  enquireBanner: EnquireBannerProps
}

export function aboutView(s: SiteSources): AboutView {
  const page = s.pages.about.data
  return {
    chrome: chromeView(s),
    hero: pageHeroView(s, page.hero),
    about: aboutSectionView(s),
    stats: { stats: page.stats },
    values: {
      eyebrow: page.values.eyebrow,
      title: page.values.title,
      description: page.values.description,
      items: page.values.items.map((item) => ({
        title: item.title,
        description: item.description,
        icon: item.icon.url,
      })),
    },
    clients: clientsView(s),
    enquireBanner: enquireBannerView(s),
  }
}
