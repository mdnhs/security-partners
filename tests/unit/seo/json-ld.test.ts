import { describe, expect, it } from "vitest"

import {
  articleJsonLd,
  breadcrumbJsonLd,
  jsonLdText,
  organizationJsonLd,
  type OrganizationInput,
} from "@/lib/seo/json-ld"

const org: OrganizationInput = {
  type: "LocalBusiness",
  url: "https://x.ie",
  name: "Security Partners Ltd.",
  legalName: "Security Partners Limited",
  logo: "https://x.ie/images/logo.png",
  telephone: "057 8697670",
  email: "info@x.ie",
  address: {
    streetAddress: "Derryguile",
    addressLocality: "Mountmellick",
    addressRegion: "Co. Laois",
    postalCode: "R32 YX49",
    addressCountry: "IE",
  },
  areaServed: "Ireland",
  sameAs: [],
  services: [{ name: "Alarm Responses", url: "https://x.ie/services/a" }],
}

describe("JSON-LD builders", () => {
  it("organisation: LocalBusiness with a postal address and offered services", () => {
    const data = organizationJsonLd(org)
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": "https://x.ie/#organization",
      url: "https://x.ie/",
      telephone: "057 8697670",
      address: { "@type": "PostalAddress", postalCode: "R32 YX49" },
      makesOffer: [
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "Alarm Responses" },
        },
      ],
    })
    expect(data).not.toHaveProperty("sameAs")
    expect(
      organizationJsonLd({
        ...org,
        type: "ProfessionalService",
        sameAs: ["https://linkedin.com/company/x"],
      })
    ).toMatchObject({
      "@type": "ProfessionalService",
      sameAs: ["https://linkedin.com/company/x"],
    })
  })

  it("article: headline, author and publisher; dates only when known", () => {
    const data = articleJsonLd({
      url: "https://x.ie/blog/a",
      headline: "A",
      description: "D",
      image: "https://x.ie/i.png",
      datePublished: "2026-09-20T09:00:00.000Z",
      dateModified: null,
      authorName: "Jane",
      section: "News",
      publisher: {
        origin: "https://x.ie",
        name: "SP",
        logo: "https://x.ie/l.png",
      },
    })
    expect(data).toMatchObject({
      "@type": "Article",
      mainEntityOfPage: "https://x.ie/blog/a",
      datePublished: "2026-09-20T09:00:00.000Z",
      author: { "@type": "Person", name: "Jane" },
      publisher: { "@id": "https://x.ie/#organization" },
    })
    expect(data).not.toHaveProperty("dateModified")
  })

  it("breadcrumbs are numbered from 1", () => {
    expect(
      breadcrumbJsonLd([
        { name: "Home", url: "https://x.ie/" },
        { name: "Blog", url: "https://x.ie/blog" },
      ]).itemListElement
    ).toEqual([
      { "@type": "ListItem", position: 1, name: "Home", item: "https://x.ie/" },
      {
        "@type": "ListItem",
        position: 2,
        name: "Blog",
        item: "https://x.ie/blog",
      },
    ])
  })

  it("jsonLdText cannot close the <script> and round-trips", () => {
    const data = { name: "</script><script>alert(1)</script> &  " }
    const text = jsonLdText(data)
    expect(text).not.toContain("<")
    expect(text).not.toContain(">")
    expect(JSON.parse(text)).toEqual(data)
  })
})
