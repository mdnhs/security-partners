import { spawnSync } from "node:child_process"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { SETTINGS_KEYS } from "@/lib/schemas/settings"
import { getDb } from "@/server/db/client"
import {
  accounts,
  articles,
  media,
  pages,
  services,
  settings,
  users,
} from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { contentFixtures } from "@/server/db/seed/fixtures"
import type { MediaLookup } from "@/server/db/seed/fixtures/media"

import { resetDb } from "../db"

const TABLES = [
  "media",
  "users",
  "article_categories",
  "settings",
  "pages",
  "services",
  "articles",
  "team_members",
  "clients",
  "group_companies",
] as const

async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of TABLES) {
    const { rows } = await getDb().execute<{ n: number }>(
      sql.raw(`select count(*)::int as n from "${table}"`)
    )
    out[table] = rows[0].n
  }
  return out
}

/** Fixtures built with the ids the seed actually inserted. */
async function dbFixtures() {
  const rows = await getDb()
    .select({ id: media.id, key: media.key })
    .from(media)
  const byKey = new Map(rows.map((r) => [r.key, r.id]))
  const lookup: MediaLookup = (key) => ({ mediaId: byKey.get(key)! })
  return contentFixtures(lookup)
}

beforeEach(resetDb)

describe("seedContent (master Task 3.4)", () => {
  it("is idempotent: a second run inserts nothing and counts stay equal", async () => {
    const first = await seedContent(getDb())
    expect(first).toEqual({
      media: 32,
      users: 1,
      articleCategories: 7,
      settings: 16,
      pages: 8,
      services: 6,
      articles: 7,
      teamMembers: 4,
      clients: 8,
      groupCompanies: 2,
    })
    const before = await counts()
    const second = await seedContent(getDb())
    expect(Object.values(second).every((n) => n === 0)).toBe(true)
    expect(await counts()).toEqual(before)
  })

  it("restores only a missing row and never overwrites edits", async () => {
    await seedContent(getDb())
    const db = getDb()
    await db
      .update(services)
      .set({ sortOrder: 99 })
      .where(eq(services.slug, "event-security"))
    await db.delete(services).where(eq(services.slug, "static-security"))
    const report = await seedContent(db)
    expect(report.services).toBe(1)
    const [edited] = await db
      .select({ sortOrder: services.sortOrder })
      .from(services)
      .where(eq(services.slug, "event-security"))
    expect(edited.sortOrder).toBe(99)
  })

  it("seeds versioned rows published: draft = published, version 1", async () => {
    await seedContent(getDb())
    const db = getDb()
    for (const table of [pages, services, articles]) {
      const rows = await db.select().from(table)
      for (const row of rows) {
        expect(row.status).toBe("published")
        expect(row.version).toBe(1)
        expect(row.publishedAt).toBeInstanceOf(Date)
        expect(row.published).toEqual(row.draft)
      }
    }
    const settingsRows = await db.select().from(settings)
    expect(settingsRows.map((r) => r.key).sort()).toEqual(
      [...SETTINGS_KEYS].sort()
    )
    for (const row of settingsRows) expect(row.published).toEqual(row.draft)
  })

  it("stores every fixture string unchanged (Review Focus 1)", async () => {
    await seedContent(getDb())
    const fx = await dbFixtures()
    const db = getDb()
    for (const row of await db.select().from(settings))
      expect(row.published).toEqual(
        fx.settings[row.key as keyof typeof fx.settings]
      )
    for (const row of await db.select().from(pages)) {
      const page = fx.pages[row.key as keyof typeof fx.pages]
      expect(row.published).toEqual(page.data)
      expect(row.seo).toEqual(page.seo)
    }
    for (const s of fx.services) {
      const [row] = await db
        .select()
        .from(services)
        .where(eq(services.slug, s.slug))
      expect(row.published).toEqual(s.content)
    }
    for (const a of fx.articles) {
      const [row] = await db
        .select()
        .from(articles)
        .where(eq(articles.slug, a.slug))
      expect(row.published).toEqual(a.content)
      expect(row.publishedAt).toEqual(a.publishedAt)
      expect(row.readTimeMinutes).toBe(a.readTimeMinutes)
    }
    const [contact] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "contact"))
    expect((contact.published as { hours: string }).hours).toBe(
      "Monday–Friday, 9am to 6pm"
    )
    const [home] = await db.select().from(pages).where(eq(pages.key, "home"))
    expect((home.published as { hero: { eyebrow: string } }).hero.eyebrow).toBe(
      "Mountmellick, Co. Laois  •  Since 2008"
    )
  })

  it("registers library images as static media with dimensions", async () => {
    await seedContent(getDb())
    const rows = await getDb().select().from(media)
    expect(rows).toHaveLength(32)
    for (const row of rows) {
      expect(row.driver).toBe("static")
      expect(row.key).toMatch(/^\/images\//)
      expect(row.width).toBeGreaterThan(0)
      expect(row.height).toBeGreaterThan(0)
    }
  })

  it("creates byline authors that cannot sign in", async () => {
    await seedContent(getDb())
    const db = getDb()
    const [author] = await db
      .select()
      .from(users)
      .where(eq(users.email, "michael.mcdonald@authors.invalid"))
    expect(author).toMatchObject({
      name: "Michael McDonald",
      title: "Managing Director",
      banned: true,
    })
    expect(
      await db.select().from(accounts).where(eq(accounts.userId, author.id))
    ).toEqual([])
    const linked = await db
      .select({ slug: articles.slug })
      .from(articles)
      .where(eq(articles.authorId, author.id))
    expect(linked.map((r) => r.slug).sort()).toEqual([
      "18-years-of-watching-over-ireland",
      "mobile-patrols-protect-your-business-after-hours",
    ])
  })
})

describe("pnpm db:seed guard", () => {
  it("refuses a non-disposable database without --allow-production", () => {
    const run = spawnSync("pnpm", ["db:seed"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgres://sp:sp@db.example.com:5432/security",
      },
    })
    expect(run.status).toBe(1)
    expect(run.stderr).toContain("--allow-production")
  }, 30_000)
})
