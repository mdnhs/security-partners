import type { AboutProps } from "@/components/home/about"
import type {
  BlogProps,
  ClientsProps,
  TeamProps,
} from "@/components/home/clients-team-blog"
import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { HeroProps } from "@/components/home/hero"
import type {
  EnquireBannerProps,
  ServicesProps,
} from "@/components/home/services"
import { interpolateHref, interpolateParts } from "@/lib/interpolate"
import type { SiteSources } from "@/templates/shared/sources"
import {
  aboutSectionView,
  blogCard,
  type ChromeView,
  chromeView,
  clientsView,
  contactSectionView,
  enquireBannerView,
  listedArticles,
  locationMapView,
  placeholders,
  serviceCard,
  serviceCardLabels,
  teamView,
} from "@/templates/shared/views"

export type HomeView = {
  chrome: ChromeView
  hero: HeroProps
  about: AboutProps
  services: ServicesProps
  enquireBanner: EnquireBannerProps
  clients: ClientsProps
  team: TeamProps
  blog: BlogProps
  contact: ContactProps
  map: LocationMapProps
}

export function homeView(s: SiteSources): HomeView {
  const page = s.pages.home.data
  const values = placeholders(s)
  return {
    chrome: chromeView(s),
    hero: {
      eyebrow: page.hero.eyebrow,
      heading: page.hero.heading,
      tagline: page.hero.tagline,
      subheading: page.hero.subheading,
      backgroundImage: page.hero.backgroundImage.url,
      primaryCta: page.hero.primaryCta,
      secondaryCta: {
        label: interpolateParts(page.hero.secondaryCta.label, values),
        href: interpolateHref(page.hero.secondaryCta.href, values),
      },
      stats: page.hero.stats,
    },
    about: aboutSectionView(s),
    services: {
      eyebrow: page.services.eyebrow,
      title: page.services.heading,
      description: page.services.intro,
      services: s.services.map(serviceCard),
      labels: serviceCardLabels(s),
    },
    enquireBanner: enquireBannerView(s),
    clients: clientsView(s),
    team: teamView(s, page.team),
    blog: {
      eyebrow: page.blog.eyebrow,
      heading: page.blog.heading,
      intro: page.blog.intro,
      cta: page.blog.cta,
      posts: listedArticles(s).slice(0, page.blog.count).map(blogCard),
      readArticle: s.settings.microcopy.blog.readArticle,
    },
    contact: contactSectionView(s),
    map: locationMapView(s),
  }
}
