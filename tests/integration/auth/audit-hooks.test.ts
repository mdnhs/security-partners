import { asc, sql } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { createPasswordToken } from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { auditLog } from "@/server/db/schema"

import { resetDb } from "../db"
import {
  authPost,
  cookiesFrom,
  createUser,
  mergeCookies,
  ORIGIN,
  signIn,
  TEST_PASSWORD,
} from "../helpers/auth"

/** RFC 4648 base32 → the raw secret string Better Auth's createOTP signs with. */
function base32Decode(input: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const bytes: number[] = []
  let value = 0
  let bits = 0
  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    value = (value << 5) | alphabet.indexOf(char)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
      value &= (1 << bits) - 1
    }
  }
  return Buffer.from(bytes).toString("utf8")
}

/** Current TOTP code via Better Auth's own server-only generator. */
async function totpCode(secret: string): Promise<string> {
  return (await getAuth().api.generateTOTP({ body: { secret } })).code
}

/**
 * Signs in, enables TOTP and confirms it with a first code (→ 2FA on).
 * Returns the refreshed session cookie, the raw secret and the backup codes.
 */
async function enableTwoFactor(email: string) {
  let cookie = await signIn(email)
  const enable = await authPost(
    "/two-factor/enable",
    { password: TEST_PASSWORD },
    cookie
  )
  expect(enable.status).toBe(200)
  const { totpURI, backupCodes } = (await enable.json()) as {
    totpURI: string
    backupCodes: string[]
  }
  cookie = mergeCookies(cookie, enable)
  const secret = base32Decode(new URL(totpURI).searchParams.get("secret")!)
  const verify = await authPost(
    "/two-factor/verify-totp",
    { code: await totpCode(secret) },
    cookie
  )
  expect(verify.status).toBe(200)
  return { cookie: mergeCookies(cookie, verify), secret, backupCodes }
}

/** Password step for a 2FA user: returns the pending-challenge cookie. */
async function startChallenge(email: string): Promise<string> {
  const res = await authPost("/sign-in/email", {
    email,
    password: TEST_PASSWORD,
  })
  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ twoFactorRedirect: true })
  return cookiesFrom(res)
}

const auditRows = () =>
  getDb()
    .select()
    .from(auditLog)
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id))

const resetAuditRows = () => getDb().execute(sql`truncate table audit_log`)

beforeEach(async () => {
  await resetDb()
})

describe("Better Auth hooks write audit rows", () => {
  it("successful sign-in → auth.sign_in with actor, ip and user agent", async () => {
    const user = await createUser({ roles: ["editor"] })
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: ORIGIN,
        "x-forwarded-for": "198.51.100.4",
        "user-agent": "audit-test",
      },
      body: JSON.stringify({ email: user.email, password: TEST_PASSWORD }),
    })
    expect(res.status).toBe(200)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in",
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
      ip: "198.51.100.4",
      userAgent: "audit-test",
      diff: { method: "password" },
    })
  })

  it("failed sign-in → auth.sign_in_failed without actor, naming the account", async () => {
    const user = await createUser({ roles: ["editor"] })
    const res = await authPost("/sign-in/email", {
      email: user.email.toUpperCase(),
      password: "definitely-wrong-password",
    })
    expect(res.status).toBe(401)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in_failed",
      actorId: null,
      entityType: "user",
      entityId: user.id,
      diff: { method: "password", email: user.email },
    })
  })

  it("failed sign-in for an unknown email still records the attempt", async () => {
    await authPost("/sign-in/email", {
      email: "nobody@example.test",
      password: "definitely-wrong-password",
    })
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in_failed",
      entityId: null,
      diff: { email: "nobody@example.test" },
    })
  })

  it("failed sign-in keeps at most 254 chars of the attempted email", async () => {
    const long = `${"a".repeat(60)}@${"b".repeat(60)}.${"c".repeat(60)}.${"d".repeat(60)}.${"e".repeat(60)}.example`
    expect(long.length).toBeGreaterThan(254)
    await authPost("/sign-in/email", {
      email: long,
      password: "definitely-wrong-password",
    })
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe("auth.sign_in_failed")
    // cut inside the last-but-one label, so the 254-char prefix is still an email
    expect(rows[0].diff).toEqual({
      method: "password",
      email: long.slice(0, 254),
      reason: expect.any(String),
    })
  })

  it("failed sign-in with a non-email stores emailInvalid instead of the input", async () => {
    await authPost("/sign-in/email", {
      email: "<script>alert(1)</script>",
      password: "definitely-wrong-password",
    })
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in_failed",
      entityId: null,
      diff: { method: "password", emailInvalid: true },
    })
    expect(rows[0].diff).not.toHaveProperty("email")
  })

  it("sign-out → auth.sign_out", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const cookie = await signIn(user.email)
    const res = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: ORIGIN },
    })
    expect(res.status).toBe(200)
    const actions = (await auditRows()).map((r) => [r.action, r.actorId])
    expect(actions).toEqual([
      ["auth.sign_in", user.id],
      ["auth.sign_out", user.id],
    ])
  })

  it("password change → auth.password_change and always revokes other sessions", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const laptop = await signIn(user.email)
    const phone = await signIn(user.email)
    const res = await authPost(
      "/change-password",
      {
        currentPassword: TEST_PASSWORD,
        newPassword: "a-brand-new-password",
        revokeOtherSessions: false, // ignored: forced to true by a before hook
      },
      laptop
    )
    expect(res.status).toBe(200)
    const current = cookiesFrom(res) || laptop
    const session = (cookie: string) =>
      app.request("/api/auth/get-session?disableCookieCache=true", {
        headers: { cookie },
      })
    expect(await (await session(phone)).json()).toBeNull()
    expect((await (await session(current)).json())?.user.id).toBe(user.id)
    expect((await auditRows()).map((r) => r.action)).toContain(
      "auth.password_change"
    )
  })

  it("password reset by token → auth.password_reset", async () => {
    const user = await createUser({ roles: ["viewer"], password: null })
    const token = await createPasswordToken(user.id, 600)
    const res = await authPost("/reset-password", {
      token,
      newPassword: TEST_PASSWORD,
    })
    expect(res.status).toBe(200)
    const rows = await auditRows()
    expect(rows.map((r) => [r.action, r.actorId])).toEqual([
      ["auth.password_reset", user.id],
    ])
  })
})

