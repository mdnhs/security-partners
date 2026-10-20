// Saves Settings ▸ Integrations ▸ R2 from input-only variables when it is
// not saved yet (never overwrites saved settings).
//   container: node scripts/dist/r2-bootstrap.mjs   (docker-entrypoint.sh,
//              every start, after migrate + seed)
//   dev:       pnpm r2:bootstrap
// Reads SP_R2_ACCOUNT_ID, SP_R2_ACCESS_KEY_ID, SP_R2_SECRET_ACCESS_KEY,
// SP_R2_BUCKET and SP_R2_PREFIX (folder, default "sp"); the app never reads
// them. Never logs a value. Always exits 0: a failure logs `[bootstrap] …`
// and the site starts with uploads on the server disk, as before.
import { closeDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { bootstrapR2 } from "@/server/lib/r2-bootstrap"

const MESSAGES = {
  "not-set": "SP_R2_* not set: R2 settings unchanged",
  exists: "R2 settings already saved: left unchanged",
  saved: "R2 settings saved from SP_R2_* (Settings › Integrations › R2)",
} as const

try {
  getEnv()
  console.log(`[bootstrap] ${MESSAGES[await bootstrapR2(process.env)]}`)
} catch (err) {
  console.error(
    `[bootstrap] R2 settings not saved: ${err instanceof Error ? err.message : String(err)}`
  )
} finally {
  await closeDb().catch(() => undefined)
  process.exitCode = 0
}
