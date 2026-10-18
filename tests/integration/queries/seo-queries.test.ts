import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getDb } from "@/server/db/client"
import { services, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { getOgSubject } from "@/server/modules/seo/queries"
import { getPublishedSettings } from "@/server/modules/settings/queries"

import { resetDb } from "../db"

const fx = fixtureSiteSources()

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("published-only SEO readers", () => {
  it("getPublishedSettings ignores the draft", async () => {
    await getDb()
      .update(settings)
      .set({
        draft: { enabled: true, gtmId: null, ga4Id: null, metaPixelId: null },
      })
      .where(eq(settings.key, "tracking"))
    expect(await getPublishedSettings("tracking")).toMatchObject({
      enabled: false,
    })
  })

  it("OG subjects: home uses the site title; pages, services, articles their names", async () => {
    expect(await getOgSubject("page", "home")).toEqual({
      kind: "page",
      title: fx.settings["seo.defaults"].title,
      siteName: fx.settings.site.name,
      productionUrl: null,
    })
    expect((await getOgSubject("page", "about"))?.title).toBe(
      fx.pages.about.data.hero.title
    )
    const service = fx.services.find((s) => s.slug === "alarm-responses")!
    expect((await getOgSubject("service", "alarm-responses"))?.title).toBe(
      service.content.title
    )
    const article = fx.articles[0]
    expect((await getOgSubject("article", article.slug))?.title).toBe(
      article.content.title
    )
  })

  it("unknown or unpublished records have no card; drafts never show", async () => {
    expect(await getOgSubject("page", "nope")).toBeNull()
    expect(await getOgSubject("service", "nope")).toBeNull()
    const [row] = await getDb()
      .select()
      .from(services)
      .where(eq(services.slug, "alarm-responses"))
    await getDb()
      .update(services)
      .set({ draft: { ...row.draft, title: "Draft only title" } })
      .where(eq(services.id, row.id))
    expect((await getOgSubject("service", "alarm-responses"))?.title).not.toBe(
      "Draft only title"
    )
    await getDb()
      .update(services)
      .set({ published: null })
      .where(eq(services.id, row.id))
    expect(await getOgSubject("service", "alarm-responses")).toBeNull()
  })
})
