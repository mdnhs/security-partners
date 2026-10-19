import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { convertLegacyCustomCode } from "@/lib/analytics/snippets"
import {
  type CustomCodeSettings,
  customCodeSettings,
} from "@/lib/schemas/settings/custom-code"
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
    expect(byId.consent).not.toHaveProperty("metaEnabled")
  })
})

const consentRow = async () =>
  (await getDb().select().from(settings).where(eq(settings.key, "consent")))[0]!

describe("marketing migration — consent version and interval (D2.2)", () => {
  it("backfills version 1 and 6 months; existing values win; null and non-objects are skipped", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "consent",
        draft: { title: "T", version: 3 },
        published: { title: "T" },
      })
    await getDb()
      .insert(revisions)
      .values([
        {
          entityType: "settings",
          entityId: "consent",
          version: 1,
          data: { title: "Old", reconsentMonths: 2 },
        },
        {
          entityType: "settings",
          entityId: "tracking",
          version: 1,
          data: "broken",
        },
      ])
    await migrate()
    await migrate()
    const row = await consentRow()
    expect(row.draft).toEqual({ title: "T", version: 3, reconsentMonths: 6 })
    expect(row.published).toEqual({
      title: "T",
      version: 1,
      reconsentMonths: 6,
    })
    const revs = await getDb().select().from(revisions)
    const byId = Object.fromEntries(revs.map((r) => [r.entityId, r.data]))
    expect(byId.consent).toEqual({
      title: "Old",
      version: 1,
      reconsentMonths: 2,
    })
    expect(byId.tracking).toBe("broken")
  })

  it("a null published consent stays null", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "consent", draft: "broken", published: null })
    await migrate()
    const row = await consentRow()
    expect(row.draft).toBe("broken")
    expect(row.published).toBeNull()
  })
})

describe("marketing migration — custom code becomes snippets (D2.3)", () => {
  const codeRow = async () =>
    (
      await getDb()
        .select()
        .from(settings)
        .where(eq(settings.key, "customCode"))
    )[0]!
  const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  const withoutIds = (v: unknown) => {
    const value = v as CustomCodeSettings
    return {
      ...value,
      snippets: value.snippets.map(({ id: _id, ...rest }) => rest),
    }
  }

  it("legacy head HTML becomes one necessary snippet, as convertLegacyCustomCode does", async () => {
    const legacy = { headHtml: '<meta name="v">', bodyEndHtml: "" }
    await getDb()
      .insert(settings)
      .values({ key: "customCode", draft: legacy, published: legacy })
    await migrate()
    const row = await codeRow()
    const expected = withoutIds(convertLegacyCustomCode(legacy))
    expect(withoutIds(row.draft)).toEqual(expected)
    expect(withoutIds(row.published)).toEqual(expected)
    const draft = row.draft as CustomCodeSettings
    expect(draft.snippets).toHaveLength(1)
    expect(draft.snippets[0]!.id).toMatch(UUID)
    // Draft and published share ids, so the editor shows no change.
    expect(row.published).toEqual(row.draft)
    expect(customCodeSettings.safeParse(row.published).success).toBe(true)
  })

  it("head and body; blank code is dropped; re-running is harmless", async () => {
    const legacy = {
      headHtml: "  \n",
      bodyEndHtml: "<script>window.x=1</script>",
    }
    await getDb()
      .insert(settings)
      .values({
        key: "customCode",
        draft: { headHtml: "<b>h</b>", bodyEndHtml: "<i>b</i>" },
        published: legacy,
      })
    await migrate()
    const first = await codeRow()
    expect(withoutIds(first.published)).toEqual(
      withoutIds(convertLegacyCustomCode(legacy))
    )
    expect(withoutIds(first.draft)).toEqual(
      withoutIds(
        convertLegacyCustomCode({
          headHtml: "<b>h</b>",
          bodyEndHtml: "<i>b</i>",
        })
      )
    )
    await migrate()
    expect(await codeRow()).toEqual(first)
  })

  it("null published stays null; non-objects and revisions are handled", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "customCode", draft: "broken", published: null })
    await getDb()
      .insert(revisions)
      .values({
        entityType: "settings",
        entityId: "customCode",
        version: 1,
        data: { headHtml: "", bodyEndHtml: "<p>r</p>" },
      })
    await migrate()
    const row = await codeRow()
    expect(row.draft).toBe("broken")
    expect(row.published).toBeNull()
    const [rev] = await getDb()
      .select()
      .from(revisions)
      .where(eq(revisions.entityId, "customCode"))
    expect(withoutIds(rev!.data)).toEqual(
      withoutIds(
        convertLegacyCustomCode({ headHtml: "", bodyEndHtml: "<p>r</p>" })
      )
    )
  })
})
