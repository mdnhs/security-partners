import "server-only"

import { resolve } from "node:path"

import { drizzle } from "drizzle-orm/node-postgres"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import { Client } from "pg"

// Any constant works; it only has to be the same for every app instance.
const MIGRATION_LOCK_ID = 7_314_001

/** Default: <cwd>/server/db/migrations (repo root in dev/CI, /app in the container). */
export const MIGRATIONS_DIR = resolve(process.cwd(), "server/db/migrations")

/**
 * Applies pending Drizzle migrations. A Postgres advisory lock serialises
 * concurrent runs (several replicas starting at once).
 */
export async function runMigrations(
  url: string,
  migrationsFolder = MIGRATIONS_DIR
): Promise<void> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_ID])
    try {
      await migrate(drizzle({ client }), { migrationsFolder })
    } finally {
      await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_ID])
    }
  } finally {
    await client.end()
  }
}
