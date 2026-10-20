// Seeds the public site content (pages, settings, services, articles,
// team, clients, group companies, media library) from the fixtures.
// Idempotent: only missing rows are inserted. Refuses non-disposable
// databases unless --allow-production.
//   dev:       pnpm db:seed
//   container: node scripts/dist/seed.mjs --if-empty   (docker-entrypoint.sh,
//              every start: seeds only a database with no pages, else logs
//              that it skipped; never changes existing data, so it needs no
//              --allow-production)
//              node scripts/dist/seed.mjs --allow-production   (manual: adds
//              missing fixture rows to a database that already has content)
import { parseArgs } from "node:util"

import { getDb } from "@/server/db/client"
import { seedContent, type SeedReport, seedIfEmpty } from "@/server/db/seed"
import { assertDisposable } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"

import { runScript } from "./lib/run-script"

const summary = (report: SeedReport) =>
  Object.entries(report)
    .map(([table, n]) => `${table} +${n}`)
    .join(", ")

await runScript("db:seed", async () => {
  const { values } = parseArgs({
    options: {
      "allow-production": { type: "boolean", default: false },
      "if-empty": { type: "boolean", default: false },
    },
  })
  if (values["if-empty"]) {
    const result = await seedIfEmpty(getDb())
    console.log(
      result.seeded
        ? `[db:seed] empty database (no pages): content seeded (${summary(result.report)})`
        : `[db:seed] ${result.pages} page(s) already exist: auto-seed skipped, no data changed`
    )
    return
  }
  assertDisposable(getEnv().DATABASE_URL, values["allow-production"] ?? false)
  const report = await seedContent(getDb())
  console.log(`[db:seed] content seeded (${summary(report)})`)
})
