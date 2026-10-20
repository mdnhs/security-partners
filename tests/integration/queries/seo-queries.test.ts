import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

// Pass-through spy: lets the tests prove malformed ids never reach the DB.
vi.mock("@/server/modules/seo/repo", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/seo/repo")>()
  return { ...actual, findPublishedName: vi.fn(actual.findPublishedName) }
})

import { cacheTag } from "next/cache"

import { getDb } from "@/server/db/client"
import { articles, pages, services, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { findPublishedName } from "@/server/modules/seo/repo"
import { getOgSubject } from "@/server/modules/seo/queries"
import { getPublishedSettings } from "@/server/modules/settings/queries"

import { resetDb } from "../db"

const fx = fixtureSiteSources()

beforeEach(async () => {
  vi.clearAllMocks()
  await resetDb()
  await seedContent(getDb())
})

async function serviceRow(slug: string) {
  const [row] = await getDb()
    .select()
    .from(services)
    .where(eq(services.slug, slug))
  return row
}

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

  it("tags each subject with its record and the settings it shows", async () => {
    await getOgSubject("service", "alarm-responses")
    expect(cacheTag).toHaveBeenCalledWith(
      "service:alarm-responses",
      "settings:site",
      "settings:seo.defaults",
      "settings:contact"
    )
    await getOgSubject("page", "about")
    expect(cacheTag).toHaveBeenCalledWith(
      "page:about",
      "settings:site",
      "settings:seo.defaults",
      "settings:contact"
    )
    const article = fx.articles[0]
    await getOgSubject("article", article.slug)
    expect(cacheTag).toHaveBeenCalledWith(
      `article:${article.slug}`,
      "settings:site",
      "settings:seo.defaults",
      "settings:contact"
    )
  })

  it("unknown or unpublished records have no card; drafts never show", async () => {
    expect(await getOgSubject("service", "nope")).toBeNull()
    const service = fx.services.find((s) => s.slug === "alarm-responses")!
    const row = await serviceRow("alarm-responses")
    await getDb()
      .update(services)
      .set({ draft: { ...row.draft, title: "Draft only title" } })
      .where(eq(services.id, row.id))
    expect((await getOgSubject("service", "alarm-responses"))?.title).toBe(
      service.content.title
    )
    await getDb()
      .update(services)
      .set({ published: null })
      .where(eq(services.id, row.id))
    expect(await getOgSubject("service", "alarm-responses")).toBeNull()
  })

  it("unpublished pages and articles have no card", async () => {
    await getDb()
      .update(pages)
      .set({ published: null })
      .where(eq(pages.key, "about"))
    expect(await getOgSubject("page", "about")).toBeNull()
    const article = fx.articles[0]
    await getDb()
      .update(articles)
      .set({ published: null })
      .where(eq(articles.slug, article.slug))
    expect(await getOgSubject("article", article.slug)).toBeNull()
  })

  it("malformed ids and unknown page keys are rejected before any lookup", async () => {
    for (const [kind, id] of [
      ["page", "nope"],
      ["page", "__proto__"],
      ["service", "Alarm-Responses"],
      ["service", "a--b"],
      ["article", "../etc"],
      ["article", "x".repeat(121)],
    ] as const)
      expect(await getOgSubject(kind, id)).toBeNull()
    expect(findPublishedName).not.toHaveBeenCalled()
    expect(cacheTag).not.toHaveBeenCalled()
  })

  it("a blank or missing name falls back to the default title", async () => {
    const row = await serviceRow("alarm-responses")
    await getDb()
      .update(services)
      .set({ published: { ...row.published!, title: "  " } })
      .where(eq(services.id, row.id))
    expect((await getOgSubject("service", "alarm-responses"))?.title).toBe(
      fx.settings["seo.defaults"].title
    )
    await getDb()
      .update(pages)
      .set({ published: { hero: {} } })
      .where(eq(pages.key, "about"))
    expect((await getOgSubject("page", "about"))?.title).toBe(
      fx.settings["seo.defaults"].title
    )
  })

  it("unpublished contact settings do not hide the card", async () => {
    await getDb()
      .update(settings)
      .set({ published: null })
      .where(eq(settings.key, "contact"))
    expect((await getOgSubject("service", "alarm-responses"))?.title).toBe(
      fx.services.find((s) => s.slug === "alarm-responses")!.content.title
    )
  })
})
