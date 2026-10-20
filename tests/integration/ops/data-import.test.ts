import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { NotFound, type S3Client } from "@aws-sdk/client-s3"
import { eq } from "drizzle-orm"
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
  vi,
} from "vitest"

import type { R2Config } from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import { runMigrations } from "@/server/db/migrate"
import * as schema from "@/server/db/schema"
import { dumpDatabase } from "@/server/lib/backup/dump"
import { withDatabase } from "@/server/lib/backup/pg-tools"
import { diskBackupStore } from "@/server/lib/backup/store"
import { encryptSecret } from "@/server/lib/crypto"
import {
  checkImportKey,
  IMPORT_MARKER_KEY,
  importDumpKey,
  importedKey,
  runDataImport,
} from "@/server/lib/data-import"
import { SyncError } from "@/server/lib/db-sync"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser } from "../helpers/auth"

const SOURCE_DB = "sp_test_import_source"
const SOURCE_URL = withDatabase(TEST_DATABASE_URL, SOURCE_DB)
const SOURCE_SECRET = "local-secret-0123456789abcdef0123456789ab"
const KEY_IN_R2 = "2026/10/0190a6e0-0000-7000-8000-00000000000a.png"
const KEY_NOT_IN_R2 = "2026/10/0190a6e0-0000-7000-8000-00000000000b.png"
const DEMO_HASH = "scrypt-hash-of-the-local-demo-password"

const r2: R2Config = {
  accountId: "0123456789abcdef0123456789abcdef",
  jurisdiction: "default",
  bucket: "shared-media",
  accessKeyId: "AKID",
  secretAccessKey: "SECRET",
  keyPrefix: "sp",
}
const IMPORT_KEY = importDumpKey(r2, "20261020T090000Z")

