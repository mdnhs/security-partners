import { eq, like } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { InviteEmail } from "@/emails/invite"
import { ResetPasswordEmail } from "@/emails/reset-password"
import { app } from "@/server/api/app"
import {
  createPasswordToken,
  INVITE_TOKEN_EXPIRES_IN,
} from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { auditLog, sessions, twoFactors, users } from "@/server/db/schema"
import { mailer } from "@/server/lib/mailer"
import {
  createOwner,
  recoverOwner,
  seedDemoUsers,
} from "@/server/modules/users/bootstrap"

import { resetDb } from "../db"
import { authPost, createUser, signIn, TEST_PASSWORD } from "../helpers/auth"

const sessionOf = async (cookie: string) =>
  (
    await app.request("/api/auth/get-session?disableCookieCache=true", {
      headers: { cookie },
    })
  ).json()

const tokenOf = (url: string) =>
  new URL(url).searchParams.get("token") as string

beforeEach(async () => {
  await resetDb()
  vi.spyOn(console, "info").mockImplementation(() => undefined)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("createOwner (admin:create)", () => {
  it("creates a passwordless owner and returns a working set-password link", async () => {
    const result = await createOwner({
      email: " Boss@Example.ie ",
      name: "Bea Boss",
    })
    expect(result.emailDelivered).toBe(false)
    expect(result.url).toMatch(
      /^http:\/\/localhost:3000\/admin\/set-password\?token=/
    )
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, result.userId))
    expect(row).toMatchObject({ email: "boss@example.ie", role: "owner" })
    const [audit] = await getDb().select().from(auditLog)
    expect(audit).toMatchObject({
      action: "user.invite",
      actorId: null,
      diff: { via: "admin:create", roles: ["owner"] },
    })
    const set = await authPost("/reset-password", {
      token: tokenOf(result.url),
      newPassword: TEST_PASSWORD,
    })
    expect(set.status).toBe(200)
    await signIn("boss@example.ie")
  })

  it("refuses an existing email and an invalid one", async () => {
    await createOwner({ email: "boss@example.ie", name: "Bea Boss" })
    await expect(
      createOwner({ email: "BOSS@example.ie", name: "Again" })
    ).rejects.toThrow("already exists")
    await expect(
      createOwner({ email: "not-an-email", name: "X" })
    ).rejects.toThrow("Not a valid email address")
  })
})

describe("recoverOwner (owner:recover)", () => {
  it("clears 2FA, revokes sessions, audits and prints a working reset link", async () => {
    const owner = await createUser({ roles: ["owner"] })
    await signIn(owner.email)
    await getDb()
      .update(users)
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, owner.id))
    await getDb().insert(twoFactors).values({
      userId: owner.id,
      secret: "x",
      backupCodes: "y",
      verified: true,
    })

    const result = await recoverOwner({ email: owner.email })
    expect(result.url).toContain("/admin/reset-password?token=")
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, owner.id))
    expect(row.twoFactorEnabled).toBe(false)
    expect(await getDb().select().from(twoFactors)).toEqual([])
    expect(
      await getDb().select().from(sessions).where(eq(sessions.userId, owner.id))
    ).toEqual([])
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.owner_recover"))
    expect(audit).toMatchObject({
      actorId: null,
      entityId: owner.id,
      diff: {
        via: "owner:recover",
        twoFactorCleared: true,
        sessionsRevoked: 1,
      },
    })

    const reset = await authPost("/reset-password", {
      token: tokenOf(result.url),
      newPassword: "recovered-password-1",
    })
    expect(reset.status).toBe(200)
    await signIn(owner.email, "recovered-password-1")
  })

  it("voids earlier password links and emails the reset wording", async () => {
    const owner = await createUser({ roles: ["owner"] })
    const earlier = await createPasswordToken(owner.id, INVITE_TOKEN_EXPIRES_IN)
    const send = vi.spyOn(mailer, "send")

    const result = await recoverOwner({ email: owner.email })
    const [audit] = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "user.owner_recover"))
    expect(audit.diff).toMatchObject({ passwordLinksRevoked: 1 })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].react.type).toBe(ResetPasswordEmail)

    const stale = await authPost("/reset-password", {
      token: earlier,
      newPassword: "stale-link-password-1",
    })
    expect(stale.status).toBe(400)
    expect((await stale.json()).code).toBe("INVALID_TOKEN")
    const fresh = await authPost("/reset-password", {
      token: tokenOf(result.url),
      newPassword: "recovered-password-1",
    })
    expect(fresh.status).toBe(200)
  })

  it("an owner without a password gets a set-password link and the invite email", async () => {
    const owner = await createUser({ roles: ["owner"], password: null })
    const send = vi.spyOn(mailer, "send")

    const result = await recoverOwner({ email: owner.email })
    expect(result.url).toMatch(
      /^http:\/\/localhost:3000\/admin\/set-password\?token=/
    )
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0]).toMatchObject({
      to: owner.email,
      subject: "You're invited to the Security Partners admin",
    })
    expect(send.mock.calls[0][0].react.type).toBe(InviteEmail)

    const set = await authPost("/reset-password", {
      token: tokenOf(result.url),
      newPassword: "first-owner-password",
    })
    expect(set.status).toBe(200)
    await signIn(owner.email, "first-owner-password")
  })

  it("refuses non-owners and unknown emails", async () => {
    const editor = await createUser({ roles: ["editor"] })
    await expect(recoverOwner({ email: editor.email })).rejects.toThrow(
      "is not an owner"
    )
    await expect(recoverOwner({ email: "ghost@example.ie" })).rejects.toThrow(
      "User not found"
    )
  })
})

describe("seedDemoUsers (demo:seed)", () => {
  it("is idempotent: twice → 7 users, one per role, passwords reset", async () => {
    const first = await seedDemoUsers("first-demo-password")
    expect(first.map((u) => [u.email, u.created])).toEqual([
      ["owner@demo.local", true],
      ["admin@demo.local", true],
      ["editor@demo.local", true],
      ["author@demo.local", true],
      ["marketer@demo.local", true],
      ["intake@demo.local", true],
      ["viewer@demo.local", true],
    ])
    const signedIn = await signIn("editor@demo.local", "first-demo-password")
    // drift that a re-run must repair
    await getDb()
      .update(users)
      .set({ role: "owner", banned: true })
      .where(eq(users.email, "viewer@demo.local"))

    const second = await seedDemoUsers("second-demo-password")
    expect(second.every((u) => !u.created)).toBe(true)
    const rows = await getDb()
      .select()
      .from(users)
      .where(like(users.email, "%@demo.local"))
    expect(rows).toHaveLength(7)
    const viewer = rows.find((r) => r.email === "viewer@demo.local")
    expect(viewer).toMatchObject({ role: "viewer", banned: false })
    // sessions from before the reset are revoked
    expect(await sessionOf(signedIn)).toBeNull()

    await signIn("editor@demo.local", "second-demo-password")
    const old = await authPost("/sign-in/email", {
      email: "editor@demo.local",
      password: "first-demo-password",
    })
    expect(old.status).toBe(401)
  })

  it("rejects a password shorter than 12 characters", async () => {
    await expect(seedDemoUsers("short")).rejects.toThrow("12-128 characters")
  })
})
