import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { count, eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/node-postgres"
import { Client, Pool } from "pg"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"

import { getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import * as schema from "@/server/db/schema"
import { withDatabase } from "@/server/lib/backup/pg-tools"
import { diskBackupStore } from "@/server/lib/backup/store"
import { encryptSecret } from "@/server/lib/crypto"
import { dbSync } from "@/server/lib/db-sync"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser } from "../helpers/auth"

const SOURCE_DB = "sp_test_sync_source"
const SOURCE_URL = withDatabase(TEST_DATABASE_URL, SOURCE_DB)
const SOURCE_SECRET = "source-secret-0123456789abcdef0123456789ab"

async function admin(sql: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

let dir: string
beforeAll(async () => {
  await admin(`drop database if exists ${SOURCE_DB} with (force)`)
  await admin(`create database ${SOURCE_DB}`)
  await runMigrations(SOURCE_URL)
  const pool = new Pool({ connectionString: SOURCE_URL })
  const source = drizzle({ client: pool, schema })
  const [user] = await source
    .insert(schema.users)
    .values({ name: "Prod Person", email: "prod.person@example.test" })
    .returning()
  await source.insert(schema.sessions).values({
    userId: user.id,
    token: "source-session-token",
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  await source.insert(schema.settings).values({
    key: "integrations.smtp",
    draft: {
      host: "smtp.example.test",
      port: 587,
      secure: false,
      user: "mailer",
      password: encryptSecret(
        "prod-smtp-password",
        "integrations.smtp.password",
        SOURCE_SECRET
      ),
      fromName: "Security Partners",
      fromAddress: "no-reply@example.test",
    },
    version: 1,
  })
  await pool.end()
})
afterAll(() => admin(`drop database if exists ${SOURCE_DB} with (force)`))
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-sync-it-"))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe("dbSync (spec §14 db:sync)", () => {
  it("refuses without the target database name as confirmation", async () => {
    const before = await createUser({ roles: ["editor"] })
    await expect(
      dbSync({
        from: SOURCE_URL,
        fromSecret: SOURCE_SECRET,
        confirm: "sp_prod",
        backupStore: diskBackupStore(dir),
      })
    ).rejects.toThrow("--confirm must be the target database name (sp_test)")
    const [row] = await getDb()
      .select({ n: count() })
      .from(schema.users)
      .where(eq(schema.users.id, before.id))
    expect(row.n).toBe(1)
  })

  it("refuses to sync a database onto itself", async () => {
    await expect(
      dbSync({
        from: TEST_DATABASE_URL,
        fromSecret: SOURCE_SECRET,
        confirm: "sp_test",
        backupStore: diskBackupStore(dir),
      })
    ).rejects.toThrow("Source and target are the same database")
  })

  it("backs up the target, copies the source, re-keys secrets, skips sessions", async () => {
    await createUser({ roles: ["editor"], email: "target-only@example.test" })
    const report = await dbSync({
      from: SOURCE_URL,
      fromSecret: SOURCE_SECRET,
      confirm: "sp_test",
      backupStore: diskBackupStore(dir),
    })
    expect(report.ok).toBe(true)
    expect(report.backup).toMatch(/^sp-sp_test-\d{8}T\d{6}Z\.dump$/)
    expect(await readdir(dir)).toContain(report.backup)
    expect(report.rotate.reencrypted).toEqual(["integrations.smtp.password"])
    expect(report.checks).toContainEqual({
      name: "integrations.smtp",
      ok: true,
      message: "secrets decrypt with the target key",
    })

    const db = getDb()
    const emails = (await db.select().from(schema.users)).map((u) => u.email)
    expect(emails).toEqual(["prod.person@example.test"])
    expect(await db.select().from(schema.sessions)).toHaveLength(0)
    expect((await readIntegrationConfig("integrations.smtp"))?.password).toBe(
      "prod-smtp-password"
    )
  })
})
