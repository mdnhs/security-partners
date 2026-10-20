import "server-only"

import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { symmetricDecrypt } from "better-auth/crypto"
import { Client } from "pg"
import { parse } from "pg-connection-string"

import {
  INTEGRATION_KEYS,
  INTEGRATIONS,
  type IntegrationKey,
} from "@/lib/schemas/integrations"
import { closeDb, getDb, pingDb } from "@/server/db/client"
import { describeDatabase } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"
import { writeAudit } from "@/server/lib/audit"
import { type BackupResult, runBackup } from "@/server/lib/backup"
import { dumpDatabase, quoteIdent } from "@/server/lib/backup/dump"
import { runPgTool, withDatabase } from "@/server/lib/backup/pg-tools"
import { type BackupStore, diskBackupStore } from "@/server/lib/backup/store"
import { decryptSecret } from "@/server/lib/crypto"
import { deleteIntegrationRows } from "@/server/modules/integrations/repo"
import {
  type RotateReport,
  rotateSecrets,
} from "@/server/modules/integrations/rotate"
import {
  readIntegrationConfig,
  secretAad,
} from "@/server/modules/integrations/service"
import { runIntegrationTest } from "@/server/modules/integrations/testers"
import { releaseAllJobClaims } from "@/server/modules/jobs/repo"
import { seedDemoUsers } from "@/server/modules/users/bootstrap"

/** Spec §14: data never copied between environments. */
export const SYNC_SKIPPED_DATA = [
  "public.sessions",
  "public.verifications",
  "public.rate_limits",
  "public.public_rate_limits",
] as const

/**
 * Integrations that act on shared outside resources (final review I2): the
 * source's R2 bucket (the target's backup job would prune the source's
 * backups, its media deletes would remove the source's files) and SMTP
 * account (the target would send mail as the source). Removed from the
 * target after the restore unless `keepIntegrations`.
 */
export const SYNC_REMOVED_INTEGRATIONS = [
  "integrations.r2",
  "integrations.smtp",
] as const satisfies readonly IntegrationKey[]

export type SyncCheck = { name: string; ok: boolean; message: string }

export type SyncOptions = {
  /** Source database URL (dumped with SYNC_SKIPPED_DATA left out)… */
  from?: string
  /**
   * …or an existing pg_dump file (custom format) instead, e.g. the
   * container-side import (server/lib/data-import.ts). Exactly one of the two.
   */
  fromDump?: string
  fromSecret: string
  /** Must equal the target database name. */
  confirm: string
  demoPassword?: string
  verifyUrl?: string
  /**
   * Keep the source's R2 and SMTP settings in the target. Dangerous: the
   * target then shares the source's bucket (backup pruning, media deletes)
   * and sends mail as the source.
   */
  keepIntegrations?: boolean
  backupStore?: BackupStore
  fetchImpl?: typeof fetch
  /**
   * Runs as soon as the restore transaction has committed, before re-keying
   * (the import records its marker here, so a later failure never leads to
   * a second restore on the next start).
   */
  onRestored?: () => Promise<void>
}

export type SyncReport = {
  /**
   * Encrypted source values `fromSecret` was proven against. 0: the source
   * holds nothing encrypted, so a wrong secret could not be detected.
   */
  sourceSecretsChecked: number
  backup: string
  backupLocation: string
  /** Integration settings removed from the target (SYNC_REMOVED_INTEGRATIONS present in the source). */
  integrationsRemoved: string[]
  rotate: RotateReport
  demoUsers: number
  checks: SyncCheck[]
  ok: boolean
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err)

