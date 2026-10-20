import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { DraftDocument, validateDocument } from "@/blocks/document"
import { getDb } from "@/server/db/client"
import {
  builderPages,
  jobs,
  publicRateLimits,
  revisions,
  settings,
} from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => f.endsWith("_remove_newsletter.sql"))!
const statements = () =>
  readFileSync(join(DIR, file), "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)

const migrate = async () => {
  for (const statement of statements())
    await getDb().execute(sql.raw(statement))
}

const banner = (id: string, type = "enquireBanner") => ({
  id: `block-${id}`,
  type,
  anchor: `banner-${id}`,
  hidden: false,
  data: { useShared: true },
})
const signup = (id: string, hidden = false) => ({
  id: `block-${id}`,
  type: "newsletter",
  anchor: "newsletter",
  hidden,
  data: { useShared: true },
})

const tableExists = async () => {
  const { rows } = await getDb().execute<{ name: string | null }>(
    sql`select to_regclass('public.newsletter_subscribers')::text as name`
  )
  return rows[0]?.name !== null
}

const page = async (slug: string) =>
  (
    await getDb().select().from(builderPages).where(eq(builderPages.slug, slug))
  )[0]!

beforeEach(async () => {
  await resetDb()
  // The table 0017 created (the integration DB is already past this migration).
  await getDb().execute(
    sql`create table if not exists newsletter_subscribers (id uuid primary key, email text not null unique)`
  )
})

describe("remove newsletter migration", () => {
  it("drops the subscriber table with its data", async () => {
    await getDb().execute(
      sql`insert into newsletter_subscribers (id, email) values (gen_random_uuid(), 'a@example.ie')`
    )
    expect(await tableExists()).toBe(true)
    await migrate()
    expect(await tableExists()).toBe(false)
  })

  it("deletes the settings row, its revisions, the purge job and the rate-limit buckets", async () => {
    const db = getDb()
    const later = new Date(Date.now() + 60_000)
    await db.insert(settings).values([
      { key: "newsletter", draft: { placement: "blog" }, published: {} },
      { key: "leads", draft: { keep: true }, published: { keep: true } },
    ])
    await db.insert(revisions).values([
      { entityType: "settings", entityId: "newsletter", version: 1, data: {} },
      { entityType: "settings", entityId: "leads", version: 1, data: {} },
    ])
    await db.insert(jobs).values([
      { name: "purge-newsletter", key: "purge-newsletter", runAt: later },
      { name: "purge-leads", key: "purge-leads", runAt: later },
    ])
    await db
      .insert(publicRateLimits)
      .values(
        [
          "newsletter:ip",
          "newsletter:email:x",
          "newsletter-resend:x",
          "newsletter-token:ip",
          "leads:ip",
        ].map((key) => ({ key, count: 1, resetAt: later }))
      )

    await migrate()

    expect((await db.select().from(settings)).map((r) => r.key)).toEqual([
      "leads",
    ])
    expect((await db.select().from(revisions)).map((r) => r.entityId)).toEqual([
      "leads",
    ])
    expect((await db.select().from(jobs)).map((r) => r.key)).toEqual([
      "purge-leads",
    ])
    expect(
      (await db.select().from(publicRateLimits)).map((r) => r.key)
    ).toEqual(["leads:ip"])
  })

  it("strips newsletter blocks from builder drafts, published documents and revisions", async () => {
    const db = getDb()
    const mixed = {
      blocks: [banner("b1"), signup("n1"), banner("b2", "clients")],
    }
    const [withBlock] = await db
      .insert(builderPages)
      .values({
        slug: "mixed",
        title: "Mixed",
        draft: mixed as never,
        published: mixed as never,
        status: "published",
        publishedAt: new Date(),
        version: 3,
      })
      .returning()
    const onlySignup = { blocks: [signup("n2", true)] }
    await db.insert(builderPages).values({
      slug: "only-signup",
      title: "Only signup",
      draft: onlySignup as never,
      published: onlySignup as never,
      status: "published",
      publishedAt: new Date(),
    })
    const plain = { blocks: [banner("b3")] }
    await db.insert(builderPages).values({
      slug: "plain",
      title: "Plain",
      draft: plain as never,
      published: plain as never,
      status: "published",
      publishedAt: new Date(),
    })
    await db.insert(revisions).values({
      entityType: "builder-page",
      entityId: withBlock!.id,
      version: 3,
      data: mixed,
    })

    await migrate()

    const kept = await page("mixed")
    const expected = { blocks: [banner("b1"), banner("b2", "clients")] }
    expect(kept.draft).toEqual(expected)
    expect(kept.published).toEqual(expected)
    expect(kept.status).toBe("published")
    expect(kept.version).toBeGreaterThan(3)
    expect(validateDocument(kept.published)).toEqual({
      ok: true,
      doc: expected,
    })
    expect(DraftDocument.safeParse(kept.draft).success).toBe(true)

    // Nothing left to publish: the page goes back to draft.
    const emptied = await page("only-signup")
    expect(emptied.draft).toEqual({ blocks: [] })
    expect(emptied.published).toBeNull()
    expect(emptied.status).toBe("draft")
    expect(emptied.publishedAt).toBeNull()
    expect(DraftDocument.safeParse(emptied.draft).success).toBe(true)

    const untouched = await page("plain")
    expect(untouched.published).toEqual(plain)
    expect(untouched.version).toBe(1)

    const [revision] = await db.select().from(revisions)
    expect(revision!.data).toEqual(expected)
    expect(DraftDocument.safeParse(revision!.data).success).toBe(true)
  })
})
