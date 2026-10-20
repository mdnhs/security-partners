import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { eq, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"
import { getDb } from "@/server/db/client"
import { settings } from "@/server/db/schema"

import { resetDb } from "../db"

const DIR = "server/db/migrations"
const file = readdirSync(DIR).find((f) => /^\d{4}_theme\.sql$/.test(f))
const statements = file
  ? readFileSync(join(DIR, file), "utf8")
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean)
  : []

async function migrate() {
  for (const statement of statements) await getDb().execute(sql.raw(statement))
}

const themeRow = async () => {
  const [row] = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, "theme"))
  return row
}

beforeEach(resetDb)

describe("NNNN_theme (custom data migration)", () => {
  it("exists and inserts the default theme as draft and published", async () => {
    expect(file).toBeDefined()
    await migrate()
    const row = await themeRow()
    expect(row).toBeDefined()
    expect(ThemeConfig.parse(row!.published)).toEqual(DEFAULT_THEME)
    expect(ThemeConfig.parse(row!.draft)).toEqual(DEFAULT_THEME)
    expect(row!.version).toBe(1)
  })

  it("keeps an existing theme row and is safe to re-run", async () => {
    expect(file).toBeDefined()
    const custom = {
      ...DEFAULT_THEME,
      admin: { ...DEFAULT_THEME.admin, radius: 1 },
    }
    await getDb()
      .insert(settings)
      .values({ key: "theme", draft: custom, published: custom, version: 4 })
    await migrate()
    await migrate()
    const row = await themeRow()
    expect(row!.version).toBe(4)
    expect(row!.published).toEqual(custom)
  })
})
