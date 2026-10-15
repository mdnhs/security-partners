import { asc } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { createPasswordToken } from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { auditLog } from "@/server/db/schema"

import { resetDb } from "../db"
import {
  authPost,
  cookiesFrom,
  createUser,
  ORIGIN,
  signIn,
  TEST_PASSWORD,
} from "../helpers/auth"

const auditRows = () =>
  getDb()
    .select()
    .from(auditLog)
    .orderBy(asc(auditLog.createdAt), asc(auditLog.id))

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
