import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, it } from "vitest"

import { createApp } from "@/server/api/app"
import { actorOf, can } from "@/server/api/middleware/auth"
import { getDb } from "@/server/db/client"
import { users } from "@/server/db/schema"

import { resetDb } from "../db"
import { ORIGIN, signedInUser } from "../helpers/auth"

// Private app instance with test-only routes behind the real admin middleware.
const app = createApp()
app.get("/v1/admin/__test/leads", can({ lead: ["read"] }), (c) =>
  c.json({ ok: true })
)
app.get("/v1/admin/__test/me", (c) => c.json(actorOf(c)))
app.post("/v1/admin/__test/echo", (c) => c.json({ ok: true }))

const get = (path: string, cookie?: string) =>
  app.request(`/api/v1/admin/__test${path}`, {
    headers: cookie ? { cookie } : {},
  })

beforeEach(async () => {
  await resetDb()
})

describe("admin auth middleware", () => {
  it('can({ lead: ["read"] }) → 401 without a session', async () => {
    const res = await get("/leads")
    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED")
  })

  it('can({ lead: ["read"] }) → 403 for an editor', async () => {
    const { cookie } = await signedInUser(["editor"])
    const res = await get("/leads", cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe("FORBIDDEN")
  })

  it('can({ lead: ["read"] }) → 200 for intake', async () => {
    const { cookie } = await signedInUser(["intake"])
    const res = await get("/leads", cookie)
    expect(res.status).toBe(200)
  })

  it("resolves the actor (roles parsed, ip from X-Forwarded-For, user agent)", async () => {
    const { user, cookie } = await signedInUser(["editor", "author"])
    const res = await app.request("/api/v1/admin/__test/me", {
      headers: {
        cookie,
        "x-forwarded-for": "203.0.113.7, 10.0.0.2",
        "user-agent": "vitest-agent",
      },
    })
    expect(await res.json()).toEqual({
      userId: user.id,
      roles: ["editor", "author"],
      ip: "203.0.113.7",
      userAgent: "vitest-agent",
      impersonatorId: null,
    })
  })

  it("a banned user gets 401 on the very next request (no cookie-cache lag)", async () => {
    const { user, cookie } = await signedInUser(["viewer"])
    expect((await get("/me", cookie)).status).toBe(200)
    // Ban directly in the DB without touching sessions: the session cookie
    // (and its 5-minute cookie cache) are still valid, the user is not.
    await getDb()
      .update(users)
      .set({ banned: true, banReason: "test" })
      .where(eq(users.id, user.id))
    expect((await get("/me", cookie)).status).toBe(401)
  })

  it("an expired ban no longer blocks", async () => {
    const { user, cookie } = await signedInUser(["viewer"])
    await getDb()
      .update(users)
      .set({ banned: true, banExpires: new Date(Date.now() - 1000) })
      .where(eq(users.id, user.id))
    expect((await get("/me", cookie)).status).toBe(200)
  })

  it("a revoked session gets 401 on the next request", async () => {
    const { cookie } = await signedInUser(["viewer"])
    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: { cookie, origin: ORIGIN },
    })
    expect(signOut.status).toBe(200)
    expect((await get("/me", cookie)).status).toBe(401)
  })

  it("session check runs before sameOrigin: unauthenticated cross-site POST → 401, signed-in cross-site POST → 403", async () => {
    const anonymous = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    })
    expect(anonymous.status).toBe(401)
    const { cookie } = await signedInUser(["viewer"])
    const crossSite = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers: { cookie, origin: "https://evil.example" },
    })
    expect(crossSite.status).toBe(403)
    const sameSite = await app.request("/api/v1/admin/__test/echo", {
      method: "POST",
      headers: { cookie, origin: ORIGIN },
    })
    expect(sameSite.status).toBe(200)
  })
})
