import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { and, eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { seoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"
import { getDb } from "@/server/db/client"
import { revisions, settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) =>
  f.endsWith("_seo_defaults_robots.sql")
)!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

/** seo.defaults as stored before D1.6 (after 0008). */
const legacy = {
  title: "T",
  titleTemplate: "{title} | T",
  description: "D",
  ogImage: null,
  organization: {
    type: "LocalBusiness",
    streetAddress: "Derryguile",
    addressLocality: "Mountmellick",
    addressRegion: "Co. Laois",
    postalCode: "R32 YX49",
    addressCountry: "IE",
    areaServed: "Ireland",
    sameAs: [],
  },
}

async function migrate() {
  for (const statement of statements) await getDb().execute(sql.raw(statement))
}

const row = async () =>
  (
    await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "seo.defaults"))
  )[0]

beforeEach(resetDb)

describe("seo_defaults_robots (custom data migration, plan 0013)", () => {
  it("backfills index + empty tokens on draft and published; keeps values already set", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "seo.defaults",
        draft: {
          ...legacy,
          robots: "noindex",
          verification: { google: "g1", bing: "b1" },
        },
        published: legacy,
        version: 4,
      })
    await migrate()
    const after = await row()
    const published = seoDefaultsSettings.parse(after.published)
    expect(published.robots).toBe("index")
    expect(published.verification).toEqual({ google: "", bing: "" })
    expect(published.title).toBe("T")
    const draft = seoDefaultsSettings.parse(after.draft)
    expect(draft.robots).toBe("noindex")
    expect(draft.verification).toEqual({ google: "g1", bing: "b1" })
    expect(after.version).toBe(4)
  })

  it("null published stays null; safe to re-run", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "seo.defaults", draft: legacy, published: null })
    await migrate()
    await migrate()
    const after = await row()
    expect(after.published).toBeNull()
    expect(seoDefaultsSettings.safeParse(after.draft).success).toBe(true)
  })

  it("backfills seo.defaults revisions only (restore keeps working)", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "seo.defaults", draft: legacy, published: legacy })
    await getDb()
      .insert(revisions)
      .values([
        {
          entityType: "settings",
          entityId: "seo.defaults",
          version: 1,
          data: legacy,
        },
        {
          entityType: "settings",
          entityId: "consent",
          version: 1,
          data: { title: "T" },
        },
      ])
    await migrate()
    const [seo] = await getDb()
      .select()
      .from(revisions)
      .where(
        and(
          eq(revisions.entityType, "settings"),
          eq(revisions.entityId, "seo.defaults")
        )
      )
    expect(seoDefaultsSettings.parse(seo.data).robots).toBe("index")
    const [consent] = await getDb()
      .select()
      .from(revisions)
      .where(eq(revisions.entityId, "consent"))
    expect(consent.data).toEqual({ title: "T" })
  })
})
