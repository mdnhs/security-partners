import { sql } from "drizzle-orm"

import { getDb } from "@/server/db/client"

/** sp_test from docker-compose.dev.yml; CI's postgres service uses the same URL. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://sp:sp@127.0.0.1:5432/sp_test"

/** Truncates every table in the public schema (migration bookkeeping lives in the "drizzle" schema). */
export async function resetDb(): Promise<void> {
  const db = getDb()
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`
  )
  if (rows.length === 0) return
  const list = rows
    .map((r) => `"public"."${r.tablename.replaceAll('"', '""')}"`)
    .join(", ")
  await db.execute(sql.raw(`truncate table ${list} restart identity cascade`))
}
