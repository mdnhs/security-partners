import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { Client } from "pg"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { runBackup } from "@/server/lib/backup"
import { restoreDrill } from "@/server/lib/backup/restore-drill"
import { diskBackupStore } from "@/server/lib/backup/store"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser } from "../helpers/auth"

let dir: string
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-drill-it-"))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

async function scratchExists(): Promise<boolean> {
  const client = new Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    const { rowCount } = await client.query(
      "select 1 from pg_database where datname = 'sp_test_restore_drill'"
    )
    return rowCount === 1
  } finally {
    await client.end()
  }
}

describe("restoreDrill (spec §14)", () => {
  it("restores the newest backup into a scratch DB and matches every count", async () => {
    await createUser({ roles: ["editor"] })
    await createUser({ roles: ["admin"] })
    const store = diskBackupStore(dir)
    await runBackup({ url: TEST_DATABASE_URL, store })
    const result = await restoreDrill({ url: TEST_DATABASE_URL, store })
    expect(result).toMatchObject({
      scratchDatabase: "sp_test_restore_drill",
      mismatches: [],
      ok: true,
    })
    expect(result.backup).toMatch(/^sp-sp_test-\d{8}T\d{6}Z\.dump$/)
    expect(result.tables).toBeGreaterThan(10)
    expect(await scratchExists()).toBe(false)
  })

  it("reports a count that does not match the manifest", async () => {
    await createUser({ roles: ["editor"] })
    const store = diskBackupStore(dir)
    const { name } = await runBackup({ url: TEST_DATABASE_URL, store })
    const manifestFile = join(dir, name.replace(/\.dump$/, ".json"))
    const manifest = JSON.parse(await readFile(manifestFile, "utf8"))
    manifest.counts["public.users"] = 99
    await writeFile(manifestFile, JSON.stringify(manifest))
    const result = await restoreDrill({ url: TEST_DATABASE_URL, store })
    expect(result.ok).toBe(false)
    expect(result.mismatches).toEqual([
      { table: "public.users", expected: 99, actual: 1 },
    ])
  })

  it("refuses a dump whose checksum does not match", async () => {
    const store = diskBackupStore(dir)
    const { name } = await runBackup({ url: TEST_DATABASE_URL, store })
    await appendFile(join(dir, name), "x")
    await expect(
      restoreDrill({ url: TEST_DATABASE_URL, store })
    ).rejects.toThrow("checksum does not match its manifest")
  })

  it("skips a newer dump that has no manifest (interrupted backup)", async () => {
    const store = diskBackupStore(dir)
    const { name } = await runBackup({
      url: TEST_DATABASE_URL,
      store,
      now: new Date("2026-10-16T12:00:00Z"),
    })
    await writeFile(join(dir, "sp-sp_test-20261017T120000Z.dump"), "PGDMP-cut")
    const result = await restoreDrill({ url: TEST_DATABASE_URL, store })
    expect(result).toMatchObject({ backup: name, ok: true })
  })

  // Final review I2: environments can share one store (db:sync with
  // --keep-integrations); the drill verifies this database's newest dump.
  it("ignores another database's dumps, however they sort", async () => {
    const store = diskBackupStore(dir)
    const { name } = await runBackup({
      url: TEST_DATABASE_URL,
      store,
      now: new Date("2026-10-16T12:00:00Z"),
    })
    const manifest = JSON.parse(
      await readFile(join(dir, name.replace(/\.dump$/, ".json")), "utf8")
    )
    manifest.counts["public.users"] = 99
    for (const other of ["sp-sp_test_staging", "sp-zz"]) {
      const base = `${other}-20991231T000000Z`
      await writeFile(
        join(dir, `${base}.dump`),
        await readFile(join(dir, name))
      )
      await writeFile(join(dir, `${base}.json`), JSON.stringify(manifest))
    }
    const result = await restoreDrill({ url: TEST_DATABASE_URL, store })
    expect(result).toMatchObject({ backup: name, ok: true })
  })

  it("explains an empty store", async () => {
    await expect(
      restoreDrill({ url: TEST_DATABASE_URL, store: diskBackupStore(dir) })
    ).rejects.toThrow(`No backup found in ${dir}`)
  })
})
