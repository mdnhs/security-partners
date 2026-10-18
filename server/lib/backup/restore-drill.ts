import "server-only"

import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Client } from "pg"
import { parse } from "pg-connection-string"

import { getEnv } from "@/server/env"

import { type BackupManifest, countRows, quoteIdent } from "./dump"
import { runPgTool, withDatabase } from "./pg-tools"
import { type BackupStore, getBackupStore } from "./store"

export const DRILL_SUFFIX = "_restore_drill"

export type DrillMismatch = {
  table: string
  expected: number
  /** null: the table is missing from the restored database. */
  actual: number | null
}

export type DrillResult = {
  backup: string
  scratchDatabase: string
  tables: number
  mismatches: DrillMismatch[]
  ok: boolean
}

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
 * Spec §14 restore drill: restore the newest backup into a scratch database
 * on the same server and compare every table's row count with the backup's
 * manifest. The scratch database is dropped afterwards unless keepScratch.
 */
export async function restoreDrill(
  opts: { url?: string; store?: BackupStore; keepScratch?: boolean } = {}
): Promise<DrillResult> {
  const url = opts.url ?? getEnv().DATABASE_URL
  const store = opts.store ?? (await getBackupStore())
  const latest = (await store.list()).find((o) => o.name.endsWith(".dump"))
  if (!latest) throw new Error(`No backup found in ${store.location}`)
  const scratch = `${parse(url).database ?? ""}${DRILL_SUFFIX}`
  if (!/^[a-z0-9_]{1,63}$/.test(scratch))
    throw new Error(`Cannot derive a scratch database name (${scratch})`)
  const scratchUrl = withDatabase(url, scratch)
  const dir = await mkdtemp(join(tmpdir(), "sp-drill-"))
  try {
    const manifestName = latest.name.replace(/\.dump$/, ".json")
    const dumpFile = join(dir, latest.name)
    const manifestFile = join(dir, manifestName)
    await store.download(latest.name, dumpFile)
    await store.download(manifestName, manifestFile)
    const manifest = JSON.parse(
      await readFile(manifestFile, "utf8")
    ) as BackupManifest
    const sha256 = createHash("sha256")
      .update(await readFile(dumpFile))
      .digest("hex")
    if (sha256 !== manifest.sha256)
      throw new Error(`${latest.name}: checksum does not match its manifest`)

    await withClient(url, (c) =>
      c.query(`drop database if exists ${quoteIdent(scratch)} with (force)`)
    )
    await withClient(url, (c) =>
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
          dumpFile,
        ],
        scratchUrl
      )
      const actual = await withClient(scratchUrl, countRows)
      const mismatches: DrillMismatch[] = []
      for (const [table, expected] of Object.entries(manifest.counts)) {
        const found = actual[table] ?? null
        if (found !== expected)
          mismatches.push({ table, expected, actual: found })
      }
      return {
        backup: latest.name,
        scratchDatabase: scratch,
        tables: Object.keys(manifest.counts).length,
        mismatches,
        ok: mismatches.length === 0,
      }
    } finally {
      if (!opts.keepScratch)
        await withClient(url, (c) =>
          c.query(`drop database if exists ${quoteIdent(scratch)} with (force)`)
        )
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
