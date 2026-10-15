import type { Author, BlogCardPost } from "@/components/blog/blog-card"
import type { AboutProps } from "@/components/home/about"
import type {
  ClientsProps,
  TeamProps,
} from "@/components/home/clients-team-blog"
import type { ContactProps, LocationMapProps } from "@/components/home/contact"
import type { PageHeroProps } from "@/components/home/page-hero"
import type {
  EnquireBannerProps,
  ServiceCardData,
  ServiceCardLabels,
} from "@/components/home/services"
import type { SiteFooterProps } from "@/components/home/site-footer"
import type { SiteHeaderProps } from "@/components/home/site-header"
import { formatPostDate, isoDate } from "@/lib/format"
import {
  contactPlaceholders,
  interpolate,
  interpolateHref,
  interpolateParts,
} from "@/lib/interpolate"
import type { PageHero } from "@/lib/schemas/common"
import type { WithMedia } from "@/lib/media"

import type { SiteArticle, SiteService, SiteSources } from "./sources"

// Builders shared by several templates: header, footer and the shared
// sections (D10 + ruling), plus card shapes. Pure functions of SiteSources.

/** Settings.contact fields + derived tel: hrefs for {placeholders}. */
export const placeholders = (s: SiteSources) =>
  contactPlaceholders(s.settings.contact)

export type ChromeView = {
  header: SiteHeaderProps
  footer: SiteFooterProps
  /** <html lang> (settings.site.locale), applied by SiteLocale. */
  locale: string
}

export function chromeView(s: SiteSources): ChromeView {
  const { site, contact, navigation, footer, microcopy } = s.settings
  const values = placeholders(s)
  return {
    locale: site.locale,
    header: {
      topBar: {
        phone24hLabel: microcopy.header.phone24hLabel,
        phone24h: contact.phone24h,
        phone24hHref: String(values.phone24hHref),
        email: contact.email,
        hoursLabel: microcopy.header.hoursLabel,
        hours: contact.hours,
      },
      logo: { src: site.logo.url, alt: site.logoAlt },
      links: navigation.headerLinks,
      cta: navigation.headerCta,
      aria: {
        mainNav: microcopy.aria.mainNav,
        openMenu: microcopy.aria.openMenu,
        closeMenu: microcopy.aria.closeMenu,
        mobileNav: microcopy.aria.mobileNav,
      },
    },
    footer: {
      logo: { src: site.logo.url, alt: site.logoAlt },
      tagline: footer.tagline,
      quickLinks: {
        heading: footer.quickLinksHeading,
        ariaLabel: microcopy.aria.footerNav,
        links: navigation.headerLinks,
      },
      contact: {
        heading: footer.contactHeading,
        addressLine1: contact.addressLine1,
        addressLine2: contact.addressLine2,
        telLabel: footer.contact.telLabel,
        office: contact.office,
        officeHref: String(values.officeHref),
        phone24hLabel: footer.contact.phone24hLabel,
        phone24h: contact.phone24h,
        phone24hHref: String(values.phone24hHref),
        email: contact.email,
      },
      group: {
        heading: footer.groupHeading,
        telLabel: footer.groupTelLabel,
        companies: s.groupCompanies.map((g) => ({
          name: g.name,
          phone: g.phone,
          site: g.site,
          logo: g.logo.url,
        })),
      },
      copyright: site.copyright,
      legal: footer.legal,
    },
  }
}

export function pageHeroView(
  s: SiteSources,
  hero: WithMedia<PageHero>,
  extra: Pick<PageHeroProps, "trail" | "wideDescription"> = {}
): PageHeroProps {
  return {
    image: hero.image.url,
    crumb: hero.crumb,
    title: interpolate(hero.title, placeholders(s)),
    description: interpolate(hero.description, placeholders(s)),
    homeLabel: s.settings.microcopy.breadcrumb.home,
    ariaLabel: s.settings.microcopy.aria.breadcrumb,
    ...extra,
  }
}

