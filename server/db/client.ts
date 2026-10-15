import "server-only"

import { sql } from "drizzle-orm"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { AppError } from "@/server/lib/errors"

import * as schema from "./schema"

export type Db = NodePgDatabase<typeof schema>
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0]

type Holder = { url: string; pool: Pool; db: Db }

// Kept on globalThis so `next dev` HMR does not open a new pool per reload.
const store = globalThis as unknown as { __spDb?: Holder }

/**
 * Lazy pg Pool + Drizzle. Nothing connects at import time, so `next build`
 * works without DATABASE_URL. A changed DATABASE_URL (tests) gets a new pool.
 */
export function getDb(): Db {
  const url = process.env.DATABASE_URL
  if (!url) throw new AppError("INTERNAL", "DATABASE_URL is not set")
  const current = store.__spDb
  if (current?.url === url) return current.db
  if (current) void current.pool.end().catch(() => undefined)
  const pool = new Pool({
    connectionString: url,
    max: 10,
    connectionTimeoutMillis: 5_000,
  })
  pool.on("error", (err) =>
    console.error("[db] idle client error", err.message)
  )
  const db = drizzle({ client: pool, schema })
  store.__spDb = { url, pool, db }
  return db
}

/** Ends the pool (scripts and tests). */
export async function closeDb(): Promise<void> {
  const current = store.__spDb
  store.__spDb = undefined
  if (current) await current.pool.end()
}

/** `select 1` with a timeout. Never throws: false means unreachable or misconfigured. */
export async function pingDb(timeoutMs = 3_000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined
  try {
    const db = getDb()
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("db ping timed out")),
        timeoutMs
      )
    })
    await Promise.race([db.execute(sql`select 1`), timeout])
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
