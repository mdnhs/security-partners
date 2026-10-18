import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { runBackup } from "@/server/lib/backup"
import type { BackupManifest } from "@/server/lib/backup/dump"
import { diskBackupStore } from "@/server/lib/backup/store"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser } from "../helpers/auth"

let dir: string
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-backup-it-"))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe("runBackup (spec §14 backup)", () => {
  it("writes a custom-format dump and a manifest with the snapshot's row counts", async () => {
    await createUser({ roles: ["editor"] })
    await createUser({ roles: ["viewer"] })
    const store = diskBackupStore(dir)
    const result = await runBackup({
      url: TEST_DATABASE_URL,
      store,
      now: new Date("2026-10-16T12:00:00Z"),
    })
    expect(result).toMatchObject({
      name: "sp-sp_test-20261016T120000Z.dump",
      store: "disk",
      location: dir,
      pruned: [],
    })
    const dump = await readFile(join(dir, result.name))
    expect(dump.subarray(0, 5).toString("latin1")).toBe("PGDMP")
    const manifest = JSON.parse(
      await readFile(join(dir, "sp-sp_test-20261016T120000Z.json"), "utf8")
    ) as BackupManifest
    expect(manifest).toMatchObject({
      version: 1,
      database: "sp_test",
      file: result.name,
      bytes: dump.length,
      excludedData: ["public.rate_limits", "public.public_rate_limits"],
    })
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(manifest.counts["public.users"]).toBe(2)
    expect(manifest.counts["public.rate_limits"]).toBe(0)
    expect(manifest.counts["drizzle.__drizzle_migrations"]).toBeGreaterThan(0)
  })

  it("prunes beyond the kept number", async () => {
    const store = diskBackupStore(dir)
    for (let hour = 0; hour < 3; hour++)
      await runBackup({
        url: TEST_DATABASE_URL,
        store,
        keep: 2,
        now: new Date(Date.UTC(2026, 9, 16, hour)),
      })
    const dumps = (await store.list())
      .map((o) => o.name)
      .filter((n) => n.endsWith(".dump"))
    expect(dumps).toEqual([
      "sp-sp_test-20261016T020000Z.dump",
      "sp-sp_test-20261016T010000Z.dump",
    ])
  })
})
