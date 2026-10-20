import {
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { S3Client } from "@aws-sdk/client-s3"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { R2Config } from "@/lib/schemas/integrations"
import {
  BACKUP_PREFIX,
  completeDumps,
  diskBackupStore,
  pruneBackups,
  r2BackupStore,
} from "@/server/lib/backup/store"

let dir: string
let src: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sp-store-"))
  src = join(dir, "src.bin")
  await writeFile(src, "PGDMP-fake")
})
afterEach(() => rm(dir, { recursive: true, force: true }))

const stamp = (day: number) =>
  `sp-sp_test-202610${String(day).padStart(2, "0")}T020000Z`

describe("disk backup store", () => {
  it("puts, lists newest first, downloads and deletes", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    await store.put(`${stamp(1)}.dump`, src)
    await store.put(`${stamp(2)}.dump`, src)
    expect((await store.list()).map((o) => o.name)).toEqual([
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])
    const out = join(dir, "out.bin")
    await store.download(`${stamp(1)}.dump`, out)
    expect(await readFile(out, "utf8")).toBe("PGDMP-fake")
    await store.delete(`${stamp(1)}.dump`)
    expect((await store.list()).map((o) => o.name)).toEqual([
      `${stamp(2)}.dump`,
    ])
  })

  it("writes owner-only files and leaves no temp file behind", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    await store.put(`${stamp(1)}.dump`, src)
    expect((await stat(join(dir, "backups"))).mode & 0o777).toBe(0o700)
    expect(
      (await stat(join(dir, "backups", `${stamp(1)}.dump`))).mode & 0o777
    ).toBe(0o600)
    expect(await readdir(join(dir, "backups"))).toEqual([`${stamp(1)}.dump`])
  })

  it("tightens an existing world-readable backup dir and its files", async () => {
    const backups = join(dir, "backups")
    await mkdir(backups, { mode: 0o755 })
    await chmod(backups, 0o755)
    const old = join(backups, `${stamp(1)}.dump`)
    await writeFile(old, "PGDMP-old", { mode: 0o644 })
    await chmod(old, 0o644)
    await diskBackupStore(backups).put(`${stamp(2)}.dump`, src)
    expect((await stat(backups)).mode & 0o777).toBe(0o700)
    expect((await stat(old)).mode & 0o777).toBe(0o600)
  })

  it("ignores interrupted backups (a dump without its manifest)", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    for (let day = 1; day <= 3; day++) {
      await store.put(`${stamp(day)}.dump`, src)
      await store.put(`${stamp(day)}.json`, src)
    }
    await store.put(`${stamp(0)}.dump`, src) // old orphan
    await store.put(`${stamp(4)}.dump`, src) // newest, no manifest
    expect(
      completeDumps(await store.list(), "sp_test").map((o) => o.name)
    ).toEqual([`${stamp(3)}.dump`, `${stamp(2)}.dump`, `${stamp(1)}.dump`])
    expect(await pruneBackups(store, 2, "sp_test")).toEqual([
      `${stamp(1)}.dump`,
      `${stamp(0)}.dump`,
    ])
    expect((await store.list()).map((o) => o.name)).toEqual([
      `${stamp(4)}.dump`,
      `${stamp(3)}.json`,
      `${stamp(3)}.dump`,
      `${stamp(2)}.json`,
      `${stamp(2)}.dump`,
    ])
  })

  // Final review I2: one store can hold several databases' dumps; each
  // database prunes and restores only its own, ordered by the stamp.
  it("prunes and picks only this database's dumps", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    const other = (db: string, day: number) =>
      `sp-${db}-202610${String(day).padStart(2, "0")}T020000Z`
    const names: string[] = []
    for (let day = 1; day <= 3; day++)
      names.push(stamp(day), other("sp_test_staging", day), other("zz", day))
    names.push("sp-sp_test-oops") // not a backup name of ours
    for (const base of names) {
      await store.put(`${base}.dump`, src)
      await store.put(`${base}.json`, src)
    }
    const all = await store.list()
    expect(completeDumps(all, "sp_test").map((o) => o.name)).toEqual([
      `${stamp(3)}.dump`,
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])
    expect(await pruneBackups(store, 1, "sp_test")).toEqual([
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])
    const left = (await store.list()).map((o) => o.name)
    expect(left).toHaveLength(all.length - 4)
    for (let day = 1; day <= 3; day++) {
      expect(left).toContain(`${other("sp_test_staging", day)}.dump`)
      expect(left).toContain(`${other("zz", day)}.json`)
    }
    expect(left).toContain("sp-sp_test-oops.dump")
  })

  it("lists nothing when the directory does not exist yet", async () => {
    expect(await diskBackupStore(join(dir, "missing")).list()).toEqual([])
  })

  it("rejects names that could leave the directory", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    await expect(store.put("../escape.dump", src)).rejects.toThrow(
      "Invalid backup file name"
    )
    await expect(store.download("a/b.dump", src)).rejects.toThrow(
      "Invalid backup file name"
    )
  })

  it("keeps the newest 14 dumps and deletes older dumps with their manifests", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    for (let day = 1; day <= 16; day++) {
      await store.put(`${stamp(day)}.dump`, src)
      await store.put(`${stamp(day)}.json`, src)
    }
    expect(await pruneBackups(store, 14, "sp_test")).toEqual([
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])
    const names = (await store.list()).map((o) => o.name)
    expect(names.filter((n) => n.endsWith(".dump"))).toHaveLength(14)
    expect(names).not.toContain(`${stamp(1)}.json`)
    expect(names).toContain(`${stamp(3)}.json`)
  })
})

