import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { getAuth } from "@/server/auth/auth"
import { createPasswordToken } from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { accounts, sessions, users } from "@/server/db/schema"

import { resetDb } from "../db"
import {
  authPost,
  cookieNames,
  cookiesFrom,
  createUser,
  ORIGIN,
  TEST_PASSWORD,
} from "../helpers/auth"

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

beforeEach(async () => {
  await resetDb()
})

describe("Better Auth config (sp_test)", () => {
  it("auth.api.createUser without a password → users row with a uuid v7 id, roles comma-joined, no credential account", async () => {
    const user = await createUser({
      email: "Invitee@Example.test",
      roles: ["editor", "author"],
      password: null,
    })
    expect(user.id).toMatch(UUID_V7)
    const [row] = await getDb()
      .select()
      .from(users)
      .where(eq(users.id, user.id))
    expect(row.email).toBe("invitee@example.test")
    expect(row.role).toBe("editor,author")
    expect(row.banned).toBe(false)
    expect(row.twoFactorEnabled).toBe(false)
    expect(row.title).toBeNull()
    const accountRows = await getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user.id))
    expect(accountRows).toEqual([])
  })

  it("public sign-up is disabled (POST /api/auth/sign-up/email → 4xx, no user)", async () => {
    const res = await authPost("/sign-up/email", {
      email: "stranger@example.test",
      password: "a-long-enough-password",
      name: "Stranger",
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(await getDb().select().from(users)).toEqual([])
  })

  it("rejects passwords shorter than 12 characters, then signs in after a valid one is set", async () => {
    const user = await createUser({ roles: ["viewer"], password: null })
    const token = await createPasswordToken(user.id, 3600)

    const short = await authPost("/reset-password", {
      token,
      newPassword: "elevenchars",
    })
    expect(short.status).toBe(400)
    expect((await short.json()).code).toBe("PASSWORD_TOO_SHORT")

    const ok = await authPost("/reset-password", {
      token,
      newPassword: TEST_PASSWORD,
    })
    expect(ok.status).toBe(200)
    const credential = await getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.userId, user.id))
    expect(credential.map((a) => a.providerId)).toEqual(["credential"])
    expect(credential[0].id).toMatch(UUID_V7)

    // the token is single-use
    const reused = await authPost("/reset-password", {
      token,
      newPassword: "another-long-password",
    })
    expect(reused.status).toBe(400)

    const signIn = await authPost("/sign-in/email", {
      email: user.email,
      password: TEST_PASSWORD,
    })
    expect(signIn.status).toBe(200)
  })

  it("sessions last 7 days and cookies use the sp prefix", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const res = await authPost("/sign-in/email", {
      email: user.email,
      password: TEST_PASSWORD,
    })
    expect(res.status).toBe(200)
    const names = cookieNames(res)
    expect(names).toContain("sp.session_token")
    for (const name of names) expect(name).toMatch(/^(__Secure-)?sp\./)

    const [row] = await getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.userId, user.id))
    expect(row.id).toMatch(UUID_V7)
    const days = (row.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.99)
    expect(days).toBeLessThanOrEqual(7)

    const session = await getAuth().api.getSession({
      headers: new Headers({ cookie: cookiesFrom(res) }),
    })
    expect(session?.user.id).toBe(user.id)
  })

  it("wrong password → 401 and no session", async () => {
    const user = await createUser({ roles: ["viewer"] })
    const res = await authPost("/sign-in/email", {
      email: user.email,
      password: "not-the-password-at-all",
    })
    expect(res.status).toBe(401)
    expect(await getDb().select().from(sessions)).toEqual([])
  })

  it("admin-plugin endpoints are closed over HTTP (server-side auth.api calls still work)", async () => {
    const res = await app.request("/api/auth/admin/list-users", {
      headers: { origin: ORIGIN },
    })
    expect(res.status).toBe(404)
    const created = await authPost("/admin/create-user", {
      email: "sneaky@example.test",
      name: "Sneaky",
      password: "a-long-enough-password",
    })
    expect(created.status).toBe(404)
    expect(await getDb().select().from(users)).toEqual([])
  })

  it("auth responses carry X-Robots-Tag: noindex", async () => {
    const res = await app.request("/api/auth/get-session")
    expect(res.status).toBe(200)
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
  })
})