async function admin(sql: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

let dumpBytes: Uint8Array
let dir: string

beforeAll(async () => {
  await admin(`drop database if exists ${SOURCE_DB} with (force)`)
  await admin(`create database ${SOURCE_DB}`)
  await runMigrations(SOURCE_URL)
  const pool = new Pool({ connectionString: SOURCE_URL })
  const source = drizzle({ client: pool, schema })
  const [demo] = await source
    .insert(schema.users)
    .values({ name: "Demo Editor", email: "demo.editor@example.test" })
    .returning()
  await source.insert(schema.accounts).values({
    accountId: demo.id,
    providerId: "credential",
    userId: demo.id,
    password: DEMO_HASH,
  })
  await source.insert(schema.sessions).values({
    userId: demo.id,
    token: "local-session-token",
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  await source.insert(schema.settings).values({
    key: "integrations.turnstile",
    draft: {
      enabled: true,
      siteKey: "site-key",
      secretKey: encryptSecret(
        "turnstile-secret",
        "integrations.turnstile.secretKey",
        SOURCE_SECRET
      ),
    },
    version: 1,
  })
  await source.insert(schema.settings).values({
    key: "integrations.r2",
    draft: {
      accountId: "fedcba9876543210fedcba9876543210",
      jurisdiction: "default",
      bucket: "local-bucket",
      accessKeyId: encryptSecret(
        "local-key",
        "integrations.r2.accessKeyId",
        SOURCE_SECRET
      ),
      secretAccessKey: encryptSecret(
        "local-secret",
        "integrations.r2.secretAccessKey",
        SOURCE_SECRET
      ),
    },
    version: 1,
  })
  for (const key of [KEY_IN_R2, KEY_NOT_IN_R2])
    await source
      .insert(schema.media)
      .values({ key, driver: "disk", mime: "image/png", size: 3 })
  await pool.end()
  const tmp = await mkdtemp(join(tmpdir(), "sp-import-src-"))
  try {
    await dumpDatabase(SOURCE_URL, join(tmp, "local.dump"))
    dumpBytes = new Uint8Array(await readFile(join(tmp, "local.dump")))
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
})
afterAll(() => admin(`drop database if exists ${SOURCE_DB} with (force)`))
beforeEach(async () => {
  await resetDb()
  dir = await mkdtemp(join(tmpdir(), "sp-import-it-"))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

/** R2 holding the dump and only KEY_IN_R2's file (under the sp/ folder). */
function fakeR2() {
  const send = vi.fn(
    async (command: {
      constructor: { name: string }
      input: { Key?: string }
    }) => {
      const name = command.constructor.name
      if (name === "GetObjectCommand" && command.input.Key === IMPORT_KEY)
        return { Body: { transformToByteArray: async () => dumpBytes } }
      if (
        name === "HeadObjectCommand" &&
        command.input.Key === `sp/${KEY_IN_R2}`
      )
        return {}
      throw new NotFound({
        message: "missing",
        $metadata: { httpStatusCode: 404 },
      })
    }
  )
  return { client: { send } as unknown as S3Client, send }
}

describe("checkImportKey", () => {
  it("accepts only <folder>/bootstrap/<stamp>.dump", () => {
    expect(checkImportKey(r2, IMPORT_KEY)).toBe(
      "sp/bootstrap/20261020T090000Z.dump"
    )
    for (const bad of [
      "bootstrap/20261020T090000Z.dump",
      "sp/bootstrap/../x.dump",
      "sp/backups/20261020T090000Z.dump",
      "sp/bootstrap/20261020T090000Z.sql",
    ])
      expect(() => checkImportKey(r2, bad), bad).toThrow("SP_IMPORT_KEY")
  })
})

describe("runDataImport (container-side one-shot import)", () => {
  it("restores the dump, keeps demo users, re-keys secrets, moves media found in R2, and records the key", async () => {
    await createUser({ roles: ["editor"] }) // replaced by the import
    const { client } = fakeR2()
    const outcome = await runDataImport({
      key: IMPORT_KEY,
      sourceSecret: SOURCE_SECRET,
      r2,
      client,
      backupStore: diskBackupStore(dir),
    })
    expect(outcome.status).toBe("imported")
    if (outcome.status !== "imported") return
    expect(outcome.mediaMoved).toBe(1)
    expect(outcome.mediaMissing).toEqual([KEY_NOT_IN_R2])
    expect(outcome.report.integrationsRemoved).toEqual(["integrations.r2"])

    const db = getDb()
    const users = await db.select().from(schema.users)
    expect(users.map((u) => u.email)).toEqual(["demo.editor@example.test"])
    const [account] = await db.select().from(schema.accounts)
    expect(account.password).toBe(DEMO_HASH)
    expect(await db.select().from(schema.sessions)).toEqual([])
    expect(await readIntegrationConfig("integrations.turnstile")).toMatchObject(
      {
        secretKey: "turnstile-secret",
      }
    )
    expect(await readIntegrationConfig("integrations.r2")).toBeNull()
    const rows = await db
      .select({ key: schema.media.key, driver: schema.media.driver })
      .from(schema.media)
    expect(Object.fromEntries(rows.map((r) => [r.key, r.driver]))).toEqual({
      [KEY_IN_R2]: "r2",
      [KEY_NOT_IN_R2]: "disk",
    })
    expect(await importedKey()).toBe(IMPORT_KEY)
  })

  it("the same key again changes nothing (idempotent on every start)", async () => {
    const first = fakeR2()
    await runDataImport({
      key: IMPORT_KEY,
      sourceSecret: SOURCE_SECRET,
      r2,
      client: first.client,
      backupStore: diskBackupStore(dir),
    })
    await createUser({ roles: ["owner"] }) // an edit after the import
    const again = fakeR2()
    expect(
      await runDataImport({
        key: IMPORT_KEY,
        sourceSecret: SOURCE_SECRET,
        r2,
        client: again.client,
        backupStore: diskBackupStore(dir),
      })
    ).toEqual({ status: "already-imported" })
    expect(again.send).not.toHaveBeenCalled()
    expect(await getDb().select().from(schema.users)).toHaveLength(2)
  })

  it("a wrong source secret fails before the restore; the database is unchanged", async () => {
    const before = await createUser({ roles: ["editor"] })
    const { client } = fakeR2()
    const err = await runDataImport({
      key: IMPORT_KEY,
      sourceSecret: "wrong-secret-0123456789abcdef0123456789abc",
      r2,
      client,
      backupStore: diskBackupStore(dir),
    }).then(
      () => null,
      (e: unknown) => e as Error
    )
    expect(err?.message).toMatch(/does not decrypt/)
    expect(err instanceof SyncError && err.restored).toBe(false)
    const users = await getDb().select().from(schema.users)
    expect(users.map((u) => u.id)).toEqual([before.id])
    expect(await importedKey()).toBeNull()
    const marker = await getDb()
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, IMPORT_MARKER_KEY))
    expect(marker).toEqual([])
  })

  it("a missing dump object fails without touching the database", async () => {
    const { client } = fakeR2()
    await expect(
      runDataImport({
        key: importDumpKey(r2, "20261020T100000Z"),
        sourceSecret: SOURCE_SECRET,
        r2,
        client,
        backupStore: diskBackupStore(dir),
      })
    ).rejects.toThrow("is not in the R2 bucket")
  })
})
