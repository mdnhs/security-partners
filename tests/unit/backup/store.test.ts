import {
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

  it("ignores interrupted backups (a dump without its manifest)", async () => {
    const store = diskBackupStore(join(dir, "backups"))
    for (let day = 1; day <= 3; day++) {
      await store.put(`${stamp(day)}.dump`, src)
      await store.put(`${stamp(day)}.json`, src)
    }
    await store.put(`${stamp(0)}.dump`, src) // old orphan
    await store.put(`${stamp(4)}.dump`, src) // newest, no manifest
    expect(completeDumps(await store.list()).map((o) => o.name)).toEqual([
      `${stamp(3)}.dump`,
      `${stamp(2)}.dump`,
      `${stamp(1)}.dump`,
    ])
    expect(await pruneBackups(store, 2)).toEqual([
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
    expect(await pruneBackups(store, 14)).toEqual([
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
})
