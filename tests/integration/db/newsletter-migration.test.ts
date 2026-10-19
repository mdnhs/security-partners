import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { newsletterSettings } from "@/lib/schemas/settings/newsletter"
import { getDb } from "@/server/db/client"
import { newsletterSubscribers, settings } from "@/server/db/schema"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => f.endsWith("_newsletter.sql"))!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)
const settingsInsert = statements.filter((s) =>
  s.startsWith('INSERT INTO "settings"')
)

const readRow = async () =>
  (
    await getDb().select().from(settings).where(eq(settings.key, "newsletter"))
  )[0]

beforeEach(resetDb)

describe("newsletter migration (0017)", () => {
  it("creates newsletter_subscribers with lower-case and status checks", async () => {
    const db = getDb()
    const [row] = await db
      .insert(newsletterSubscribers)
      .values({ email: "a@example.ie", status: "pending" })
      .returning()
    expect(row).toMatchObject({
      sourcePath: "/",
      consentText: "",
      tokenHash: null,
      confirmedAt: null,
      unsubscribedAt: null,
    })
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/)
    await expect(
      db.execute(
        sql`insert into newsletter_subscribers (id, email, status) values (gen_random_uuid(), 'B@example.ie', 'pending')`
      )
    ).rejects.toMatchObject({ cause: { constraint: "newsletter_email_lower" } })
    await expect(
      db.execute(
        sql`insert into newsletter_subscribers (id, email, status) values (gen_random_uuid(), 'b@example.ie', 'bogus')`
      )
    ).rejects.toMatchObject({ cause: { constraint: "newsletter_status" } })
    await expect(
      db
        .insert(newsletterSubscribers)
        .values({ email: "a@example.ie", status: "pending" })
    ).rejects.toThrow()
    const { rows } = await db.execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where tablename = 'newsletter_subscribers'`
    )
    expect(rows.map((r) => r.indexdef).join("\n")).toMatch(
      /\(status, created_at\)/
    )
  })

  it("inserts the off-by-default settings row from the fixture, once", async () => {
    expect(settingsInsert).toHaveLength(1)
    await getDb().execute(sql.raw(settingsInsert[0]))
    const row = await readRow()
    const fixture = settingsFixture(fixtureMediaLookup).newsletter
    expect(row.draft).toEqual(fixture)
    expect(row.published).toEqual(fixture)
    const parsed = newsletterSettings.parse(row.published)
    expect(parsed).toMatchObject({
      placement: "off",
      doubleOptIn: true,
      pendingDays: 30,
      eyebrow: "Newsletter",
      title: "Security insights in your inbox",
      subtitle: "One short email a month. Unsubscribe any time.",
      button: "Subscribe",
      success: "Check your inbox to confirm your subscription.",
    })
    // Copy for the confirm view, whose button POSTs the token (a GET never confirms).
    expect(parsed.pages.confirm).toEqual({
      title: "Confirm your subscription",
      body: expect.any(String),
      button: "Confirm subscription",
    })

    // ON CONFLICT DO NOTHING: an admin's edits survive a re-run.
    const edited = { ...parsed, placement: "blog" }
    await getDb()
      .update(settings)
      .set({ draft: edited, published: edited, version: 4 })
      .where(eq(settings.key, "newsletter"))
    await getDb().execute(sql.raw(settingsInsert[0]))
    const again = await readRow()
    expect(again.published).toEqual(edited)
    expect(again.version).toBe(4)
  })
})
