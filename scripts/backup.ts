// One DB backup now (the app also runs one daily, spec §12/§14).
//   dev:       pnpm backup
//   container: node scripts/dist/backup.mjs
// Writes sp-<db>-<UTC stamp>.dump + .json to R2 (backups/) when
// Settings ▸ Integrations ▸ R2 is saved, else to /data/backups; keeps 14.
import { runBackup } from "@/server/lib/backup"

import { runScript } from "./lib/run-script"

await runScript("backup", async () => {
  const result = await runBackup()
  const kb = Math.ceil(result.bytes / 1024)
  console.log(
    `[backup] ${result.name} (${kb} KB) → ${result.location}; ${Object.keys(result.manifest.counts).length} tables`
  )
  if (result.pruned.length)
    console.log(`[backup] removed old backups: ${result.pruned.join(", ")}`)
})
