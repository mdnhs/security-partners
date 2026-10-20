import "server-only"

import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  GetObjectCommand,
  HeadObjectCommand,
  type S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3"
import { parse } from "pg-connection-string"

import type { R2Config } from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import { getEnv } from "@/server/env"
import type { BackupStore } from "@/server/lib/backup/store"
import { dbSync, SyncError, type SyncReport } from "@/server/lib/db-sync"
import { createR2Client, r2Failure, r2ObjectKey } from "@/server/lib/r2-client"
import {
  countMediaByDriver,
  listDiskMediaBatch,
  markMovedToR2,
} from "@/server/modules/media/repo"
import {
  findSettingsRow,
  upsertSettingsDraft,
} from "@/server/modules/settings/repo"

/**
 * Settings row recording the last imported object key. Written after the
 * restore (the restore replaces the settings table), so a database holds
 * the key of the import that produced it; the same key is never imported
 * twice.
 */
export const IMPORT_MARKER_KEY = "ops.data-import"

/** Folder (under the R2 folder) where `pnpm data:export-to-r2` puts dumps. */
export const IMPORT_DUMP_FOLDER = "bootstrap"

/** "<folder>/bootstrap/<UTC stamp>.dump" for this R2 config. */
export function importDumpKey(
  r2: Pick<R2Config, "keyPrefix">,
  stamp: string
): string {
  return r2ObjectKey(r2, `${IMPORT_DUMP_FOLDER}/${stamp}.dump`)
}

/** Validates SP_IMPORT_KEY: a dump under this config's "<folder>/bootstrap/". */
export function checkImportKey(
  r2: Pick<R2Config, "keyPrefix">,
  key: string
): string {
  const folder = r2ObjectKey(r2, `${IMPORT_DUMP_FOLDER}/`)
  const stamp = key.startsWith(folder) ? key.slice(folder.length) : ""
  if (!/^\d{8}T\d{6}Z\.dump$/.test(stamp))
    throw new Error(
      `SP_IMPORT_KEY must be ${folder}<YYYYMMDDTHHMMSSZ>.dump (as printed by pnpm data:export-to-r2)`
    )
  return key
}

export async function importedKey(): Promise<string | null> {
  const row = await findSettingsRow(getDb(), IMPORT_MARKER_KEY)
  const key = (row?.draft as { key?: unknown } | undefined)?.key
  return typeof key === "string" ? key : null
}

async function writeMarker(key: string): Promise<void> {
  await upsertSettingsDraft(getDb(), IMPORT_MARKER_KEY, {
    key,
    importedAt: new Date().toISOString(),
  })
}

/** Every disk media row (a one-shot import: no batching needed). */
const ALL_ROWS = 1_000_000

const isNotFound = (err: unknown) =>
  err instanceof S3ServiceException &&
  (err.name === "NotFound" ||
    err.name === "NoSuchKey" ||
    err.$metadata.httpStatusCode === 404)

/**
 * Disk media rows whose file is in R2 (uploaded by the export under the same
 * key the R2 driver uses) become r2 rows, so their images load from R2. A
 * row whose object is missing stays a disk row and is reported.
 */
export async function adoptDiskMediaInR2(
  r2: R2Config,
  client: S3Client
): Promise<{ moved: number; missing: string[] }> {
  const db = getDb()
  const rows = await listDiskMediaBatch(db, { limit: ALL_ROWS, excludeIds: [] })
  let moved = 0
  const missing: string[] = []
  for (const row of rows) {
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: r2.bucket,
          Key: r2ObjectKey(r2, row.key),
        })
      )
    } catch (err) {
      if (!isNotFound(err)) throw r2Failure(err)
      missing.push(row.key)
      continue
    }
    if (await markMovedToR2(db, row.id, row.key)) moved++
  }
  return { moved, missing }
}

export type ImportOutcome =
  | { status: "already-imported" }
  | {
      status: "imported"
      report: SyncReport
      mediaMoved: number
      mediaMissing: string[]
      /** Moving disk rows to R2 stopped (R2 unreachable); some rows stay disk rows. */
      mediaError?: string
      r2RowsFromSource: number
    }

export type ImportOptions = {
  /** SP_IMPORT_KEY: the dump's object key. */
  key: string
  /** SP_IMPORT_SOURCE_SECRET: BETTER_AUTH_SECRET of the exported database. */
  sourceSecret: string
  /** R2 settings from SP_R2_* (the database's own are replaced by the import). */
  r2: R2Config
  client?: S3Client
  backupStore?: BackupStore
}

/**
 * One-shot import of a `pnpm data:export-to-r2` dump into this database
 * (docs/runbook.md "Import local data into production"): download it from
 * R2, then db:sync from the file — secret checked in a scratch database
 * first, target backed up, restored in one transaction, the source's R2 and
 * SMTP settings removed, secrets re-keyed (2FA cleared, sessions ended). Demo
 * users stay as they were in the source. Then disk media rows whose files the
 * export uploaded become r2 rows, and the key is recorded.
 * Errors are SyncError (restored says whether the data was committed) or
 * plain errors from before the restore (database unchanged).
 */
export async function runDataImport(
  opts: ImportOptions
): Promise<ImportOutcome> {
  const key = checkImportKey(opts.r2, opts.key)
  if ((await importedKey()) === key) return { status: "already-imported" }
  const client = opts.client ?? createR2Client(opts.r2)
  const dir = await mkdtemp(join(tmpdir(), "sp-import-"))
  try {
    const file = join(dir, "import.dump")
    let object
    try {
      object = await client.send(
        new GetObjectCommand({ Bucket: opts.r2.bucket, Key: key })
      )
    } catch (err) {
      throw isNotFound(err)
        ? new Error(`${key} is not in the R2 bucket`)
        : r2Failure(err)
    }
    if (!object.Body) throw new Error(`${key} is empty`)
    await writeFile(file, await object.Body.transformToByteArray(), {
      mode: 0o600,
    })
    const report = await dbSync({
      fromDump: file,
      fromSecret: opts.sourceSecret,
      confirm: parse(getEnv().DATABASE_URL).database ?? "",
      keepIntegrations: false,
      backupStore: opts.backupStore,
    })
    // From here the data is restored and re-keyed: record it first, so a
    // failure below never causes a second import over later edits.
    try {
      await writeMarker(key)
    } catch (err) {
      throw new SyncError(
        `could not record the import: ${err instanceof Error ? err.message : String(err)}`,
        true,
        { cause: err }
      )
    }
    const r2RowsFromSource = await countMediaByDriver(getDb(), "r2")
    // Not fatal: the data is consistent; rows left on disk are reported.
    let adopted: { moved: number; missing: string[] } = {
      moved: 0,
      missing: [],
    }
    let mediaError: string | undefined
    try {
      adopted = await adoptDiskMediaInR2(opts.r2, client)
    } catch (err) {
      mediaError = err instanceof Error ? err.message : String(err)
    }
    return {
      status: "imported",
      report,
      mediaMoved: adopted.moved,
      mediaMissing: adopted.missing,
      mediaError,
      r2RowsFromSource,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
