import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"

import { getDb, pingDb } from "@/server/db/client"

import { resetDb } from "../db"

describe("database client (sp_test)", () => {
  it("connects and runs select 1", async () => {
    const { rows } = await getDb().execute<{ one: number }>(
      sql`select 1 as one`
    )
    expect(rows).toEqual([{ one: 1 }])
    await expect(pingDb()).resolves.toBe(true)
  })

  it("has the migrations applied (content_status enum, journal row)", async () => {
    const db = getDb()
    const { rows: labels } = await db.execute<{ label: string }>(
      sql`select e.enumlabel as label from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'content_status' order by e.enumsortorder`
    )
    expect(labels.map((r) => r.label)).toEqual([
      "draft",
      "in_review",
      "scheduled",
      "published",
    ])
    const { rows: applied } = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from drizzle.__drizzle_migrations`
    )
    expect(applied[0].n).toBeGreaterThanOrEqual(1)
  })

  it("resetDb truncates every public table", async () => {
    const db = getDb()
    await db.execute(
      sql`create table if not exists public.reset_probe (id int)`
    )
    await db.execute(sql`insert into public.reset_probe values (1), (2)`)
    await resetDb()
    const { rows } = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from public.reset_probe`
    )
    expect(rows[0].n).toBe(0)
    await db.execute(sql`drop table public.reset_probe`)
  })
})