describe("R2 backup store", () => {
  const config = {
    accountId: "acc",
    jurisdiction: "default",
    bucket: "sp-media",
    accessKeyId: "key",
    secretAccessKey: "secret",
  } as R2Config

  it("stores under backups/ and pages through the listing", async () => {
    const sent: { name: string; input: Record<string, unknown> }[] = []
    const send = vi.fn(async (command: { input: Record<string, unknown> }) => {
      const name = command.constructor.name
      sent.push({ name, input: command.input })
      if (name === "ListObjectsV2Command")
        return command.input.ContinuationToken
          ? {
              Contents: [
                {
                  Key: `${BACKUP_PREFIX}${stamp(1)}.dump`,
                  Size: 5,
                  LastModified: new Date(),
                },
              ],
              IsTruncated: false,
            }
          : {
              Contents: [
                {
                  Key: `${BACKUP_PREFIX}${stamp(2)}.dump`,
                  Size: 5,
                  LastModified: new Date(),
                },
                {
                  Key: `${BACKUP_PREFIX}nested/x.dump`,
                  Size: 5,
                  LastModified: new Date(),
                },
              ],
              IsTruncated: true,
              NextContinuationToken: "t2",
            }
      if (name === "GetObjectCommand")
        return {
          Body: {
            transformToByteArray: async () =>
              new TextEncoder().encode("PGDMP-r2"),
          },
        }
      return {}
    })
    const store = r2BackupStore(config, { send } as unknown as S3Client)
    expect(store.location).toBe("r2://sp-media/backups/")

    await store.put(`${stamp(2)}.dump`, src)
    expect(sent.at(-1)).toMatchObject({
      name: "PutObjectCommand",
      input: { Bucket: "sp-media", Key: `backups/${stamp(2)}.dump` },
    })

    expect((await store.list()).map((o) => o.name)).toEqual([
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])

    const out = join(dir, "r2.bin")
    await store.download(`${stamp(2)}.dump`, out)
    expect(await readFile(out, "utf8")).toBe("PGDMP-r2")

    await store.delete(`${stamp(1)}.dump`)
    expect(sent.at(-1)).toMatchObject({
      name: "DeleteObjectCommand",
      input: { Key: `backups/${stamp(1)}.dump` },
    })
  })

  it("with a folder (keyPrefix) every key and the listing prefix live under it", async () => {
    const sent: { name: string; input: Record<string, unknown> }[] = []
    const send = vi.fn(async (command: { input: Record<string, unknown> }) => {
      const name = command.constructor.name
      sent.push({ name, input: command.input })
      if (name === "ListObjectsV2Command")
        return {
          Contents: [
            {
              Key: `sp/backups/${stamp(3)}.dump`,
              Size: 5,
              LastModified: new Date(),
            },
          ],
          IsTruncated: false,
        }
      if (name === "GetObjectCommand")
        return {
          Body: {
            transformToByteArray: async () => new TextEncoder().encode("x"),
          },
        }
      return {}
    })
    const store = r2BackupStore({ ...config, keyPrefix: "sp" }, {
      send,
    } as unknown as S3Client)
    expect(store.location).toBe("r2://sp-media/sp/backups/")
    await store.put(`${stamp(3)}.dump`, src)
    expect((await store.list()).map((o) => o.name)).toEqual([
      `${stamp(3)}.dump`,
    ])
    await store.download(`${stamp(3)}.dump`, join(dir, "o.bin"))
    await store.delete(`${stamp(3)}.dump`)
    expect(sent.map((s) => s.input.Key ?? s.input.Prefix)).toEqual([
      `sp/backups/${stamp(3)}.dump`,
      "sp/backups/",
      `sp/backups/${stamp(3)}.dump`,
      `sp/backups/${stamp(3)}.dump`,
    ])
  })
})
