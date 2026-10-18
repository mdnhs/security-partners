import { interpolate } from "@/lib/interpolate"
import { effectiveSeo } from "@/lib/seo/effective"
import {
  articleJsonLd,
  breadcrumbJsonLd,
  organizationJsonLd,
} from "@/lib/seo/json-ld"
import { absoluteUrl } from "@/lib/seo/urls"

import type { SiteSources } from "./sources"
import { placeholders } from "./views"

// SiteSources → JSON-LD (spec §10): the business on every page, Article on
// articles, BreadcrumbList on detail pages. URLs are absolute on `origin`.

export function siteJsonLd(s: SiteSources, origin: string) {
  const { site, contact } = s.settings
  const org = s.settings["seo.defaults"].organization
  return organizationJsonLd({
    type: org.type,
    url: origin,
    name: site.name,
    legalName: site.legalName,
    logo: absoluteUrl(origin, site.logo.url),
    telephone: contact.office,
    email: contact.email,
    address: {
      streetAddress: org.streetAddress,
      addressLocality: org.addressLocality,
      addressRegion: org.addressRegion,
      postalCode: org.postalCode,
      addressCountry: org.addressCountry,
    },
    areaServed: org.areaServed,
    sameAs: org.sameAs,
    services: s.services.map((service) => ({
      name: interpolate(service.content.title, placeholders(s)),
      url: absoluteUrl(origin, `/services/${service.slug}`),
    })),
  })
}

export function serviceJsonLd(
  s: SiteSources,
  slug: string,
  origin: string
): object[] | null {
  const service = s.services.find((x) => x.slug === slug)
  if (!service) return null
  const crumbs = s.settings.microcopy.breadcrumb
  return [
    breadcrumbJsonLd([
      { name: crumbs.home, url: absoluteUrl(origin, "/") },
      { name: crumbs.services, url: absoluteUrl(origin, "/services") },
      {
        name: interpolate(service.content.title, placeholders(s)),
        url: absoluteUrl(origin, `/services/${slug}`),
      },
    ]),
  ]
}

export function articleJsonLdFor(
  s: SiteSources,
  slug: string,
  origin: string
): object[] | null {
  const article = s.articles.find((a) => a.slug === slug)
  if (!article) return null
  const values = placeholders(s)
  const headline = interpolate(article.content.title, values)
  const { description } = effectiveSeo({
    seo: article.seo,
    defaults: s.settings["seo.defaults"],
    name: article.content.title,
    fallbackDescription: article.content.excerpt,
    values,
  })
  const url = absoluteUrl(origin, `/blog/${slug}`)
  const crumbs = s.settings.microcopy.breadcrumb
  return [
    articleJsonLd({
      url,
      headline,
      description,
      image: absoluteUrl(
        origin,
        article.seo.ogImage?.url ?? article.content.cover.url
      ),
      datePublished: article.publishedAt?.toISOString() ?? null,
      dateModified: null,
      authorName: article.author?.name ?? null,
      section: article.category.name,
      publisher: {
        origin,
        name: s.settings.site.name,
        logo: absoluteUrl(origin, s.settings.site.logo.url),
      },
    }),
    breadcrumbJsonLd([
      { name: crumbs.home, url: absoluteUrl(origin, "/") },
      { name: crumbs.blog, url: absoluteUrl(origin, "/blog") },
      { name: headline, url },
    ]),
  ]
}
