// Seeds the public site content (pages, settings, services, articles,
// team, clients, group companies, media library) from the fixtures.
// Idempotent: only missing rows are inserted. Refuses non-disposable
// databases unless --allow-production (first production deploy).
//   dev:       pnpm db:seed
//   container: node scripts/dist/seed.mjs --allow-production
import { parseArgs } from "node:util"

import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import { assertDisposable } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"

import { runScript } from "./lib/run-script"

await runScript("db:seed", async () => {
  const { values } = parseArgs({
    options: { "allow-production": { type: "boolean", default: false } },
  })
  assertDisposable(getEnv().DATABASE_URL, values["allow-production"] ?? false)
  const report = await seedContent(getDb())
  const inserted = Object.entries(report)
    .map(([table, n]) => `${table} +${n}`)
    .join(", ")
  console.log(`[db:seed] content seeded (${inserted})`)
})
