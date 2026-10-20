import "server-only"

import { spawn } from "node:child_process"
import { createWriteStream } from "node:fs"
import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import { pipeline } from "node:stream/promises"

import { PutObjectCommand, type S3Client } from "@aws-sdk/client-s3"
import { Client } from "pg"
import { parse } from "pg-connection-string"

import type { R2Config } from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import { dumpDatabase } from "@/server/lib/backup/dump"
import { importDumpKey } from "@/server/lib/data-import"
import { SYNC_SKIPPED_DATA } from "@/server/lib/db-sync"
import { createR2Client, r2ObjectKey } from "@/server/lib/r2-client"
import {
  diskStorage,
  isValidKey,
  type StorageDriver,
} from "@/server/lib/storage"
import { r2Storage } from "@/server/lib/storage/r2"
import { listDiskMediaBatch } from "@/server/modules/media/repo"

/** pg_dump flags shared with db:sync (server/lib/backup/dump.ts): custom format, no owner/privileges, SYNC_SKIPPED_DATA left out. */
export const EXPORT_DUMP_ARGS = [
  "--format=custom",
  "--no-owner",
  "--no-privileges",
  ...SYNC_SKIPPED_DATA.map((table) => `--exclude-table-data=${table}`),
] as const

/** "20261020T090000Z" (UTC). */
export function exportStamp(now: Date): string {
  return now
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "")
}

/** Major version of the pg_dump on PATH; null when there is none. */
export function localPgDumpMajor(): Promise<number | null> {
  return new Promise((resolvePromise) => {
    const child = spawn("pg_dump", ["--version"], {
      stdio: ["ignore", "pipe", "ignore"],
    })
    let out = ""
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => (out += chunk))
    child.on("error", () => resolvePromise(null))
    child.on("close", () => {
      const major = out.match(/\s(\d+)(?:\.\d+)*/)?.[1]
      resolvePromise(major ? Number(major) : null)
    })
  })
}

async function run(
  command: string,
  args: readonly string[],
  stdoutFile?: string
): Promise<string> {
  const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
  let out = ""
  let err = ""
  const written = stdoutFile
    ? pipeline(child.stdout, createWriteStream(stdoutFile, { mode: 0o600 }))
    : Promise.resolve()
  if (!stdoutFile) {
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (c: string) => (out += c))
  }
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (c: string) => (err = (err + c).slice(-2000)))
  const exited = new Promise<number | null>((resolvePromise, reject) => {
    child.on("error", reject)
    child.on("close", resolvePromise)
  })
  const [code] = await Promise.all([exited, written])
  if (code !== 0)
    throw new Error(
      `${command} exited with code ${code}: ${err.trim().slice(-500)}`
    )
  return out
}

async function serverIdentity(url: string): Promise<string> {
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  })
  await client.connect()
  try {
    const { rows } = await client.query<{ id: string }>(
      "select system_identifier::text as id from pg_control_system()"
    )
    return rows[0].id
  } finally {
    await client.end().catch(() => undefined)
  }
}

/**
 * Dumps `url` into `file` with the production image's major version (17):
 * the local pg_dump when it is 17, else pg_dump inside the local Postgres
 * container (a newer pg_dump writes archives pg_restore 17 cannot read).
 * The container is checked to be the server `url` points at.
 */
export async function dumpForProduction(
  url: string,
  file: string,
  opts: { container: string; log?: (line: string) => void }
): Promise<"local" | "container"> {
  if ((await localPgDumpMajor()) === 17) {
    await dumpDatabase(url, file, { excludeTableData: SYNC_SKIPPED_DATA })
    return "local"
  }
  const { user, database } = parse(url)
  if (!user || !database)
    throw new Error("DATABASE_URL must name the user and the database")
  const inContainer = (
    await run("docker", [
      "exec",
      opts.container,
      "psql",
      "-U",
      user,
      "-d",
      database,
      "-tAc",
      "select system_identifier::text from pg_control_system()",
    ])
  ).trim()
  if (inContainer !== (await serverIdentity(url)))
    throw new Error(
      `container ${opts.container} is not the server DATABASE_URL points at (pass --pg-container)`
    )
  opts.log?.(
    `local pg_dump is not version 17: dumping with pg_dump inside ${opts.container}`
  )
  await run(
    "docker",
    [
      "exec",
      opts.container,
      "pg_dump",
      ...EXPORT_DUMP_ARGS,
      "-U",
      user,
      "-d",
      database,
    ],
    file
  )
  return "container"
}

