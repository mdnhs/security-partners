import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import {
  articleJsonLdFor,
  serviceJsonLd,
  siteJsonLd,
} from "@/templates/shared/structured-data"

const s = fixtureSiteSources()
const ORIGIN = "https://www.securitypartnersltd.com"

describe("structured data from SiteSources", () => {
  it("site: business facts from settings, every published service offered", () => {
    const data = siteJsonLd(s, ORIGIN)
    const org = s.settings["seo.defaults"].organization
    expect(data).toMatchObject({
      "@type": org.type,
      name: s.settings.site.name,
      legalName: s.settings.site.legalName,
      telephone: s.settings.contact.office,
      email: s.settings.contact.email,
      logo: new URL(s.settings.site.logo.url, ORIGIN).toString(),
      address: { streetAddress: org.streetAddress, addressCountry: "IE" },
      areaServed: org.areaServed,
    })
    expect(
      (data as { makesOffer: readonly unknown[] }).makesOffer
    ).toHaveLength(s.services.length)
  })

  it("service pages: Home › Services › title breadcrumbs", () => {
    const [crumbs] = serviceJsonLd(s, "alarm-responses", ORIGIN)!
    expect(crumbs).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { position: 1, item: `${ORIGIN}/` },
        { position: 2, item: `${ORIGIN}/services` },
        { position: 3, item: `${ORIGIN}/services/alarm-responses` },
      ],
    })
    expect(serviceJsonLd(s, "nope", ORIGIN)).toBeNull()
  })

  it("articles: Article + Home › Blog › title breadcrumbs", () => {
    const article = s.articles.find((a) => a.slug === "key-holding-explained")!
    const [data, crumbs] = articleJsonLdFor(s, article.slug, ORIGIN)!
    expect(data).toMatchObject({
      "@type": "Article",
      headline: article.content.title,
      articleSection: article.category.name,
      image: [new URL(article.content.cover.url, ORIGIN).toString()],
      datePublished: article.publishedAt!.toISOString(),
    })
    expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" })
    expect(articleJsonLdFor(s, "nope", ORIGIN)).toBeNull()
  })
})
