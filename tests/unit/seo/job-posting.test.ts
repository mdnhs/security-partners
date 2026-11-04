import { describe, expect, it } from "vitest"

import { jobPostingJsonLd } from "@/lib/seo/json-ld"

const base = {
  url: "https://www.example.ie/careers/static-officer",
  title: "Static Security Officer",
  description: "Full-time role in Portlaoise.",
  datePosted: new Date("2026-11-08T09:00:00Z"),
  closingDate: "2026-11-30",
  contractType: "full-time" as const,
  location: "Portlaoise, Co. Laois",
  reference: "SP-2611-STA",
  organization: {
    name: "Security Partners Ltd.",
    url: "https://www.example.ie",
    logo: "https://www.example.ie/images/logo.png",
  },
}

describe("jobPostingJsonLd", () => {
  it("is a schema.org JobPosting with the role, dates and employer", () => {
    expect(jobPostingJsonLd(base)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Static Security Officer",
      description: "Full-time role in Portlaoise.",
      datePosted: "2026-11-08",
      employmentType: "FULL_TIME",
      directApply: true,
      url: base.url,
      identifier: {
        "@type": "PropertyValue",
        name: "Security Partners Ltd.",
        value: "SP-2611-STA",
      },
      hiringOrganization: {
        "@type": "Organization",
        name: "Security Partners Ltd.",
        sameAs: "https://www.example.ie",
        logo: "https://www.example.ie/images/logo.png",
      },
      jobLocation: {
        "@type": "Place",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Portlaoise, Co. Laois",
          addressCountry: "IE",
        },
      },
    })
  })

  it("validThrough is the end of the closing day in Irish time (winter and summer)", () => {
    expect(jobPostingJsonLd(base).validThrough).toBe(
      "2026-11-30T23:59:59+00:00"
    )
    expect(
      jobPostingJsonLd({ ...base, closingDate: "2026-07-31" }).validThrough
    ).toBe("2026-07-31T23:59:59+01:00")
  })

  it.each([
    ["part-time", "PART_TIME"],
    ["contract", "CONTRACTOR"],
    ["temporary", "TEMPORARY"],
  ] as const)("employmentType %s → %s", (contractType, expected) => {
    expect(jobPostingJsonLd({ ...base, contractType }).employmentType).toBe(
      expected
    )
  })
})
