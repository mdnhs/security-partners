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
import { closeDb, pingDb } from "@/server/db/client"
import { describeDatabase } from "@/server/db/seed/guard"
import { getEnv } from "@/server/env"
import { type BackupResult, runBackup } from "@/server/lib/backup"
import { dumpDatabase } from "@/server/lib/backup/dump"
import { runPgTool } from "@/server/lib/backup/pg-tools"
import { type BackupStore, diskBackupStore } from "@/server/lib/backup/store"
import { decryptSecret } from "@/server/lib/crypto"
import {
  type RotateReport,
  rotateSecrets,
} from "@/server/modules/integrations/rotate"
import {
  readIntegrationConfig,
  secretAad,
} from "@/server/modules/integrations/service"
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
  if (await sameDatabase(opts.from, target))
    throw new Error("Source and target are the same database")
  await assertSourceSecret(opts.from, opts.fromSecret)

  const backup = await runBackup({
    url: target,
    store: opts.backupStore ?? diskBackupStore(),
  })
  try {
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
  } catch (err) {
    throw new Error(
      `${message(err)}\nThe target was backed up before the sync: ${backupPath(backup)} (restore steps: docs/runbook.md "db:sync")`,
      { cause: err }
    )
  }
}
