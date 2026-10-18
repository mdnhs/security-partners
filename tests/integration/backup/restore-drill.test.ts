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

  it("explains an empty store", async () => {
    await expect(
      restoreDrill({ url: TEST_DATABASE_URL, store: diskBackupStore(dir) })
    ).rejects.toThrow(`No backup found in ${dir}`)
  })
})
