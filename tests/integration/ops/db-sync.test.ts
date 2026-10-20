import { mkdtemp, readdir, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { symmetricEncrypt } from "better-auth/crypto"
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
  await source.insert(schema.twoFactors).values({
    userId: user.id,
    secret: await symmetricEncrypt({
      key: SOURCE_SECRET,
      data: "JBSWY3DPEHPK3PXP",
    }),
    backupCodes: "enc",
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
  await source.insert(schema.settings).values({
    key: "integrations.r2",
    draft: {
      accountId: "0123456789abcdef0123456789abcdef",
      jurisdiction: "default",
      bucket: "prod-media",
      accessKeyId: encryptSecret(
        "prod-r2-key-id",
        "integrations.r2.accessKeyId",
        SOURCE_SECRET
      ),
      secretAccessKey: encryptSecret(
        "prod-r2-secret",
        "integrations.r2.secretAccessKey",
        SOURCE_SECRET
      ),
    },
    version: 1,
  })
  // Dumped mid-tick: the backup job holds its claim (final review minor 9).
  await source
    .insert(schema.jobs)
    .values({
      name: "backup",
      key: "backup",
      runAt: new Date(),
      lockedAt: new Date(),
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

  it("refuses a --from-secret that does not decrypt the source, before touching the target", async () => {
    const before = await createUser({ roles: ["editor"] })
    await expect(
      dbSync({
        from: SOURCE_URL,
        fromSecret: "wrong-secret-0123456789abcdef0123456789abcd",
        confirm: "sp_test",
        backupStore: diskBackupStore(dir),
      })
    ).rejects.toThrow(
      "--from-secret does not decrypt integrations.smtp.password in the source database"
    )
    const [row] = await getDb()
      .select({ n: count() })
      .from(schema.users)
      .where(eq(schema.users.id, before.id))
    expect(row.n).toBe(1)
    expect(await readdir(dir)).toEqual([])
  })

  it("backs up the target, copies the source, re-keys secrets, skips sessions", async () => {
    await createUser({ roles: ["editor"], email: "target-only@example.test" })
    const report = await dbSync({
      from: SOURCE_URL,
      fromSecret: SOURCE_SECRET,
      confirm: "sp_test",
      backupStore: diskBackupStore(dir),
      keepIntegrations: true,
    })
    expect(report.ok).toBe(true)
    // The source's SMTP password, R2 keys and TOTP secret proved --from-secret.
    expect(report.sourceSecretsChecked).toBe(4)
    expect(report.backup).toMatch(/^sp-sp_test-\d{8}T\d{6}Z\.dump$/)
    expect(await readdir(dir)).toContain(report.backup)
    expect(report.integrationsRemoved).toEqual([])
    expect(report.rotate.reencrypted.sort()).toEqual([
      "integrations.r2.accessKeyId",
      "integrations.r2.secretAccessKey",
      "integrations.smtp.password",
    ])
    expect(report.checks).toContainEqual({
      name: "integrations.smtp",
      ok: true,
      message: "secrets decrypt with the target key",
    })

    const db = getDb()
    const emails = (await db.select().from(schema.users)).map((u) => u.email)
    expect(emails).toEqual(["prod.person@example.test"])
    expect(await db.select().from(schema.sessions)).toHaveLength(0)
    // Claims copied from the source are released: no 10-minute wait.
    expect(
      (await db.select().from(schema.jobs)).map((j) => [j.key, j.lockedAt])
    ).toEqual([["backup", null]])
    expect((await readIntegrationConfig("integrations.smtp"))?.password).toBe(
      "prod-smtp-password"
    )
  })

  // Final review I2: the source's R2 bucket and SMTP account would let the
  // target prune the source's backups, delete its media and send mail as
  // it. Without --keep-integrations they are removed from the target.
  it("removes the source's R2 and SMTP settings from the target by default (audited)", async () => {
    const report = await dbSync({
      from: SOURCE_URL,
      fromSecret: SOURCE_SECRET,
      confirm: "sp_test",
      backupStore: diskBackupStore(dir),
    })
    expect(report.ok).toBe(true)
    expect(report.integrationsRemoved).toEqual([
      "integrations.r2",
      "integrations.smtp",
    ])
    expect(report.rotate.reencrypted).toEqual([])
    for (const name of ["integrations.r2", "integrations.smtp"])
      expect(report.checks).toContainEqual({
        name,
        ok: true,
        message: "not configured",
      })

    const db = getDb()
    const keys = (await db.select().from(schema.settings)).map((r) => r.key)
    expect(keys).not.toContain("integrations.r2")
    expect(keys).not.toContain("integrations.smtp")
    const audits = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, "integration.deleted"))
    expect(audits.map((a) => [a.entityId, a.actorId, a.diff]).sort()).toEqual([
      ["integrations.r2", null, { via: "db:sync" }],
      ["integrations.smtp", null, { via: "db:sync" }],
    ])
  })
})
