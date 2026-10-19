import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { revisions, settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => f.endsWith("_marketing.sql"))!
const statements = () =>
  readFileSync(join(DIR, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

const migrate = async () => {
  for (const statement of statements())
    await getDb().execute(sql.raw(statement))
}

const trackingRow = async () =>
  (
    await getDb().select().from(settings).where(eq(settings.key, "tracking"))
  )[0]!

beforeEach(resetDb)

describe("marketing migration — tracking channel switches", () => {
  it("backfills switches from enabled + ID; an existing gtmEnabled is untouched", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "tracking",
        draft: {
          enabled: true,
          gtmEnabled: false,
          gtmId: "GTM-A1",
          ga4Id: "G-A1",
          metaPixelId: null,
        },
        published: {
          enabled: true,
          gtmId: "GTM-A1",
          ga4Id: null,
          metaPixelId: null,
        },
      })
    await migrate()
    const row = await trackingRow()
    expect(row.published).toEqual({
      enabled: true,
      gtmId: "GTM-A1",
      ga4Id: null,
      metaPixelId: null,
      gtmEnabled: true,
      ga4Enabled: false,
      metaEnabled: false,
    })
    expect(row.draft).toEqual({
      enabled: true,
      gtmEnabled: false,
      gtmId: "GTM-A1",
      ga4Id: "G-A1",
      metaPixelId: null,
    })
  })

  it("tracking off (or no enabled flag) leaves every switch off; null published stays null", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "tracking",
        draft: { gtmId: "GTM-A1", ga4Id: "G-A1", metaPixelId: "123" },
        published: null,
      })
    await migrate()
    const row = await trackingRow()
    expect(row.draft).toMatchObject({
      gtmEnabled: false,
      ga4Enabled: false,
      metaEnabled: false,
    })
    expect(row.published).toBeNull()
  })

  it("patches tracking revisions only, skips non-objects, and is safe to re-run", async () => {
    const data = {
      enabled: true,
      gtmId: null,
      ga4Id: null,
      metaPixelId: "123",
    }
    await getDb()
      .insert(settings)
      .values({ key: "tracking", draft: "broken", published: data })
    await getDb()
      .insert(revisions)
      .values([
        { entityType: "settings", entityId: "tracking", version: 1, data },
        { entityType: "settings", entityId: "consent", version: 1, data },
      ])
    await migrate()
    await migrate()
    const row = await trackingRow()
    expect(row.draft).toBe("broken")
    expect(row.published).toMatchObject({
      gtmEnabled: false,
      ga4Enabled: false,
      metaEnabled: true,
    })
    const revs = await getDb().select().from(revisions)
    const byId = Object.fromEntries(revs.map((r) => [r.entityId, r.data]))
    expect(byId.tracking).toMatchObject({ metaEnabled: true })
    expect(byId.consent).toEqual(data)
  })
})
