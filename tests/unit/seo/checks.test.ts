import { describe, expect, it } from "vitest"

import { SEO_CHECK_COUNT, seoIssues } from "@/lib/seo/checks"

const good = {
  title: "Alarm Responses | Security Partners Ltd.",
  description:
    "Our trained team responds to your alarm day or night, across Laois and beyond.",
  usesDefaultDescription: false,
  noindex: false,
}

describe("SEO checks", () => {
  it("a well-described indexable page passes all four", () => {
    expect(SEO_CHECK_COUNT).toBe(4)
    expect(seoIssues(good)).toEqual([])
  })

  it("reports each problem once, in check order", () => {
    expect(
      seoIssues({
        title: "Hi",
        description: "Short",
        usesDefaultDescription: true,
        noindex: true,
      })
    ).toEqual([
      {
        check: "title-length",
        message: "Title is 2 characters; aim for 15–60.",
      },
      {
        check: "own-description",
        message: "Uses the site-wide default description.",
      },
      {
        check: "description-length",
        message: "Description is 5 characters; aim for 50–160.",
      },
      { check: "indexable", message: "Hidden from search engines (noindex)." },
    ])
  })

  it("counts characters, not UTF-16 units", () => {
    // 31 characters, 62 UTF-16 units: within 15–60 characters.
    expect(
      seoIssues({ ...good, title: "🔒".repeat(31) }).map((i) => i.check)
    ).not.toContain("title-length")
    expect(
      seoIssues({ ...good, title: "é".repeat(61) }).map((i) => i.check)
    ).toContain("title-length")
  })
})
