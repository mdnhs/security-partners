import { eq } from "drizzle-orm"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

// Outside Next there is no cache scope or request: record tags, toggle draft mode.
const { cacheTag, draft } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  draft: { isEnabled: false },
}))
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag }))
vi.mock("next/headers", () => ({ draftMode: async () => draft }))

import { getDb } from "@/server/db/client"
import { articles, media, pages, services } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { contentFixtures } from "@/server/db/seed/fixtures"
import type { MediaLookup } from "@/server/db/seed/fixtures/media"
import { getArticle, listArticles } from "@/server/modules/articles/queries"
import {
  listCategories,
  listClients,
  listGroupCompanies,
  listTeam,
} from "@/server/modules/collections/queries"
import { getMedia, resolveMedia } from "@/server/modules/media/queries"
import { getPage } from "@/server/modules/pages/queries"
import { getService, listServices } from "@/server/modules/services/queries"
import { getSettings } from "@/server/modules/settings/queries"

import { resetDb } from "../db"

let fx: ReturnType<typeof contentFixtures>

beforeAll(async () => {
  await resetDb()
  await seedContent(getDb())
  const rows = await getDb()
    .select({ id: media.id, key: media.key })
    .from(media)
  const byKey = new Map(rows.map((r) => [r.key, r.id]))
  const lookup: MediaLookup = (key) => ({ mediaId: byKey.get(key)! })
  fx = contentFixtures(lookup)
})

beforeEach(() => {
  cacheTag.mockClear()
  draft.isEnabled = false
})

describe("public queries (master Task 3.4)", () => {
  it("getPage returns the published data and seo, tagged page:<key>", async () => {
    const home = await getPage("home")
    expect(home).toEqual({ key: "home", data: fx.pages.home.data, seo: {} })
    expect(cacheTag).toHaveBeenCalledWith("page:home")
    expect((await getPage("about"))?.seo).toEqual(fx.pages.about.seo)
  })

  it("getSettings returns the published value, tagged settings:<key>", async () => {
    expect(await getSettings("contact")).toEqual(fx.settings.contact)
    expect(cacheTag).toHaveBeenCalledWith("settings:contact")
  })

  it("lists services in display order and finds one by slug", async () => {
    const list = await listServices()
    expect(list.map((s) => s.slug)).toEqual(fx.services.map((s) => s.slug))
    expect(list[0].content).toEqual(fx.services[0].content)
    const one = await getService("event-security")
    expect(one?.content.title).toBe("Event Security")
    expect(cacheTag).toHaveBeenCalledWith("services", "service:event-security")
  })

  it("returns null for unknown slugs", async () => {
    expect(await getService("no-such-service")).toBeNull()
    expect(await getArticle("no-such-article")).toBeNull()
  })

  it("lists articles newest first with category and byline", async () => {
    const list = await listArticles()
    expect(list.map((a) => a.slug)).toEqual(fx.articles.map((a) => a.slug))
    expect(list[1]).toMatchObject({
      slug: "mobile-patrols-protect-your-business-after-hours",
      readTimeMinutes: 5,
      category: { slug: "mobile-patrols", name: "Mobile Patrols" },
      author: { name: "Michael McDonald", title: "Managing Director" },
    })
    expect(list[2].author).toBeNull()
    expect(list[0].publishedAt).toEqual(new Date("2026-09-20T09:00:00Z"))
  })

  it("filters articles by category slug and limits", async () => {
    const news = await listArticles({ category: "company-news" })
    expect(news.map((a) => a.slug)).toEqual([
      "18-years-of-watching-over-ireland",
      "inside-our-24-7-operations-team",
    ])
    expect(await listArticles({ limit: 2 })).toHaveLength(2)
  })

  it("hides unpublished records, shows drafts in draft mode", async () => {
    const db = getDb()
    await db
      .update(articles)
      .set({ published: null })
      .where(eq(articles.slug, "key-holding-explained"))
    const [page] = await db
      .select()
      .from(pages)
      .where(eq(pages.key, "services"))
    const draftData = structuredClone(page.draft) as {
      hero: { title: string }
    }
    draftData.hero.title = "Draft title"
    await db
      .update(pages)
      .set({ draft: draftData })
      .where(eq(pages.key, "services"))
    await db
      .update(services)
      .set({ published: null })
      .where(eq(services.slug, "static-security"))
    try {
      expect(await getArticle("key-holding-explained")).toBeNull()
      expect((await listArticles()).map((a) => a.slug)).not.toContain(
        "key-holding-explained"
      )
      expect((await getPage("services"))?.data.hero.title).toBe("Our Services")
      expect(await getService("static-security")).toBeNull()
      draft.isEnabled = true
      expect((await getPage("services"))?.data.hero.title).toBe("Draft title")
      expect((await getArticle("key-holding-explained"))?.slug).toBe(
        "key-holding-explained"
      )
      expect((await listServices()).map((s) => s.slug)).toContain(
        "static-security"
      )
    } finally {
      await resetDb()
      await seedContent(db)
      const rows = await db.select({ id: media.id, key: media.key }).from(media)
      const byKey = new Map(rows.map((r) => [r.key, r.id]))
      fx = contentFixtures((key) => ({ mediaId: byKey.get(key)! }))
    }
  })

  it("lists the small collections in display order", async () => {
    expect((await listCategories()).map((c) => c.name)).toEqual(
      fx.categories.map((c) => c.name)
    )
    expect(await listTeam()).toEqual(
      fx.team.map((t) => ({ ...t, id: expect.any(String) }))
    )
    expect(await listClients()).toEqual(
      fx.clients.map((c) => ({ ...c, id: expect.any(String) }))
    )
    expect(await listGroupCompanies()).toEqual(
      fx.groupCompanies.map((g) => ({ ...g, id: expect.any(String) }))
    )
  })

  it("serves static media at its public/ path and resolves references", async () => {
    const page = await getPage("home")
    const resolved = await resolveMedia(page!.data)
    expect(resolved.hero.backgroundImage).toMatchObject({
      url: "/images/hero.jpg",
      width: 1440,
      height: 748,
    })
    const view = await getMedia(fx.pages.home.data.hero.backgroundImage.mediaId)
    expect(view?.url).toBe("/images/hero.jpg")
    expect(await getMedia("00000000-0000-7000-8000-000000000999")).toBeNull()
    await expect(
      resolveMedia({
        image: { mediaId: "00000000-0000-7000-8000-000000000999" },
      })
    ).rejects.toThrow("not found")
  })
})
