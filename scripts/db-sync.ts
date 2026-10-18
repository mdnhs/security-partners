// Copies one environment's database into another (spec §14), e.g. production
// → staging. Run with the TARGET's env (DATABASE_URL, BETTER_AUTH_SECRET,
// BETTER_AUTH_URL) while the target app is stopped — docs/runbook.md "db:sync".
//   pnpm db:sync --from <source url> --from-secret <source secret> --confirm <target db name>
//     [--to <target url>] [--to-secret <target secret>]
//     [--demo-password <12+ chars>] [--verify-url https://staging.example.ie]
//     [--keep-integrations]
// The source's R2 and SMTP settings are removed from the target (audited)
// unless --keep-integrations: kept, the target would share the source's
// bucket (its backup job prunes the source's backups, its media deletes
// remove the source's files) and send mail as the source.
// The target is backed up first (/data/backups or .data/backups).
// To keep the source URL/secret out of shell history, they may instead come
// from the input-only variables SOURCE_DATABASE_URL / SOURCE_BETTER_AUTH_SECRET
// (read by this script only, never by the app; flags win when both are set).
import { parseArgs } from "node:util"

import { dbSync } from "@/server/lib/db-sync"

import { runScript } from "./lib/run-script"

const USAGE =
  "Usage: db:sync --from <url> --from-secret <secret> --confirm <target database name> [--to <url>] [--to-secret <secret>] [--demo-password <pw>] [--verify-url <origin>] [--keep-integrations] (--from / --from-secret may come from SOURCE_DATABASE_URL / SOURCE_BETTER_AUTH_SECRET)"

let values: Partial<
  Record<
    | "from"
    | "to"
    | "from-secret"
    | "to-secret"
    | "confirm"
    | "demo-password"
    | "verify-url",
    string
  >
> & { "keep-integrations"?: boolean }
try {
  ;({ values } = parseArgs({
    options: {
      from: { type: "string" },
      to: { type: "string" },
      "from-secret": { type: "string" },
      "to-secret": { type: "string" },
      confirm: { type: "string" },
      "demo-password": { type: "string" },
      "verify-url": { type: "string" },
      "keep-integrations": { type: "boolean" },
    },
  }))
} catch (err) {
  console.error(
    `[db:sync] ${err instanceof Error ? err.message : err}\n${USAGE}`
  )
  process.exit(1)
}
// --to / --to-secret override the target env before it is validated.
if (values.to) process.env.DATABASE_URL = values.to
if (values["to-secret"]) process.env.BETTER_AUTH_SECRET = values["to-secret"]

// Read the input-only source variables once, then drop them: pg_dump /
// pg_restore and every other child process inherit process.env.
const from = values.from || process.env.SOURCE_DATABASE_URL
const fromSecret =
  values["from-secret"] || process.env.SOURCE_BETTER_AUTH_SECRET
delete process.env.SOURCE_DATABASE_URL
delete process.env.SOURCE_BETTER_AUTH_SECRET

await runScript("db:sync", async () => {
  const confirm = values.confirm
  if (!from || !fromSecret || !confirm) throw new Error(USAGE)
  const report = await dbSync({
    from,
    fromSecret,
    confirm,
    demoPassword: values["demo-password"],
    verifyUrl: values["verify-url"],
    keepIntegrations: values["keep-integrations"] === true,
  })
  if (report.sourceSecretsChecked === 0)
    console.log(
      "[db:sync] notice: the source holds no encrypted secrets, so --from-secret could not be verified (nothing to re-key)"
    )
  console.log(
    `[db:sync] target backed up: ${report.backup} → ${report.backupLocation}`
  )
  console.log(
    values["keep-integrations"]
      ? "[db:sync] --keep-integrations: the target uses the source's R2 bucket and SMTP account (if the source has them)"
      : `[db:sync] source R2/SMTP settings removed from the target: ${report.integrationsRemoved.join(", ") || "none present"} — set the target's own in Settings › Integrations`
  )
  console.log(
    `[db:sync] secrets re-keyed: ${report.rotate.reencrypted.join(", ") || "none"}; 2FA cleared for ${report.rotate.twoFactorCleared}; demo accounts reset: ${report.demoUsers}`
  )
  for (const check of report.checks)
    console.log(
      `[db:sync] ${check.ok ? "ok  " : "FAIL"} ${check.name}: ${check.message}`
    )
  if (!report.ok)
    throw new Error("finished, but some checks failed (see FAIL lines above)")
})
