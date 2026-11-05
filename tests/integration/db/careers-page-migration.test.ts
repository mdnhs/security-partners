import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { and, eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { careersSettings as current } from "@/lib/schemas/settings/careers"

// As 0022 wrote it: keepOnFileMonths came with 0025.
const careersSettings = current.omit({ keepOnFileMonths: true })
import { getDb } from "@/server/db/client"
import { media, pages, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { careersTemplate } from "@/templates/careers/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => f.endsWith("_careers_page.sql"))!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

async function migrate() {
  for (const statement of statements) await getDb().execute(sql.raw(statement))
}

const settingsRow = async (key: string) =>
  (await getDb().select().from(settings).where(eq(settings.key, key)))[0]

/** A database seeded before careers existed: no page, no settings, no nav link. */
async function legacyDatabase() {
  await seedContent(getDb())
  await getDb().delete(pages).where(eq(pages.key, "careers"))
  await getDb().delete(settings).where(eq(settings.key, "careers"))
  const nav = await settingsRow("navigation")
  const strip = (value: unknown) => {
    const v = value as { headerLinks: { href: string }[] }
    return {
      ...v,
      headerLinks: v.headerLinks.filter((l) => l.href !== "/careers"),
    }
  }
  await getDb()
    .update(settings)
    .set({ draft: strip(nav.draft), published: strip(nav.published) })
    .where(eq(settings.key, "navigation"))
}

beforeEach(resetDb)

describe("careers_page (data migration 0022)", () => {
  it("adds the published careers page with its media resolved", async () => {
    await legacyDatabase()
    await migrate()
    const [row] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "careers"))
    expect(row.template).toBe("careers")
    expect(row.status).toBe("published")
    const data = careersTemplate.parse(row.published)
    expect(careersTemplate.parse(row.draft)).toEqual(data)
    const [hero] = await getDb()
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.driver, "static"), eq(media.key, "/images/hero.jpg")))
    expect(data.hero.image.mediaId).toBe(hero.id)
  })

  it("restores a missing static image row instead of skipping the page (every page needs it)", async () => {
    await legacyDatabase()
    await getDb()
      .update(media)
      .set({ key: "/images/icon-chart-renamed.svg" })
      .where(
        and(eq(media.driver, "static"), eq(media.key, "/images/icon-chart.svg"))
      )
    await migrate()
    const [row] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.key, "careers"))
    expect(row?.status).toBe("published")
    const [chart] = await getDb()
      .select()
      .from(media)
      .where(
        and(eq(media.driver, "static"), eq(media.key, "/images/icon-chart.svg"))
      )
    expect(chart).toMatchObject({ mime: "image/svg+xml" })
    const data = careersTemplate.parse(row.published)
    expect(data.whyJoin.cards.map((c) => c.icon.mediaId)).toContain(chart.id)
  })

  it("adds careers settings, copying the enquiry recipients", async () => {
    await legacyDatabase()
    const leads = await settingsRow("leads")
    await migrate()
    const row = await settingsRow("careers")
    const value = careersSettings.parse(row.published)
    expect(value.recipients).toEqual(
      (leads.published as { recipients: string[] }).recipients
    )
    expect(value.retentionMonths).toBe(12)
    expect(careersSettings.parse(row.draft)).toEqual(value)
  })

  it("puts Careers into the header links before Contact, once", async () => {
    await legacyDatabase()
    await migrate()
    await migrate()
    const nav = await settingsRow("navigation")
    for (const value of [nav.draft, nav.published]) {
      const hrefs = (
        value as { headerLinks: { href: string }[] }
      ).headerLinks.map((l) => l.href)
      expect(hrefs.filter((h) => h === "/careers")).toHaveLength(1)
      expect(hrefs.indexOf("/careers")).toBe(hrefs.indexOf("/contact") - 1)
    }
  })

  it("leaves an existing careers page and settings alone", async () => {
    await seedContent(getDb())
    await getDb()
      .update(settings)
      .set({ published: { recipients: ["x@y.ie"], retentionMonths: 6 } })
      .where(eq(settings.key, "careers"))
    const before = (
      await getDb().select().from(pages).where(eq(pages.key, "careers"))
    )[0]
    await migrate()
    const after = (
      await getDb().select().from(pages).where(eq(pages.key, "careers"))
    )[0]
    expect(after.version).toBe(before.version)
    expect(after.updatedAt).toEqual(before.updatedAt)
    expect((await settingsRow("careers")).published).toEqual({
      recipients: ["x@y.ie"],
      retentionMonths: 6,
    })
  })

  it("does nothing on an empty database (the seed runs after migrations)", async () => {
    await migrate()
    expect(await getDb().select().from(pages)).toEqual([])
    expect(await getDb().select().from(settings)).toEqual([])
  })
})
