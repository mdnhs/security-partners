import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { app } from "@/server/api/app"
import { createPasswordToken } from "@/server/auth/tokens"
import { getDb } from "@/server/db/client"
import { sessions } from "@/server/db/schema"

import { resetDb } from "../db"
import { authPost, cookieNames, createUser, signIn } from "../helpers/auth"

beforeEach(resetDb)

const reset = async (userId: string, newPassword: string) =>
  authPost("/reset-password", {
    token: await createPasswordToken(userId, 3600),
    newPassword,
  })

describe("password policy (spec §6: ≥ 12 characters; ledger P02-2)", () => {
  it("a password reset ends every session of that user", async () => {
    const user = await createUser({ roles: ["editor"] })
    await signIn(user.email)
    await signIn(user.email)
    const res = await reset(user.id, "a-brand-new-password-1")
    expect(res.status).toBe(200)
    expect(
      await getDb().select().from(sessions).where(eq(sessions.userId, user.id))
    ).toHaveLength(0)
  })

  it("accepts 12 and 128 characters, rejects 11 and 129", async () => {
    const user = await createUser({ roles: ["editor"] })
    expect((await reset(user.id, "x".repeat(11))).status).toBe(400)
    expect((await reset(user.id, "x".repeat(12))).status).toBe(200)
    expect((await reset(user.id, "y".repeat(129))).status).toBe(400)
    expect((await reset(user.id, "y".repeat(128))).status).toBe(200)
  })
})

describe("cookies on an https origin", () => {
  const savedUrl = process.env.BETTER_AUTH_URL
  afterEach(() => {
    process.env.BETTER_AUTH_URL = savedUrl
  })

  it("are __Secure- prefixed", async () => {
    process.env.BETTER_AUTH_URL = "https://admin.example.test"
    const user = await createUser({ roles: ["editor"] })
    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://admin.example.test",
      },
      body: JSON.stringify({
        email: user.email,
        password: "correct-horse-battery-staple",
      }),
    })
    expect(res.status).toBe(200)
    const names = cookieNames(res)
    expect(names.length).toBeGreaterThan(0)
    for (const name of names) expect(name.startsWith("__Secure-sp.")).toBe(true)
  })
})
