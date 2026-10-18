import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { seoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) =>
  f.endsWith("_seo_defaults_organization.sql")
)!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

const legacy = {
  title: "T",
  titleTemplate: "{title} | T",
  description: "D",
  ogImage: null,
}

async function migrate() {
  for (const statement of statements) await getDb().execute(sql.raw(statement))
}

beforeEach(resetDb)

describe("0008_seo_defaults_organization (custom data migration)", () => {
  it("adds organization to old rows and keeps values already there", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "seo.defaults",
        draft: { ...legacy, organization: { areaServed: "Leinster" } },
        published: legacy,
        version: 3,
      })
    await migrate()
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "seo.defaults"))
    const published = seoDefaultsSettings.parse(row.published)
    expect(published.organization).toEqual({
      type: "LocalBusiness",
      streetAddress: "Derryguile",
      addressLocality: "Mountmellick",
      addressRegion: "Co. Laois",
      postalCode: "R32 YX49",
      addressCountry: "IE",
      areaServed: "Ireland",
      sameAs: [],
    })
    expect(seoDefaultsSettings.parse(row.draft).organization.areaServed).toBe(
      "Leinster"
    )
    expect(row.version).toBe(3)
  })

  it("leaves an unpublished row's published value null and is safe to re-run", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "seo.defaults", draft: legacy, published: null })
    await migrate()
    await migrate()
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "seo.defaults"))
    expect(row.published).toBeNull()
    expect(seoDefaultsSettings.safeParse(row.draft).success).toBe(true)
  })
})
