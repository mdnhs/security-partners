import "server-only"

import { existsSync } from "node:fs"
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { join, resolve } from "node:path"

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3"

import type { R2Config } from "@/lib/schemas/integrations"
import { createR2Client } from "@/server/lib/r2-client"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

/** Backups live beside media in the R2 bucket, under their own prefix. */
export const BACKUP_PREFIX = "backups/"
export const BACKUPS_KEPT = 14

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/

export type BackupObject = { name: string; bytes: number; createdAt: Date }

export type BackupStore = {
  kind: "disk" | "r2"
  /** For messages: "/data/backups" or "r2://<bucket>/backups/". */
  location: string
  put(name: string, file: string): Promise<void>
  /** Every stored file, newest first (names embed the UTC stamp). */
  list(): Promise<BackupObject[]>
  download(name: string, file: string): Promise<void>
  /** A missing file is not an error. */
  delete(name: string): Promise<void>
}

function checkName(name: string): string {
  if (!NAME.test(name) || name.includes(".."))
    throw new Error(`Invalid backup file name: ${name}`)
  return name
}

const newestFirst = (a: BackupObject, b: BackupObject) =>
  b.name.localeCompare(a.name)

/** The Docker volume when present (spec D9), else the repo's .data dir. */
export function defaultBackupsDir(): string {
  return existsSync("/data")
    ? "/data/backups"
    : resolve(process.cwd(), ".data/backups")
}

export function diskBackupStore(dir = defaultBackupsDir()): BackupStore {
  return {
    kind: "disk",
    location: dir,
    async put(name, file) {
      // Owner-only: dumps hold every row, including password hashes.
      // mkdir's mode only applies to a new dir: tighten an existing one (and
      // files written before this rule, e.g. by an older release) too.
      await mkdir(dir, { recursive: true, mode: 0o700 })
      await chmod(dir, 0o700)
      for (const existing of await readdir(dir))
        if (NAME.test(existing))
          await chmod(join(dir, existing), 0o600).catch(() => undefined)
      const final = join(dir, checkName(name))
      // A hidden temp name (never listed) + rename: a crash mid-copy never
      // leaves a truncated file under the real name.
      const temp = join(dir, `.${name}.tmp`)
      try {
        await copyFile(file, temp)
        await chmod(temp, 0o600)
        await rename(temp, final)
      } catch (err) {
        await rm(temp, { force: true })
        throw err
      }
    },
    async list() {
      if (!existsSync(dir)) return []
      const names = (await readdir(dir)).filter((name) => NAME.test(name))
      const items = await Promise.all(
        names.map(async (name) => {
          const info = await stat(join(dir, name))
          return { name, bytes: info.size, createdAt: info.mtime }
        })
      )
      return items.sort(newestFirst)
    },
    async download(name, file) {
      await copyFile(join(dir, checkName(name)), file)
    },
    async delete(name) {
      await rm(join(dir, checkName(name)), { force: true })
    },
  }
}

export function r2BackupStore(
  config: R2Config,
  client: S3Client = createR2Client(config)
): BackupStore {
  const key = (name: string) => `${BACKUP_PREFIX}${checkName(name)}`
  return {
    kind: "r2",
    location: `r2://${config.bucket}/${BACKUP_PREFIX}`,
    async put(name, file) {
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key(name),
          Body: await readFile(file),
          ContentType: name.endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
        })
      )
    },
    async list() {
      const items: BackupObject[] = []
      let token: string | undefined
      do {
        const page = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: BACKUP_PREFIX,
            ContinuationToken: token,
          })
        )
        for (const object of page.Contents ?? []) {
          const name = (object.Key ?? "").slice(BACKUP_PREFIX.length)
          if (NAME.test(name))
            items.push({
              name,
              bytes: object.Size ?? 0,
              createdAt: object.LastModified ?? new Date(0),
            })
        }
        token = page.IsTruncated ? page.NextContinuationToken : undefined
      } while (token)
      return items.sort(newestFirst)
    },
    async download(name, file) {
      const object = await client.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: key(name) })
      )
      if (!object.Body) throw new Error(`Backup ${name} is empty`)
      await writeFile(file, await object.Body.transformToByteArray())
    },
    async delete(name) {
      await client.send(
        new DeleteObjectCommand({ Bucket: config.bucket, Key: key(name) })
      )
    },
  }
}

/** R2 once Settings ▸ Integrations ▸ R2 is saved; the /data volume until then (spec D9). */
export async function getBackupStore(): Promise<BackupStore> {
  const r2 = await readIntegrationConfig("integrations.r2")
  return r2 ? r2BackupStore(r2) : diskBackupStore()
}

const manifestName = (dump: string) => dump.replace(/\.dump$/, ".json")

/** The database part of a backup name ("sp-<db>-<stamp>"). */
export function safeDatabaseName(database: string): string {
  return database.replace(/[^A-Za-z0-9_-]/g, "_") || "db"
}

const STAMP = /^(\d{8}T\d{6}Z)\.(dump|json)$/

/**
 * The UTC stamp of `name` when it is one of `database`'s backup files
 * ("sp-<db>-<stamp>.dump|json"), else null. Several databases' dumps can
 * share a store (final review I2: staging synced with production's R2), so
 * each database lists, prunes and restores only its own.
 */
export function backupStamp(name: string, database: string): string | null {
  const prefix = `sp-${safeDatabaseName(database)}-`
  if (!name.startsWith(prefix)) return null
  return STAMP.exec(name.slice(prefix.length))?.[1] ?? null
}

/** `database`'s backup files, newest first by their stamp. */
function ownBackups(
  objects: BackupObject[],
  database: string
): (BackupObject & { stamp: string })[] {
  return objects
    .flatMap((o) => {
      const stamp = backupStamp(o.name, database)
      return stamp === null ? [] : [{ ...o, stamp }]
    })
    .sort((a, b) => (a.stamp === b.stamp ? 0 : a.stamp < b.stamp ? 1 : -1))
}

/**
 * `database`'s complete backups, newest first: .dump files whose .json
 * manifest exists. The manifest is stored after the dump, so a dump without
 * one is an interrupted backup and is never restored or counted as kept.
 */
export function completeDumps(
  objects: BackupObject[],
  database: string
): BackupObject[] {
  const own = ownBackups(objects, database)
  const names = new Set(own.map((o) => o.name))
  return own.filter(
    (o) => o.name.endsWith(".dump") && names.has(manifestName(o.name))
  )
}

/**
 * Keeps `database`'s newest `keep` complete backups. Deletes its older
 * complete ones (dump + manifest) and its interrupted dumps older than the
 * oldest kept backup; other databases' files are never touched. Returns the
 * deleted .dump names.
 */
export async function pruneBackups(
  store: BackupStore,
  keep: number,
  database: string
): Promise<string[]> {
  const all = ownBackups(await store.list(), database)
  const complete = new Set(completeDumps(all, database).map((o) => o.name))
  const keptList = all.filter((o) => complete.has(o.name)).slice(0, keep)
  const oldestKept = keptList.at(-1)?.stamp
  const kept = new Set(keptList.map((o) => o.name))
  const old = all.filter(
    (o) =>
      o.name.endsWith(".dump") &&
      !kept.has(o.name) &&
      (complete.has(o.name) ||
        (oldestKept !== undefined && o.stamp < oldestKept))
  )
  for (const dump of old) {
    await store.delete(dump.name)
    await store.delete(manifestName(dump.name))
  }
  return old.map((dump) => dump.name)
}
