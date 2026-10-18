import { setTimeout as delay } from "node:timers/promises"

import { eq } from "drizzle-orm"
import { Client } from "pg"
import { beforeEach, describe, expect, it } from "vitest"

import { getDb } from "@/server/db/client"
import {
  auditLog,
  sessions,
  settings,
  twoFactors,
  users,
} from "@/server/db/schema"
import { encryptSecret } from "@/server/lib/crypto"
import { rotateSecrets } from "@/server/modules/integrations/rotate"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { createUser, signIn } from "../helpers/auth"

const OLD = "previous-secret-0123456789abcdef0123456789"

beforeEach(resetDb)

describe("rotateSecrets (pnpm secrets:rotate)", () => {
  it("re-encrypts saved secrets, clears 2FA and sessions, audits names only, and is re-runnable", async () => {
    const db = getDb()
    await db.insert(settings).values({
      key: "integrations.smtp",
      draft: {
        host: "smtp.example.test",
        port: 587,
        secure: false,
        user: "mailer",
        password: encryptSecret(
          "smtp-password-1",
          "integrations.smtp.password",
          OLD
        ),
        fromName: "Security Partners",
        fromAddress: "no-reply@example.test",
      },
      version: 1,
    })
    const user = await createUser({ roles: ["admin"] })
    await signIn(user.email)
    await db
      .insert(twoFactors)
      .values({ userId: user.id, secret: "enc", backupCodes: "enc" })
    await db
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, user.id))

    await expect(readIntegrationConfig("integrations.smtp")).rejects.toThrow(
      "cannot be decrypted"
    )

    const report = await rotateSecrets({ fromSecret: OLD })
    expect(report).toMatchObject({
      reencrypted: ["integrations.smtp.password"],
      alreadyCurrent: [],
      twoFactorCleared: 1,
    })
    expect(report.sessionsRevoked).toBeGreaterThanOrEqual(1)
    expect((await readIntegrationConfig("integrations.smtp"))?.password).toBe(
      "smtp-password-1"
    )
    expect(await db.select().from(sessions)).toHaveLength(0)
    expect(await db.select().from(twoFactors)).toHaveLength(0)
    const [me] = await db.select().from(users).where(eq(users.id, user.id))
    expect(me.twoFactorEnabled).toBe(false)
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "integrations.smtp"))
    expect(row.version).toBe(2)
    const audit = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "secrets.rotated"))
    expect(audit).toHaveLength(1)
    expect(JSON.stringify(audit[0].diff)).not.toContain("smtp-password-1")

    const again = await rotateSecrets({ fromSecret: OLD })
    expect(again).toMatchObject({
      reencrypted: [],
      alreadyCurrent: ["integrations.smtp.password"],
    })
  })

  it("waits for a concurrent settings save instead of overwriting it", async () => {
    const aad = "integrations.smtp.password"
    await getDb()
      .insert(settings)
      .values({
        key: "integrations.smtp",
        draft: {
          host: "smtp.example.test",
          port: 587,
          secure: false,
          user: "mailer",
          password: encryptSecret("before-save", aad, OLD),
          fromName: "Security Partners",
          fromAddress: "no-reply@example.test",
        },
        version: 1,
      })
    const admin = new Client({ connectionString: TEST_DATABASE_URL })
    await admin.connect()
    try {
      await admin.query("begin")
      await admin.query(
        "update settings set draft = jsonb_set(draft, '{password}', to_jsonb($1::text)), version = version + 1 where key = 'integrations.smtp'",
        [encryptSecret("saved-meanwhile", aad, OLD)]
      )
      const rotation = rotateSecrets({ fromSecret: OLD })
      await delay(300)
      await admin.query("commit")
      expect((await rotation).reencrypted).toEqual([aad])
    } finally {
      await admin.end()
    }
    expect((await readIntegrationConfig("integrations.smtp"))?.password).toBe(
      "saved-meanwhile"
    )
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "integrations.smtp"))
    expect(row.version).toBe(3)
  })
})
