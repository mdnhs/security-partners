import "server-only"

import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parse } from "pg-connection-string"

import { getEnv } from "@/server/env"

import { type BackupManifest, dumpDatabase } from "./dump"
import {
  BACKUPS_KEPT,
  type BackupStore,
  getBackupStore,
  pruneBackups,
  safeDatabaseName,
} from "./store"

/**
 * Ephemeral counters (not worth restoring) and pending verifications: their
 * identifiers are live single-use links in plain text ("reset-password:
 * <token>" for invites and recovery), redeemable by anyone who reads a dump
 * (final review M2). After a restore, pending invites/links are re-sent.
 */
export const BACKUP_SKIPPED_DATA = [
  "public.rate_limits",
  "public.public_rate_limits",
  "public.verifications",
] as const

/** "sp-<db>-20261016T120000Z" (UTC, sortable). */
export function backupBaseName(database: string, now: Date): string {
  const safe = safeDatabaseName(database)
  const stamp = now
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "")
  return `sp-${safe}-${stamp}`
}

export type BackupResult = {
  name: string
  store: "disk" | "r2"
  location: string
  bytes: number
  pruned: string[]
  manifest: BackupManifest
}

/** Spec §14: dump → manifest → store (R2 or /data/backups) → keep the newest 14. */
export async function runBackup(
  opts: { url?: string; store?: BackupStore; now?: Date; keep?: number } = {}
): Promise<BackupResult> {
  const url = opts.url ?? getEnv().DATABASE_URL
  const now = opts.now ?? new Date()
  const store = opts.store ?? (await getBackupStore())
  const dir = await mkdtemp(join(tmpdir(), "sp-backup-"))
  try {
    const database = parse(url).database ?? "db"
    const base = backupBaseName(database, now)
    const dumpFile = join(dir, `${base}.dump`)
    const manifest = await dumpDatabase(url, dumpFile, {
      excludeTableData: BACKUP_SKIPPED_DATA,
      now,
    })
    const manifestFile = join(dir, `${base}.json`)
    await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`)
    await store.put(`${base}.dump`, dumpFile)
    await store.put(`${base}.json`, manifestFile)
    const pruned = await pruneBackups(
      store,
      opts.keep ?? BACKUPS_KEPT,
      database
    )
    return {
      name: `${base}.dump`,
      store: store.kind,
      location: store.location,
      bytes: manifest.bytes,
      pruned,
      manifest,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