describe("two-factor audit rows", () => {
  it("enabling TOTP (first code while signed in) → auth.2fa_enable", async () => {
    const user = await createUser({ roles: ["viewer"] })
    await enableTwoFactor(user.email)
    const rows = await auditRows()
    expect(rows.map((r) => [r.action, r.actorId])).toEqual([
      ["auth.sign_in", user.id],
      ["auth.2fa_enable", user.id],
    ])
    expect(rows[1]).toMatchObject({ entityType: "user", entityId: user.id })
  })

  it("password + TOTP sign-in → exactly one auth.sign_in with method totp", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const { secret } = await enableTwoFactor(user.email)
    await resetAuditRows()
    const challenge = await startChallenge(user.email)
    expect(await auditRows()).toHaveLength(0) // the password step alone is not a sign-in
    const res = await authPost(
      "/two-factor/verify-totp",
      { code: await totpCode(secret) },
      challenge
    )
    expect(res.status).toBe(200)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in",
      actorId: user.id,
      entityType: "user",
      entityId: user.id,
      diff: { method: "totp" },
    })
  })

  it("wrong TOTP during the challenge → auth.sign_in_failed naming the challenged user", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const { secret } = await enableTwoFactor(user.email)
    await resetAuditRows()
    const challenge = await startChallenge(user.email)
    const valid = await totpCode(secret)
    const wrong = valid === "000000" ? "111111" : "000000"
    const res = await authPost(
      "/two-factor/verify-totp",
      { code: wrong },
      challenge
    )
    expect(res.status).toBe(401)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in_failed",
      actorId: null,
      entityType: "user",
      entityId: user.id,
      diff: { method: "totp", reason: "INVALID_CODE" },
    })
  })

  it("wrong TOTP without a challenge cookie → auth.sign_in_failed without an account", async () => {
    const res = await authPost("/two-factor/verify-totp", { code: "000000" })
    expect(res.status).toBe(401)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in_failed",
      entityType: "user",
      entityId: null,
      diff: { method: "totp", reason: "INVALID_TWO_FACTOR_COOKIE" },
    })
  })

  it("backup code during the challenge → auth.sign_in with method backup_code", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const { backupCodes } = await enableTwoFactor(user.email)
    await resetAuditRows()
    const challenge = await startChallenge(user.email)
    const res = await authPost(
      "/two-factor/verify-backup-code",
      { code: backupCodes[0] },
      challenge
    )
    expect(res.status).toBe(200)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: "auth.sign_in",
      actorId: user.id,
      diff: { method: "backup_code" },
    })
  })

  it("disabling 2FA → auth.2fa_disable", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const { cookie } = await enableTwoFactor(user.email)
    await resetAuditRows()
    const res = await authPost(
      "/two-factor/disable",
      { password: TEST_PASSWORD },
      cookie
    )
    expect(res.status).toBe(200)
    const rows = await auditRows()
    expect(rows.map((r) => [r.action, r.actorId, r.entityId])).toEqual([
      ["auth.2fa_disable", user.id, user.id],
    ])
  })
})