async function withClient<T>(
  url: string,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    return await run(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

/**
 * Server identity + database name. `pg_control_system()` tells servers apart
 * even when their URLs differ (host aliases, proxies); null when the role may
 * not call it — the caller then falls back to comparing the URLs.
 */
async function databaseIdentity(url: string): Promise<string | null> {
  return withClient(url, async (client) => {
    const { rows } = await client.query<{ db: string }>(
      "select current_database() as db"
    )
    try {
      const system = await client.query<{ id: string }>(
        "select system_identifier::text as id from pg_control_system()"
      )
      return `${system.rows[0].id}/${rows[0].db}`
    } catch {
      return null
    }
  })
}

async function sameDatabase(a: string, b: string): Promise<boolean> {
  const [idA, idB] = await Promise.all([
    databaseIdentity(a),
    databaseIdentity(b),
  ])
  if (idA !== null && idB !== null) return idA === idB
  return describeDatabase(a) === describeDatabase(b)
}

/**
 * Proves `fromSecret` is the source's BETTER_AUTH_SECRET before anything is
 * touched: every saved integration secret and one TOTP secret (if any) must
 * decrypt with it. A wrong secret would otherwise leave the target replaced
 * by secrets nobody can read. Returns how many values were checked (0: the
 * source holds nothing encrypted, any secret works).
 */
export async function assertSourceSecret(
  from: string,
  fromSecret: string
): Promise<number> {
  const wrong = (what: string) =>
    new Error(
      `--from-secret does not decrypt ${what} in the source database: pass the source environment's BETTER_AUTH_SECRET (nothing was changed)`
    )
  return withClient(from, async (client) => {
    let checked = 0
    const { rows: tables } = await client.query<{
      settings: string | null
      twoFactors: string | null
    }>(
      `select to_regclass('public.settings')::text as "settings", to_regclass('public.two_factors')::text as "twoFactors"`
    )
    if (tables[0].settings) {
      const { rows } = await client.query<{ key: string; draft: unknown }>(
        "select key, draft from settings where key = any($1)",
        [[...INTEGRATION_KEYS]]
      )
      for (const row of rows) {
        const key = row.key as IntegrationKey
        const draft = (row.draft ?? {}) as Record<string, unknown>
        for (const field of INTEGRATIONS[key].secrets) {
          const value = draft[field]
          if (typeof value !== "string" || value === "") continue
          try {
            decryptSecret(value, secretAad(key, field), fromSecret)
          } catch (err) {
            if (message(err).startsWith("Secret must be at least"))
              throw new Error(`--from-secret: ${message(err)}`)
            throw wrong(`${key}.${field}`)
          }
          checked++
        }
      }
    }
    if (tables[0].twoFactors) {
      const { rows } = await client.query<{ secret: string }>(
        "select secret from two_factors limit 1"
      )
      if (rows[0]) {
        try {
          // Better Auth encrypts TOTP secrets with the plain auth secret.
          await symmetricDecrypt({ key: fromSecret, data: rows[0].secret })
        } catch {
          throw wrong("the two-factor secrets")
        }
        checked++
      }
    }
    return checked
  })
}

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

/** Deletes SYNC_REMOVED_INTEGRATIONS rows (draft and published) in the target; audited per key. */
async function removeSharedIntegrations(): Promise<string[]> {
  return getDb().transaction(async (tx) => {
    const keys = await deleteIntegrationRows(tx, SYNC_REMOVED_INTEGRATIONS)
    for (const key of keys)
      await writeAudit(tx, null, {
        action: "integration.deleted",
        entityType: "integration",
        entityId: key,
        diff: { via: "db:sync" },
      })
    return keys
  })
}

/**
 * A db:sync failure. `restored`: the source data was committed into the
 * target before the failure (re-keying or later steps did not finish);
 * false: the target is unchanged.
 */
export class SyncError extends Error {
  /** The step that failed ("restore", "re-key secrets", …). */
  readonly step: string
  constructor(
    message: string,
    readonly restored: boolean,
    options?: ErrorOptions & { step?: string }
  ) {
    super(message, options)
    this.name = "SyncError"
    this.step = options?.step ?? (restored ? "after restore" : "restore")
  }
}

/** Scratch database for checking a dump file's secret (same server as the target). */
export const DUMP_CHECK_SUFFIX = "_import_check"

/**
 * assertSourceSecret for a dump file: restores it into a scratch database on
 * the target's server, checks the secret there, and drops the scratch
 * database. Needs CREATE DATABASE (the compose `sp` role has it).
 */
export async function assertDumpSecret(
  targetUrl: string,
  file: string,
  fromSecret: string
): Promise<number> {
  const scratch = `${parse(targetUrl).database ?? ""}${DUMP_CHECK_SUFFIX}`
  if (!/^[a-z0-9_]{1,63}$/.test(scratch))
    throw new Error(`Cannot derive a scratch database name (${scratch})`)
  const scratchUrl = withDatabase(targetUrl, scratch)
  const drop = () =>
    withClient(targetUrl, (c) =>
      c.query(`drop database if exists ${quoteIdent(scratch)} with (force)`)
    )
  await drop()
  await withClient(targetUrl, (c) =>
    c.query(`create database ${quoteIdent(scratch)}`)
  )
  try {
    await runPgTool(
      "pg_restore",
      [
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        "--single-transaction",
        `--dbname=${scratch}`,
        file,
      ],
      scratchUrl
    )
    return await assertSourceSecret(scratchUrl, fromSecret)
  } finally {
    await drop().catch(() => undefined)
  }
}

const backupPath = (backup: BackupResult) =>
  backup.location.endsWith("/")
    ? `${backup.location}${backup.name}`
    : `${backup.location}/${backup.name}`

/**
 * Spec §14 db:sync: copies the source database into the target (this
 * process's DATABASE_URL / BETTER_AUTH_SECRET). Before anything changes, the
 * source secret is checked against the source's encrypted data and the
 * target is backed up. The restore is one transaction (a failed restore
 * leaves the target as it was); re-keying, demo users and checks run after it
 * commits, so a failure from the restore on names the pre-sync backup.
 */
export async function dbSync(opts: SyncOptions): Promise<SyncReport> {
  const target = getEnv().DATABASE_URL
  const targetName = parse(target).database ?? ""
  if (opts.confirm !== targetName)
    throw new Error(
      `--confirm must be the target database name (${targetName}): db:sync replaces everything in it`
    )
  const { from, fromDump } = opts
  if ((from === undefined) === (fromDump === undefined))
    throw new Error("Pass exactly one source: a database URL or a dump file")
  if (from !== undefined && (await sameDatabase(from, target)))
    throw new Error("Source and target are the same database")
  const sourceSecretsChecked =
    from !== undefined
      ? await assertSourceSecret(from, opts.fromSecret)
      : await assertDumpSecret(target, fromDump!, opts.fromSecret)

  const backup = await runBackup({
    url: target,
    store: opts.backupStore ?? diskBackupStore(),
  })
  let restored = false
  let step = "restore"
  try {
    const dir = await mkdtemp(join(tmpdir(), "sp-sync-"))
    try {
      let file = fromDump ?? ""
      if (from !== undefined) {
        file = join(dir, "source.dump")
        await dumpDatabase(from, file, {
          excludeTableData: SYNC_SKIPPED_DATA,
        })
      }
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
      restored = true
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
    step = "after-restore hook"
    await opts.onRestored?.()
    // A dump file may come from anywhere (SYNC_SKIPPED_DATA not left out):
    // sessions and single-use links of the source never carry over.
    step = "clear sessions and links"
    if (fromDump !== undefined) await clearSkippedData()

    step = "remove source R2/SMTP settings"
    const integrationsRemoved = opts.keepIntegrations
      ? []
      : await removeSharedIntegrations()
    // The source was dumped mid-tick: its claims belong to no worker here.
    step = "release job claims"
    await releaseAllJobClaims(getDb())
    step = "re-key secrets"
    const rotate = await rotateSecrets({
      fromSecret: opts.fromSecret,
      via: "db:sync",
    })
    step = "demo users"
    const demoUsers = opts.demoPassword
      ? (await seedDemoUsers(opts.demoPassword)).length
      : 0
    step = "checks"
    const checks = await verifyTarget(opts)
    return {
      sourceSecretsChecked,
      backup: backup.name,
      backupLocation: backup.location,
      integrationsRemoved,
      rotate,
      demoUsers,
      checks,
      ok: checks.every((check) => check.ok),
    }
  } catch (err) {
    throw new SyncError(
      `${message(err)}\nThe target was backed up before the sync: ${backupPath(backup)} (restore steps: docs/runbook.md "db:sync")`,
      restored,
      { cause: err, step }
    )
  }
}

/** Empties SYNC_SKIPPED_DATA tables that exist in the target. */
async function clearSkippedData(): Promise<void> {
  await withClient(getEnv().DATABASE_URL, async (client) => {
    for (const table of SYNC_SKIPPED_DATA) {
      const [schema, name] = table.split(".")
      const { rows } = await client.query<{ t: string | null }>(
        "select to_regclass($1)::text as t",
        [table]
      )
      if (rows[0].t)
        await client.query(
          `delete from ${quoteIdent(schema)}.${quoteIdent(name)}`
        )
    }
  })
}
