import "server-only"

import { createHash } from "node:crypto"
import { readFile, stat } from "node:fs/promises"
import { basename } from "node:path"

import { Client } from "pg"
import { parse } from "pg-connection-string"

import { runPgTool } from "./pg-tools"

/** App tables and Drizzle's migration bookkeeping. */
export const DUMPED_SCHEMAS = ["public", "drizzle"] as const

export type BackupManifest = {
  version: 1
  createdAt: string
  database: string
  file: string
  bytes: number
  sha256: string
  /** "schema.table" → rows in the dump (0 for tables whose data is excluded). */
  counts: Record<string, number>
  excludedData: string[]
}

export const quoteIdent = (name: string) => `"${name.replaceAll('"', '""')}"`

/** Rows per table of DUMPED_SCHEMAS, read in the client's current transaction (if any). */
export async function countRows(
  client: Client
): Promise<Record<string, number>> {
  const { rows } = await client.query<{
    schemaname: string
    tablename: string
  }>(
    "select schemaname, tablename from pg_tables where schemaname = any($1) order by 1, 2",
    [[...DUMPED_SCHEMAS]]
  )
  const counts: Record<string, number> = {}
  for (const { schemaname, tablename } of rows) {
    const result = await client.query<{ n: number }>(
      `select count(*)::int as n from ${quoteIdent(schemaname)}.${quoteIdent(tablename)}`
    )
    counts[`${schemaname}.${tablename}`] = result.rows[0].n
  }
  return counts
}

/**
 * pg_dump (custom format) of `url` into `file`. A REPEATABLE READ snapshot is
 * exported and handed to pg_dump, and the row counts are read in that same
 * snapshot, so the manifest describes exactly what the dump contains.
 */
export async function dumpDatabase(
  url: string,
  file: string,
  opts: { excludeTableData?: readonly string[]; now?: Date } = {}
): Promise<BackupManifest> {
  const excluded = [...(opts.excludeTableData ?? [])]
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    await client.query("begin isolation level repeatable read read only")
    const snapshot = await client.query<{ id: string }>(
      "select pg_export_snapshot() as id"
    )
    const counts = await countRows(client)
    for (const table of excluded) if (table in counts) counts[table] = 0
    await runPgTool(
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        `--snapshot=${snapshot.rows[0].id}`,
        ...excluded.map((table) => `--exclude-table-data=${table}`),
        `--file=${file}`,
      ],
      url
    )
    await client.query("commit")
    const bytes = (await stat(file)).size
    const sha256 = createHash("sha256")
      .update(await readFile(file))
      .digest("hex")
    return {
      version: 1,
      createdAt: (opts.now ?? new Date()).toISOString(),
      database: parse(url).database ?? "",
      file: basename(file),
      bytes,
      sha256,
      counts,
      excludedData: excluded,
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}
