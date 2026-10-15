// Gives the server under test (playwright.config.ts webServer) a database
// with exactly the seeded content, so screenshots compare seed → Phase 0
// baselines. Runs before `next start` on every Playwright run:
//   pnpm tsx:server tests/visual/seed.ts   (env from tests/e2e/env.ts)
import { closeDb, getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import { seedContent } from "@/server/db/seed"
import { getEnv } from "@/server/env"

import { resetDb } from "../integration/db"

const { DATABASE_URL } = getEnv()
const name = new URL(DATABASE_URL).pathname
if (!name.endsWith("_e2e"))
  throw new Error(`Refusing to reset a non-E2E database (${name})`)

await runMigrations(DATABASE_URL)
await resetDb()
const report = await seedContent(getDb())
await closeDb()
console.log(
  `[visual] ${name.slice(1)} reset and seeded (${report.pages} pages)`
)
