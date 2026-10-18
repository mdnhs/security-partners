import { describe, expect, it } from "vitest"

import { ogCard } from "@/lib/seo/og-card"

const base = {
  siteName: "Security Partners Ltd.",
  origin: "https://www.securitypartnersltd.com",
}

describe("OG card model", () => {
  it("labels services and articles; pages show the site name", () => {
    expect(
      ogCard({ ...base, kind: "service", title: "Alarm Responses" })
    ).toEqual({
      eyebrow: "Service",
      title: "Alarm Responses",
      titleSize: 80,
      siteName: "Security Partners Ltd.",
      host: "www.securitypartnersltd.com",
    })
    expect(ogCard({ ...base, kind: "article", title: "x" }).eyebrow).toBe(
      "Article"
    )
    expect(ogCard({ ...base, kind: "page", title: "About Us" }).eyebrow).toBe(
      "Security Partners Ltd."
    )
  })

  it("collapses whitespace, shrinks long titles and truncates at 110 characters", () => {
    expect(ogCard({ ...base, kind: "page", title: "A\n  B" }).title).toBe("A B")
    expect(
      ogCard({ ...base, kind: "page", title: "x".repeat(40) }).titleSize
    ).toBe(68)
    const long = ogCard({ ...base, kind: "page", title: "word ".repeat(40) })
    expect([...long.title].length).toBeLessThanOrEqual(110)
    expect(long.title.endsWith("…")).toBe(true)
    expect(long.titleSize).toBe(56)
  })

  it("clamps a long site name in the footer and the page eyebrow", () => {
    const card = ogCard({
      ...base,
      kind: "page",
      title: "About",
      siteName: "Security  Partners ".repeat(5),
    })
    expect([...card.siteName].length).toBeLessThanOrEqual(40)
    expect(card.siteName.endsWith("…")).toBe(true)
    expect(card.siteName).toMatch(/^Security Partners Security/)
    expect(card.eyebrow).toBe(card.siteName)
  })
})
