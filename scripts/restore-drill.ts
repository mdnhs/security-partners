// Restores the newest backup into <db>_restore_drill on the same server and
// compares every table's row count with the backup's manifest (spec §14).
//   dev:       pnpm restore-drill [--keep]
//   container: node scripts/dist/restore-drill.mjs [--keep]
// --keep leaves the scratch database for inspection. Exit code 1 on a mismatch.
import { parseArgs } from "node:util"

import { restoreDrill } from "@/server/lib/backup/restore-drill"

import { runScript } from "./lib/run-script"

await runScript("restore-drill", async () => {
  const { values } = parseArgs({
    options: { keep: { type: "boolean", default: false } },
  })
  const result = await restoreDrill({ keepScratch: values.keep ?? false })
  console.log(
    `[restore-drill] ${result.backup} → ${result.scratchDatabase}: ${result.tables} tables checked`
  )
  if (!result.ok) {
    for (const m of result.mismatches)
      console.error(
        `[restore-drill] ${m.table}: expected ${m.expected}, restored ${m.actual ?? "missing"}`
      )
    throw new Error("restore drill FAILED: counts differ (see above)")
  }
  console.log("[restore-drill] OK: every count matches the backup manifest")
})