export function enquireBannerView(s: SiteSources): EnquireBannerProps {
  const banner = s.settings["sections.enquireBanner"]
  const values = placeholders(s)
  return {
    image: banner.image.url,
    eyebrow: banner.eyebrow,
    heading: banner.heading,
    copy: banner.copy,
    cta: banner.cta,
    secondaryCta: {
      label: interpolateParts(banner.secondaryCta.label, values),
      href: interpolateHref(banner.secondaryCta.href, values),
    },
  }
}

export function clientsView(s: SiteSources): ClientsProps {
  const section = s.settings["sections.clients"]
  return {
    eyebrow: section.eyebrow,
    heading: section.heading,
    clients: s.clients.map((c) => ({ name: c.name, logo: c.logo.url })),
  }
}

export function aboutSectionView(s: SiteSources): AboutProps {
  const about = s.settings["sections.about"]
  return {
    eyebrow: about.eyebrow,
    heading: about.heading,
    body: about.body,
    image: { src: about.image.url, alt: about.imageAlt },
    badge: about.badge,
    highlights: about.highlights,
  }
}

export function contactSectionView(s: SiteSources): ContactProps {
  const section = s.settings["sections.contact"]
  const values = placeholders(s)
  const { mailtoSubject, ...labels } = section.form
  return {
    eyebrow: section.eyebrow,
    heading: section.heading,
    intro: section.intro,
    infoItems: section.infoItems.map((item) => ({
      title: item.title,
      icon: item.icon.url,
      lines: item.lines.map((line) => ({
        text: interpolate(line.text, values),
        ...(line.href ? { href: interpolateHref(line.href, values) } : {}),
      })),
    })),
    form: {
      labels,
      mailto: { email: s.settings.contact.email, subject: mailtoSubject },
    },
  }
}

export function locationMapView(s: SiteSources): LocationMapProps {
  const map = s.settings["sections.contact"].map
  return {
    href: interpolateHref(map.link, placeholders(s)),
    ariaLabel: map.ariaLabel,
    label: map.label,
    logo: s.settings.site.logo.url,
    tiles: map.tiles,
  }
}

export function teamView(
  s: SiteSources,
  heading: { eyebrow: string; heading: string; intro: string }
): TeamProps {
  return {
    eyebrow: heading.eyebrow,
    title: heading.heading,
    description: heading.intro,
    photoPlaceholder: s.pages.team.data.leadership.photoPlaceholder.url,
    members: s.team.map((m) => ({
      name: m.name,
      role: m.role,
      bio: m.bio,
      email: m.email,
      photo: m.photo?.url ?? null,
    })),
  }
}

export function serviceCard(service: SiteService): ServiceCardData {
  return {
    slug: service.slug,
    title: service.content.title,
    description: service.content.description,
    icon: service.content.icon.url,
  }
}

export function serviceCardLabels(s: SiteSources): ServiceCardLabels {
  return {
    readMore: s.settings.microcopy.serviceCard.readMore,
    ariaReadMore: s.settings.microcopy.aria.serviceCardReadMore,
  }
}

/** Published date as shown on cards ("2026-09-20" / "20 Sep 2026"). */
export function articleDates(article: SiteArticle) {
  const at = article.publishedAt ?? new Date(0)
  return { date: isoDate(at), displayDate: formatPostDate(at) }
}

export function blogCard(article: SiteArticle): BlogCardPost {
  return {
    slug: article.slug,
    title: article.content.title,
    excerpt: article.content.excerpt,
    category: article.category.name,
    cover: article.content.cover.url,
    ...articleDates(article),
  }
}

export function authorOf(article: SiteArticle): Author | null {
  return article.author
    ? { name: article.author.name, role: article.author.title ?? "" }
    : null
}

/** pages.blog.featuredArticle, if it is published. */
export function featuredArticle(s: SiteSources): SiteArticle | null {
  const slug = s.pages.blog.data.featuredArticle
  return s.articles.find((a) => a.slug === slug) ?? null
}

/** Every published article except the featured one (the static site's `posts`). */
export function listedArticles(s: SiteSources): SiteArticle[] {
  const featured = s.pages.blog.data.featuredArticle
  return s.articles.filter((a) => a.slug !== featured)
}
