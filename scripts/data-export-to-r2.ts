// LOCAL operator script: exports this checkout's dev database and uploads to
// R2 for the one-shot production import (docs/runbook.md "Import local data
// into production"). Run on the developer machine, never in the container:
//   SP_R2_ACCOUNT_ID=… SP_R2_ACCESS_KEY_ID=… SP_R2_SECRET_ACCESS_KEY=… SP_R2_BUCKET=… \
//     pnpm data:export-to-r2 [--dry-run] [--uploads-dir <dir>] [--pg-container <name>]
// 1. checks BETTER_AUTH_SECRET (.env.development) decrypts the local
//    database's secrets: that value is SP_IMPORT_SOURCE_SECRET;
// 2. pg_dump (custom format, db:sync flags) with PostgreSQL 17 — the local
//    pg_dump if it is 17, else the one inside the dev Postgres container;
// 3. uploads every disk media file through the R2 driver, i.e. to
//    <SP_R2_PREFIX, default sp>/<key>, the key production's driver reads;
// 4. uploads the dump to <prefix>/bootstrap/<UTC stamp>.dump and prints
//    that key (SP_IMPORT_KEY).
// --dry-run: steps 1–2 into a temp file (deleted afterwards) and a list of
// what would be uploaded; nothing is written to R2 and SP_R2_* are optional.
// SP_R2_* are input-only variables of this script; never printed.
import { mkdtemp, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { parseArgs } from "node:util"

import { getEnv } from "@/server/env"
import {
  dumpForProduction,
  exportStamp,
  planUploads,
  uploadExport,
} from "@/server/lib/data-export"
import { importDumpKey } from "@/server/lib/data-import"
import { assertSourceSecret } from "@/server/lib/db-sync"
import {
  DEFAULT_R2_PREFIX,
  R2_PREFIX_ENV,
  r2ConfigFromEnv,
} from "@/server/lib/r2-bootstrap"
import { defaultUploadsRoot } from "@/server/lib/storage"

import { runScript } from "./lib/run-script"

const log = (line: string) => console.log(`[export] ${line}`)

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    "uploads-dir": { type: "string" },
    "pg-container": {
      type: "string",
      default: "security-partners-dev-postgres-1",
    },
  },
})
const dryRun = values["dry-run"] === true
const r2Env = { ...process.env }
for (const name of Object.keys(process.env))
  if (name.startsWith("SP_")) delete process.env[name]

await runScript("export", async () => {
  const { DATABASE_URL, BETTER_AUTH_SECRET } = getEnv()
  const r2 = r2ConfigFromEnv(r2Env)
  if (!r2 && !dryRun)
    throw new Error(
      "set SP_R2_ACCOUNT_ID, SP_R2_ACCESS_KEY_ID, SP_R2_SECRET_ACCESS_KEY and SP_R2_BUCKET (or pass --dry-run)"
    )
  const folder = {
    keyPrefix:
      r2?.keyPrefix ??
      ((r2Env[R2_PREFIX_ENV] ?? "").trim() || DEFAULT_R2_PREFIX),
  }
  const uploadsRoot = resolve(values["uploads-dir"] ?? defaultUploadsRoot())

  const checked = await assertSourceSecret(DATABASE_URL, BETTER_AUTH_SECRET)
  log(
    checked > 0
      ? `BETTER_AUTH_SECRET decrypts ${checked} stored secret(s): use it as SP_IMPORT_SOURCE_SECRET`
      : "the database holds no encrypted secrets: SP_IMPORT_SOURCE_SECRET can be this BETTER_AUTH_SECRET"
  )

  const plans = await planUploads(folder, uploadsRoot)
  const missing = plans.filter((p) => p.bytes === null)
  const stamp = exportStamp(new Date())
  const dir = await mkdtemp(join(tmpdir(), "sp-export-"))
  try {
    const dumpFile = join(dir, `${stamp}.dump`)
    const via = await dumpForProduction(DATABASE_URL, dumpFile, {
      container: values["pg-container"] ?? "",
      log,
    })
    log(
      `dumped the database (${via} pg_dump 17): ${(await stat(dumpFile)).size} bytes${dryRun ? ` at ${dumpFile} (deleted when this exits)` : ""}`
    )
    log(`uploads dir: ${uploadsRoot}`)
    for (const plan of plans)
      log(
        plan.bytes === null
          ? `missing on disk (not uploaded): ${plan.key}`
          : `${dryRun ? "would upload" : "will upload"} ${plan.objectKey} (${plan.bytes} bytes, ${plan.mime}${plan.orphan ? ", no media row" : ""})`
      )
    log(
      `${plans.length - missing.length} file(s) to upload, ${missing.length} missing on disk`
    )
    const dumpKey = importDumpKey(folder, stamp)
    if (dryRun || !r2) {
      log(`dry run: would upload the dump to ${dumpKey}; nothing was written`)
      return
    }
    const key = await uploadExport({
      r2,
      uploadsRoot,
      plans,
      dumpFile,
      stamp,
      log,
    })
    log(`dump uploaded: ${key}`)
    console.log(`SP_IMPORT_KEY=${key}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
