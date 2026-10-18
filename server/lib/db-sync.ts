import "server-only"

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { parse } from "pg-connection-string"

import { INTEGRATION_KEYS } from "@/lib/schemas/integrations"
import { closeDb, pingDb } from "@/server/db/client"
import { describeDatabase } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"
import { runBackup } from "@/server/lib/backup"
import { dumpDatabase } from "@/server/lib/backup/dump"
import { runPgTool } from "@/server/lib/backup/pg-tools"
import { type BackupStore, diskBackupStore } from "@/server/lib/backup/store"
import {
  type RotateReport,
  rotateSecrets,
} from "@/server/modules/integrations/rotate"
import { readIntegrationConfig } from "@/server/modules/integrations/service"
import { runIntegrationTest } from "@/server/modules/integrations/testers"
import { seedDemoUsers } from "@/server/modules/users/bootstrap"

/** Spec §14: data never copied between environments. */
export const SYNC_SKIPPED_DATA = [
  "public.sessions",
  "public.verifications",
  "public.rate_limits",
  "public.public_rate_limits",
] as const

export type SyncCheck = { name: string; ok: boolean; message: string }

export type SyncOptions = {
  from: string
  fromSecret: string
  /** Must equal the target database name. */
  confirm: string
  demoPassword?: string
  verifyUrl?: string
  backupStore?: BackupStore
  fetchImpl?: typeof fetch
}

export type SyncReport = {
  backup: string
  backupLocation: string
  rotate: RotateReport
  demoUsers: number
  checks: SyncCheck[]
  ok: boolean
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

async function verifyTarget(opts: SyncOptions): Promise<SyncCheck[]> {
  const checks: SyncCheck[] = [
    {
      name: "database",
      ok: await pingDb(),
      message: "the target answers select 1",
    },
  ]
  for (const key of INTEGRATION_KEYS) {
    try {
      const config = await readIntegrationConfig(key)
      checks.push({
        name: key,
        ok: true,
        message: config
          ? "secrets decrypt with the target key"
          : "not configured",
      })
    } catch (err) {
      checks.push({ name: key, ok: false, message: message(err) })
    }
  }
  try {
    const ai = await readIntegrationConfig("integrations.ai")
    if (ai?.enabled) {
      const result = await runIntegrationTest("integrations.ai", ai, {
        fetch: opts.fetchImpl,
      })
      checks.push({
        name: "ai test-connection",
        ok: result.ok,
        message: result.message,
      })
    }
  } catch {
    // Reported by the integrations.ai check above.
  }
  if (opts.verifyUrl) {
    try {
      const res = await (opts.fetchImpl ?? fetch)(
        new URL("/api/v1/health", opts.verifyUrl)
      )
      checks.push({
        name: "health",
        ok: res.status === 200,
        message: `GET /api/v1/health → ${res.status}`,
      })
    } catch (err) {
      checks.push({ name: "health", ok: false, message: message(err) })
    }
  }
  return checks
}

/**
 * Spec §14 db:sync: copies the source database into the target (this
 * process's DATABASE_URL / BETTER_AUTH_SECRET). Backs the target up first and
 * restores in a single transaction, so a failure leaves the target as it was.
 */
export async function dbSync(opts: SyncOptions): Promise<SyncReport> {
  const target = getEnv().DATABASE_URL
  const targetName = parse(target).database ?? ""
  if (opts.confirm !== targetName)
    throw new Error(
      `--confirm must be the target database name (${targetName}): db:sync replaces everything in it`
    )
  if (describeDatabase(opts.from) === describeDatabase(target))
    throw new Error("Source and target are the same database")

  const backup = await runBackup({
    url: target,
    store: opts.backupStore ?? diskBackupStore(),
  })
  const dir = await mkdtemp(join(tmpdir(), "sp-sync-"))
  try {
    const file = join(dir, "source.dump")
    await dumpDatabase(opts.from, file, {
      excludeTableData: SYNC_SKIPPED_DATA,
    })
    // Nothing of ours may hold target connections during the restore.
    await closeDb()
    await runPgTool(
      "pg_restore",
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--single-transaction",
        "--exit-on-error",
        `--dbname=${targetName}`,
        file,
      ],
      target
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }

  const rotate = await rotateSecrets({
    fromSecret: opts.fromSecret,
    via: "db:sync",
  })
  const demoUsers = opts.demoPassword
    ? (await seedDemoUsers(opts.demoPassword)).length
    : 0
  const checks = await verifyTarget(opts)
  return {
    backup: backup.name,
    backupLocation: backup.location,
    rotate,
    demoUsers,
    checks,
    ok: checks.every((check) => check.ok),
  }
}
