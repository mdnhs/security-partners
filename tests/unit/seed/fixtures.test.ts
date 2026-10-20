import { existsSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { seo } from "@/lib/schemas/common"
import { articleContent } from "@/lib/schemas/content/article"
import { categorySchema } from "@/lib/schemas/content/category"
import { clientSchema } from "@/lib/schemas/content/client"
import { groupCompanySchema } from "@/lib/schemas/content/group-company"
import { serviceSchema } from "@/lib/schemas/content/service"
import { teamMemberSchema } from "@/lib/schemas/content/team-member"
import { contentFixtures } from "@/server/db/seed/fixtures"
import {
  fixtureMediaId,
  fixtureMediaKey,
  fixtureMediaLookup,
  MEDIA,
} from "@/server/db/seed/fixtures/media"

const fx = contentFixtures(fixtureMediaLookup)

/** Every { mediaId } in a value. */
function mediaIds(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const v of value) mediaIds(v, out)
  else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    if (typeof record.mediaId === "string") out.add(record.mediaId)
    for (const v of Object.values(record)) mediaIds(v, out)
  }
  return out
}

describe("seed fixtures (master Task 3.3)", () => {
  it("parse against the content schemas and round-trip unchanged", () => {
    for (const s of fx.services) {
      const input = { slug: s.slug, ...s.content }
      expect(serviceSchema.parse(input)).toEqual(input)
      expect(seo.parse(s.seo)).toEqual(s.seo)
    }
    for (const a of fx.articles)
      expect(articleContent.parse(a.content)).toEqual(a.content)
    for (const c of fx.categories) expect(categorySchema.parse(c)).toEqual(c)
    for (const t of fx.team) expect(teamMemberSchema.parse(t)).toEqual(t)
    for (const c of fx.clients) expect(clientSchema.parse(c)).toEqual(c)
    for (const g of fx.groupCompanies)
      expect(groupCompanySchema.parse(g)).toEqual(g)
  })

  it("has the static site's records in display order", () => {
    expect(fx.services.map((s) => s.slug)).toEqual([
      "alarm-responses",
      "mobile-patrols-key-holding",
      "open-up-lock-ups",
      "static-security",
      "commercial-retail-security",
      "event-security",
    ])
    expect(fx.articles.map((a) => a.slug)).toEqual([
      "18-years-of-watching-over-ireland",
      "mobile-patrols-protect-your-business-after-hours",
      "planning-security-for-your-next-event",
      "inside-our-24-7-operations-team",
      "key-holding-explained",
      "loss-prevention-trained-retail-officers",
      "open-up-lock-up-keeps-staff-safe",
    ])
    const dates = fx.articles.map((a) => a.publishedAt.getTime())
    expect([...dates].sort((x, y) => y - x)).toEqual(dates)
    expect(
      fx.categories.filter((c) => c.showInFilter).map((c) => c.name)
    ).toEqual([
      "Company News",
      "Mobile Patrols",
      "Event Security",
      "Retail Security",
      "Alarm Response",
    ])
    expect(fx.team).toHaveLength(4)
    expect(fx.clients).toHaveLength(8)
    expect(fx.groupCompanies).toHaveLength(2)
  })

  it("references only known categories, authors and the featured article", () => {
    const categories = new Set(fx.categories.map((c) => c.slug))
    const authors = new Set(fx.authors.map((a) => a.email))
    for (const a of fx.articles) {
      expect(categories).toContain(a.categorySlug)
      if (a.authorEmail) expect(authors).toContain(a.authorEmail)
    }
    expect(fx.articles.map((a) => a.slug)).toContain(
      fx.pages.blog.data.featuredArticle
    )
  })

  it("uses every library image and only library images", () => {
    const used = mediaIds(fx)
    expect([...used].map(fixtureMediaKey).sort()).toEqual(
      MEDIA.map((m) => m.key).sort()
    )
  })

  it("library keys are files in public/", () => {
    for (const { key } of MEDIA)
      expect(existsSync(resolve("public", `.${key}`)), key).toBe(true)
    expect(fixtureMediaKey(fixtureMediaId("/images/hero.jpg"))).toBe(
      "/images/hero.jpg"
    )
  })
})
