// Applies pending migrations.
//   dev:       pnpm db:migrate              (env from .env.development)
//   container: node scripts/dist/migrate.mjs (docker-entrypoint.sh, before server.js)
// Validates all three env vars first, so a misconfigured container fails at
// start with a readable list instead of on the first request.
import { runMigrations } from "@/server/db/migrate"
import { getEnv } from "@/server/env"

try {
  const { DATABASE_URL } = getEnv()
  await runMigrations(DATABASE_URL)
  console.log("[migrate] migrations applied")
} catch (err) {
  console.error(`[migrate] ${err instanceof Error ? err.message : String(err)}`)
  process.exit(1)
}
