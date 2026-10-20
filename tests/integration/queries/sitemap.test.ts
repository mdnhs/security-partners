import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { getDb } from "@/server/db/client"
import {
  articles,
  pages,
  revisions,
  services,
  settings,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { getSiteOrigin, listSitemapEntries } from "@/server/modules/seo/queries"

import { resetDb } from "../db"

const fx = fixtureSiteSources()

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

describe("sitemap entries (published only)", () => {
  it("every page, service and article, in that order, with lastmod", async () => {
    const entries = await listSitemapEntries()
    const paths = entries.map((e) => e.path)
    expect(paths.slice(0, 8).sort()).toEqual(
      [
        "/",
        "/about",
        "/blog",
        "/contact",
        "/privacy",
        "/services",
        "/team",
        "/terms",
      ].sort()
    )
    expect(paths).toContain("/services/alarm-responses")
    expect(paths).toHaveLength(8 + fx.services.length + fx.articles.length)
    for (const entry of entries)
      expect(entry.lastModified, entry.path).toBeInstanceOf(Date)
  })

  it("drafts are left out; noindex and canonical are reported", async () => {
    await getDb()
      .update(services)
      .set({ published: null })
      .where(eq(services.slug, "event-security"))
    const article = fx.articles[0]
    await getDb()
      .update(articles)
      .set({ seo: { noindex: true, canonical: "https://x.ie/a" } })
      .where(eq(articles.slug, article.slug))
    const entries = await listSitemapEntries()
    expect(entries.map((e) => e.path)).not.toContain("/services/event-security")
    expect(
      entries.find((e) => e.path === `/blog/${article.slug}`)
    ).toMatchObject({
      noindex: true,
      canonical: "https://x.ie/a",
    })
  })

  it("unpublished pages are left out; a blank canonical counts as none", async () => {
    await getDb()
      .update(pages)
      .set({ published: null, seo: {} })
      .where(eq(pages.key, "terms"))
    await getDb()
      .update(pages)
      .set({ seo: { canonical: "  " } })
      .where(eq(pages.key, "about"))
    const entries = await listSitemapEntries()
    expect(entries.map((e) => e.path)).not.toContain("/terms")
    expect(entries.find((e) => e.path === "/about")?.canonical).toBeNull()
  })

  it("a published page row the registry does not know is left out", async () => {
    await getDb().insert(pages).values({
      key: "legacy-landing",
      template: "legal",
      draft: {},
      published: {},
      status: "published",
      publishedAt: new Date(),
    })
    const entries = await listSitemapEntries()
    expect(entries).toHaveLength(8 + fx.services.length + fx.articles.length)
    for (const entry of entries) expect(entry.path, entry.path).toMatch(/^\//)
  })

  it("lastmod is the newest of the publish date and the last revision", async () => {
    const [service] = await getDb()
      .select({ id: services.id, publishedAt: services.publishedAt })
      .from(services)
      .where(eq(services.slug, "alarm-responses"))
    const later = new Date((service.publishedAt?.getTime() ?? 0) + 86_400_000)
    await getDb().insert(revisions).values({
      entityType: "service",
      entityId: service.id,
      version: 99,
      data: {},
      createdAt: later,
    })
    const entries = await listSitemapEntries()
    expect(
      entries.find((e) => e.path === "/services/alarm-responses")?.lastModified
    ).toEqual(later)
  })
})

describe("site origin for absolute URLs", () => {
  it("is the published productionUrl's origin, else BETTER_AUTH_URL's", async () => {
    expect(await getSiteOrigin()).toBe(
      new URL(process.env.BETTER_AUTH_URL ?? "").origin
    )
    const [row] = await getDb()
      .select({ published: settings.published })
      .from(settings)
      .where(eq(settings.key, "site"))
    await getDb()
      .update(settings)
      .set({
        published: {
          ...(row.published as object),
          productionUrl: "https://www.securitypartnersltd.com/home",
        },
      })
      .where(eq(settings.key, "site"))
    expect(await getSiteOrigin()).toBe("https://www.securitypartnersltd.com")
  })
})