export type UploadPlan = {
  key: string
  mime: string
  /** Object key in R2 (what the R2 driver writes for this key). */
  objectKey: string
  bytes: number | null
  /** A file under the uploads dir that no media row points at (uploaded too, harmless). */
  orphan?: true
}

const MIME_BY_EXTENSION: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  json: "video/lottie+json",
  lottie: "application/zip+dotlottie",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
}

/** Relative keys of the regular files under `root` (temp files skipped). */
async function filesUnder(root: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(root, { recursive: true, withFileTypes: true })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return []
    throw err
  }
  return entries
    .filter((e) => e.isFile() && !e.name.endsWith(".tmp"))
    .map((e) => relative(root, join(e.parentPath, e.name)).split(sep).join("/"))
    .filter(isValidKey)
    .sort()
}

/**
 * Every upload to copy: disk media rows (flagged when their file is missing)
 * and any other file under the uploads dir (`orphan`).
 */
export async function planUploads(
  r2: Pick<R2Config, "keyPrefix">,
  uploadsRoot: string,
  disk: StorageDriver = diskStorage(uploadsRoot)
): Promise<UploadPlan[]> {
  const rows = await listDiskMediaBatch(getDb(), {
    limit: 1_000_000,
    excludeIds: [],
  })
  const plans: UploadPlan[] = []
  const known = new Set<string>()
  for (const row of rows) {
    known.add(row.key)
    const bytes = await disk.read(row.key)
    plans.push({
      key: row.key,
      mime: row.mime,
      objectKey: r2ObjectKey(r2, row.key),
      bytes: bytes ? bytes.byteLength : null,
    })
  }
  for (const key of await filesUnder(uploadsRoot)) {
    if (known.has(key)) continue
    const bytes = await disk.read(key)
    if (!bytes) continue
    const extension = key.split(".").pop()?.toLowerCase() ?? ""
    plans.push({
      key,
      mime: MIME_BY_EXTENSION[extension] ?? "application/octet-stream",
      objectKey: r2ObjectKey(r2, key),
      bytes: bytes.byteLength,
      orphan: true,
    })
  }
  return plans
}

/**
 * Uploads every planned file through the R2 driver (same object keys as
 * the site's own uploads) and the dump to "<folder>/bootstrap/<stamp>.dump".
 * Returns the dump's object key (SP_IMPORT_KEY).
 */
export async function uploadExport(opts: {
  r2: R2Config
  uploadsRoot: string
  plans: UploadPlan[]
  dumpFile: string
  stamp: string
  client?: S3Client
  log?: (line: string) => void
}): Promise<string> {
  const client = opts.client ?? createR2Client(opts.r2)
  const driver = r2Storage(opts.r2, client)
  const disk = diskStorage(opts.uploadsRoot)
  for (const plan of opts.plans) {
    const bytes = await disk.read(plan.key)
    if (!bytes) continue
    await driver.put(plan.key, bytes, plan.mime)
    opts.log?.(`uploaded ${plan.objectKey} (${bytes.byteLength} bytes)`)
  }
  const key = importDumpKey(opts.r2, opts.stamp)
  const body = await readFile(opts.dumpFile)
  await client.send(
    new PutObjectCommand({
      Bucket: opts.r2.bucket,
      Key: key,
      Body: body,
      ContentLength: (await stat(opts.dumpFile)).size,
      ContentType: "application/octet-stream",
    })
  )
  return key
}
