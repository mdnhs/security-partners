import type {
  Article,
  BreadcrumbList,
  JobPosting,
  LocalBusiness,
  WithContext,
} from "schema-dts"

// schema.org JSON-LD (spec §10), typed with schema-dts. Pure builders;
// templates/shared/structured-data.ts maps SiteSources onto them.

export type OrganizationType = "LocalBusiness" | "ProfessionalService"

export type OrganizationInput = {
  type: OrganizationType
  /** Site origin, e.g. https://www.securitypartnersltd.com */
  url: string
  name: string
  legalName: string
  logo: string
  telephone: string
  email: string
  address: {
    streetAddress: string
    addressLocality: string
    addressRegion: string
    postalCode: string
    addressCountry: string
  }
  areaServed: string
  sameAs: string[]
  services: { name: string; url: string }[]
}

export const organizationId = (origin: string) => `${origin}/#organization`

export function organizationJsonLd(
  i: OrganizationInput
): WithContext<LocalBusiness> {
  const common = {
    "@id": organizationId(i.url),
    name: i.name,
    legalName: i.legalName,
    url: `${i.url}/`,
    logo: i.logo,
    image: i.logo,
    telephone: i.telephone,
    email: i.email,
    address: { "@type": "PostalAddress" as const, ...i.address },
    areaServed: i.areaServed,
    ...(i.sameAs.length > 0 ? { sameAs: i.sameAs } : {}),
    makesOffer: i.services.map((service) => ({
      "@type": "Offer" as const,
      itemOffered: {
        "@type": "Service" as const,
        name: service.name,
        url: service.url,
      },
    })),
  }
  return i.type === "ProfessionalService"
    ? {
        "@context": "https://schema.org",
        "@type": "ProfessionalService",
        ...common,
      }
    : { "@context": "https://schema.org", "@type": "LocalBusiness", ...common }
}

export type ArticleInput = {
  url: string
  headline: string
  description: string
  image: string
  datePublished: string | null
  dateModified: string | null
  authorName: string | null
  section: string
  /** Site origin: the publisher is the business node `<origin>/#organization`. */
  publisher: { origin: string }
}

export function articleJsonLd(i: ArticleInput): WithContext<Article> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: i.url,
    headline: i.headline,
    description: i.description,
    image: [i.image],
    ...(i.datePublished ? { datePublished: i.datePublished } : {}),
    ...(i.dateModified ? { dateModified: i.dateModified } : {}),
    ...(i.authorName
      ? { author: { "@type": "Person", name: i.authorName } }
      : {}),
    articleSection: i.section,
    // The site-wide business node (siteJsonLd) on the same page; a
    // reference only, so the node is not described twice with two types.
    publisher: { "@id": organizationId(i.publisher.origin) },
  }
}

export function breadcrumbJsonLd(
  items: readonly { name: string; url: string }[]
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export type JobPostingInput = {
  url: string
  title: string
  description: string
  datePosted: Date
  /** YYYY-MM-DD: the role closes at the end of this day in Irish time. */
  closingDate: string
  contractType: "full-time" | "part-time" | "contract" | "temporary"
  location: string
  reference: string
  organization: { name: string; url: string; logo: string }
}

const EMPLOYMENT_TYPE = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  contract: "CONTRACTOR",
  temporary: "TEMPORARY",
} as const

const DUBLIN = "Europe/Dublin"

/** "+00:00" in winter, "+01:00" in summer: Irish time's offset on `date` (YYYY-MM-DD). */
function dublinOffset(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  const name = new Intl.DateTimeFormat("en-GB", {
    timeZone: DUBLIN,
    timeZoneName: "longOffset",
  })
    .formatToParts(new Date(Date.UTC(y, m - 1, d, 12)))
    .find((part) => part.type === "timeZoneName")?.value
  const offset = name?.replace("GMT", "") ?? ""
  return offset === "" ? "+00:00" : offset
}

/** Calendar date of an instant in Irish time, "2026-11-08". */
function dublinDate(at: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: DUBLIN,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value])
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** schema.org JobPosting of an open role (Google for Jobs). */
export function jobPostingJsonLd(i: JobPostingInput): WithContext<JobPosting> {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: i.title,
    description: i.description,
    datePosted: dublinDate(i.datePosted),
    validThrough: `${i.closingDate}T23:59:59${dublinOffset(i.closingDate)}`,
    employmentType: EMPLOYMENT_TYPE[i.contractType],
    directApply: true,
    url: i.url,
    identifier: {
      "@type": "PropertyValue",
      name: i.organization.name,
      value: i.reference,
    },
    hiringOrganization: {
      "@type": "Organization",
      name: i.organization.name,
      sameAs: i.organization.url,
      logo: i.organization.logo,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: i.location,
        addressCountry: "IE",
      },
    },
  }
}

/** JSON for a <script type="application/ld+json">: no "<", ">" or "&" can end the script. */
export function jsonLdText(data: object): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")
}
