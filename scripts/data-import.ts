// One-shot import of a `pnpm data:export-to-r2` dump (docs/runbook.md
// "Import local data into production").
//   container: node scripts/dist/data-import.mjs   (docker-entrypoint.sh,
//              every start, after migrate and before seed + r2-bootstrap)
// Input-only variables (never read by the app):
//   SP_IMPORT_KEY            object key printed by the export, e.g. sp/bootstrap/20261020T090000Z.dump
//   SP_IMPORT_SOURCE_SECRET  BETTER_AUTH_SECRET of the exported database
//   SP_R2_ACCOUNT_ID, SP_R2_ACCESS_KEY_ID, SP_R2_SECRET_ACCESS_KEY, SP_R2_BUCKET, SP_R2_PREFIX
// Nothing happens without SP_IMPORT_KEY, or when this database already
// holds that import (settings row ops.data-import, written the moment the
// restore commits). Logs `[import] …`, never a secret. Always exits 0: a
// failure before the restore leaves the database unchanged; a failure after
// it is logged as `[import] FAIL …` (marker status restored-with-errors, no
// re-import on restart) and the site starts with the restored data.
import { closeDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import { runDataImport } from "@/server/lib/data-import"
import { SyncError } from "@/server/lib/db-sync"
import { r2ConfigFromEnv } from "@/server/lib/r2-bootstrap"

const log = (line: string) => console.log(`[import] ${line}`)
const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

// Read once, then drop every input-only variable: pg_dump / pg_restore and
// other child processes inherit process.env.
const key = (process.env.SP_IMPORT_KEY ?? "").trim()
const sourceSecret = process.env.SP_IMPORT_SOURCE_SECRET ?? ""
const r2Env = { ...process.env }
for (const name of Object.keys(process.env))
  if (name.startsWith("SP_")) delete process.env[name]

try {
  if (!key) {
    log("SP_IMPORT_KEY not set: nothing to import")
  } else {
    getEnv()
    if (!sourceSecret) throw new Error("SP_IMPORT_SOURCE_SECRET is not set")
    const r2 = r2ConfigFromEnv(r2Env)
    if (!r2) throw new Error("SP_R2_* are not set (the dump is read from R2)")
    log(`importing ${key}`)
    const outcome = await runDataImport({ key, sourceSecret, r2 })
    if (outcome.status === "already-imported") {
      log(`${key} is already imported: nothing changed`)
    } else if (outcome.status === "restored-with-errors") {
      // Never fatal: the marker keeps the next start from restoring again,
      // and the site starts with the restored data (runbook recovery steps).
      log(
        `FAIL the data was restored, then "${outcome.step}" failed: ${outcome.error}`
      )
      log(
        `FAIL marked as restored-with-errors (no re-import on restart); follow docs/runbook.md "Import local data into production" → "If the import fails after the restore"`
      )
      log(
        `media: ${outcome.mediaMoved} file(s) now served from R2; ${outcome.mediaMissing.length} not found in R2${outcome.mediaError ? `; not moved: ${outcome.mediaError}` : ""}`
      )
    } else {
      const { report } = outcome
      log(
        `restored; target backed up first: ${report.backup} → ${report.backupLocation}`
      )
      log(
        `source R2/SMTP settings removed: ${report.integrationsRemoved.join(", ") || "none present"}; secrets re-keyed: ${report.rotate.reencrypted.join(", ") || "none"}; 2FA cleared for ${report.rotate.twoFactorCleared}`
      )
      log(
        `media: ${outcome.mediaMoved} file(s) now served from R2; ${outcome.mediaMissing.length} not found in R2 (left on disk)${outcome.mediaMissing.length ? `: ${outcome.mediaMissing.slice(0, 20).join(", ")}` : ""}`
      )
      if (outcome.mediaError)
        log(
          `warning: media rows not moved to R2: ${outcome.mediaError} (the data is imported; those rows stay disk rows)`
        )
      if (outcome.r2RowsFromSource > 0)
        log(
          `warning: ${outcome.r2RowsFromSource} media row(s) were already r2 rows in the source; they load only if those objects exist under this folder`
        )
      for (const check of report.checks)
        log(`${check.ok ? "ok  " : "FAIL"} ${check.name}: ${check.message}`)
    }
  }
} catch (err) {
  // runDataImport throws only before the restore commits.
  const restored = err instanceof SyncError && err.restored
  console.error(
    `[import] ${restored ? "FAIL after the data was restored" : "not imported (database unchanged)"}: ${message(err)}`
  )
} finally {
  await closeDb().catch(() => undefined)
  // Always 0: the start continues and the site serves whatever the
  // database holds; the log says what to do.
  process.exitCode = 0
}
