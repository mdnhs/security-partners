import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) =>
  f.endsWith("_consent_manage_label.sql")
)!
const statements = readFileSync(join(DIR, file), "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean)

beforeEach(resetDb)

describe("0009_consent_manage_label (custom data migration)", () => {
  it("adds manageLabel where missing and keeps an edited one", async () => {
    await getDb()
      .insert(settings)
      .values({
        key: "consent",
        draft: { title: "T", manageLabel: "Privacy choices" },
        published: { title: "T" },
      })
    for (const statement of statements)
      await getDb().execute(sql.raw(statement))
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "consent"))
    expect(row.published).toEqual({
      title: "T",
      manageLabel: "Cookie settings",
    })
    expect(row.draft).toEqual({ title: "T", manageLabel: "Privacy choices" })
  })

  it("patches draft and published independently; null published stays null", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "consent", draft: { title: "T" }, published: null })
    for (const statement of statements)
      await getDb().execute(sql.raw(statement))
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "consent"))
    expect(row.draft).toEqual({ title: "T", manageLabel: "Cookie settings" })
    expect(row.published).toBeNull()
  })

  it("patches a published object even when the draft is not an object", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "consent", draft: "broken", published: { title: "P" } })
    for (const statement of statements)
      await getDb().execute(sql.raw(statement))
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "consent"))
    expect(row.draft).toBe("broken")
    expect(row.published).toEqual({
      title: "P",
      manageLabel: "Cookie settings",
    })
  })
})
