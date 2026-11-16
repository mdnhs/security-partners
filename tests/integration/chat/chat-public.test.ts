import { eq, sql } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))

const turnstile = vi.hoisted(() => ({ verify: vi.fn() }))
vi.mock("@/server/lib/turnstile", () => ({
  verifyTurnstileToken: turnstile.verify,
}))

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import {
  chatConversations,
  chatMessages,
  chatPresence,
  publicRateLimits,
  rateLimits,
  settings,
} from "@/server/db/schema"
import { encryptSecret } from "@/server/lib/crypto"
import { touchPresence } from "@/server/modules/chat/repo"

import { resetDb } from "../db"
import { createUser, ORIGIN } from "../helpers/auth"

let ipCounter = 0
const freshIp = () => `203.0.113.${++ipCounter}`

/** Writes the chat settings row's draft and published value directly. */
async function publishChat(
  patch: Record<string, unknown> = {},
  opts: { published?: boolean } = {}
) {
  const value = { ...CHAT_SETTINGS_DEFAULT, enabled: true, ...patch }
  const published = opts.published === false ? null : value
  await getDb()
    .insert(settings)
    .values({ key: "chat", draft: value, published, version: 1 })
    .onConflictDoUpdate({
      target: settings.key,
      set: { draft: value, published },
    })
}

async function saveTurnstile(secretKey: string) {
  await getDb()
    .insert(settings)
    .values({
      key: "integrations.turnstile",
      draft: { enabled: true, siteKey: "0x4AAAAAAAtestsitekey", secretKey },
      published: null,
      version: 1,
    })
}

function chatRequest(
  path: string,
  init: {
    method?: string
    body?: unknown
    ip?: string
    cookie?: string
    origin?: string | null
  } = {}
) {
  const origin = init.origin === undefined ? ORIGIN : init.origin
  return app.request(`/api/v1/public/chat${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": init.ip ?? freshIp(),
      ...(origin ? { origin } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

const startBody = (o: Record<string, unknown> = {}) => ({
  message: "Hello there",
  sourcePath: "/services",
  ...o,
})
const cookieOf = (res: Response) =>
  (res.headers.get("set-cookie") ?? "").split(";")[0]!

async function begin(ip = freshIp()) {
  const res = await chatRequest("/start", {
    method: "POST",
    body: startBody(),
    ip,
  })
  expect(res.status).toBe(201)
  return { res, cookie: cookieOf(res), view: await res.json() }
}

const conversations = () => getDb().select().from(chatConversations)
const messages = () => getDb().select().from(chatMessages)

beforeEach(async () => {
  await resetDb()
  deferred.tasks = []
  turnstile.verify.mockReset()
  await publishChat()
})

afterEach(async () => {
  await Promise.allSettled(deferred.tasks)
  vi.restoreAllMocks()
})

describe("public chat API", () => {
  it("404 everywhere while the chat is off, unpublished or invalid", async () => {
    const cases: Array<() => Promise<unknown>> = [
      () => getDb().delete(settings).where(eq(settings.key, "chat")),
      () => publishChat({ enabled: false }),
      () => publishChat({}, { published: false }),
      () => publishChat({ teamName: "" }),
    ]
    for (const setUp of cases) {
      await setUp()
      expect((await chatRequest("/status")).status).toBe(404)
      const start = await chatRequest("/start", {
        method: "POST",
        body: startBody(),
      })
      expect(start.status).toBe(404)
      const poll = await chatRequest("/conversation", {
        cookie: "cp_chat=anything",
      })
      expect(poll.status).toBe(404)
    }
    expect(await conversations()).toHaveLength(0)
    expect(await getDb().select().from(rateLimits)).toHaveLength(0)
  })

  it("start stores the chat, sets cp_chat (httpOnly, path, SameSite=Lax) and returns the view with the first message", async () => {
    const { res, view } = await begin()
    const header = res.headers.get("set-cookie")!
    expect(header).toMatch(/^cp_chat=[A-Za-z0-9_-]{40,}/)
    expect(header).toMatch(/HttpOnly/i)
    expect(header).toMatch(/SameSite=Lax/i)
    expect(header).toMatch(/Path=\/api\/v1\/public\/chat/)
    expect(header).toMatch(/Max-Age=2592000/)
    // BETTER_AUTH_URL is http: in tests.
    expect(header).not.toMatch(/Secure/i)
    expect(view).toMatchObject({
      status: "open",
      botActive: false,
      needsHuman: false,
      hasEmail: false,
      agentName: null,
    })
    expect(view.messages).toHaveLength(1)
    expect(view.messages[0]).toMatchObject({
      sender: "visitor",
      senderName: "Visitor",
      body: "Hello there",
    })
    expect(view.lastId).toBe(view.messages[0].id)
    const [row] = await conversations()
    expect(row).toMatchObject({
      id: view.id,
      visitorName: "Visitor",
      sourcePath: "/services",
    })
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(header).not.toContain(row!.tokenHash)
  })

  it("a second start with the cookie appends to the open chat", async () => {
    const { cookie, view } = await begin()
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody({ message: "Again" }),
      cookie,
    })
    expect(res.status).toBe(201)
    const again = await res.json()
    expect(again.id).toBe(view.id)
    expect(again.messages.map((m: { body: string }) => m.body)).toEqual([
      "Hello there",
      "Again",
    ])
    expect(await conversations()).toHaveLength(1)
  })

  it("honeypot: 201 and nothing stored", async () => {
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody({ website: "http://spam.example" }),
    })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get("set-cookie")).toBeNull()
    expect(await conversations()).toHaveLength(0)
    expect(await messages()).toHaveLength(0)
  })

  it("conversation?after= returns only newer messages; no cookie → 404 and no rate-limit row", async () => {
    const { cookie, view } = await begin()
    const post = await chatRequest("/messages", {
      method: "POST",
      body: { body: "second" },
      cookie,
    })
    expect(post.status).toBe(201)
    const newer = await chatRequest(`/conversation?after=${view.lastId}`, {
      cookie,
    })
    expect(newer.status).toBe(200)
    const body = await newer.json()
    expect(body.messages.map((m: { body: string }) => m.body)).toEqual([
      "second",
    ])
    expect(body.lastId).toBeGreaterThan(view.lastId)
    const all = await (await chatRequest("/conversation", { cookie })).json()
    expect(all.messages).toHaveLength(2)

    await getDb().delete(rateLimits)
    const none = await chatRequest("/conversation")
    expect(none.status).toBe(404)
    expect(await getDb().select().from(rateLimits)).toHaveLength(0)
    const bogus = await chatRequest("/conversation", {
      cookie: "cp_chat=bogus",
    })
    expect(bogus.status).toBe(404)
  })

  it("send on a closed chat → 409; over 20/min per IP → 429 with Retry-After", async () => {
    const ip = freshIp()
    const { cookie } = await begin(ip)
    for (let i = 0; i < 20; i++) {
      const r = await chatRequest("/messages", {
        method: "POST",
        body: { body: `message ${i}` },
        cookie,
        ip,
      })
      expect(r.status).toBe(201)
    }
    const limited = await chatRequest("/messages", {
      method: "POST",
      body: { body: "one too many" },
      cookie,
      ip,
    })
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0)

    const end = await chatRequest("/end", { method: "POST", cookie })
    expect(end.status).toBe(200)
    const closed = await chatRequest("/messages", {
      method: "POST",
      body: { body: "hello?" },
      cookie,
    })
    expect(closed.status).toBe(409)
    const ended = (await messages()).filter((m) => m.sender === "system")
    expect(ended.map((m) => m.body)).toEqual([
      CHAT_SETTINGS_DEFAULT.notices.ended,
    ])
    // Ending again adds no second notice.
    await chatRequest("/end", { method: "POST", cookie })
    expect(
      (await messages()).filter((m) => m.sender === "system")
    ).toHaveLength(1)
  })

  it("start refuses a cross-origin request (403)", async () => {
    const res = await chatRequest("/start", {
      method: "POST",
      body: startBody(),
      origin: "https://evil.example",
    })
    expect(res.status).toBe(403)
    expect(await conversations()).toHaveLength(0)
  })

  it("a start that fails Turnstile does not spend the site-wide start quota", async () => {
    await saveTurnstile(
      encryptSecret("turnstile-secret", "integrations.turnstile.secretKey")
    )
    turnstile.verify.mockResolvedValue(false)
    const bad = await chatRequest("/start", {
      method: "POST",
      body: startBody({ turnstileToken: "bad" }),
    })
    expect(bad.status).toBe(422)
    const site = await getDb()
      .select()
      .from(publicRateLimits)
      .where(eq(publicRateLimits.key, "chat:start:site"))
    expect(site).toHaveLength(0)

    turnstile.verify.mockResolvedValue(true)
    await begin()
    const [row] = await getDb()
      .select()
      .from(publicRateLimits)
      .where(eq(publicRateLimits.key, "chat:start:site"))
    expect(row?.count).toBe(1)
  })

  it("turnstile on: a bad token → 422 with fieldErrors.turnstileToken; unreadable settings → allowed", async () => {
    await saveTurnstile(
      encryptSecret("turnstile-secret", "integrations.turnstile.secretKey")
    )
    const status = await (await chatRequest("/status")).json()
    expect(status.turnstileSiteKey).toBe("0x4AAAAAAAtestsitekey")

    turnstile.verify.mockResolvedValue(false)
    const bad = await chatRequest("/start", {
      method: "POST",
      body: startBody({ turnstileToken: "bad" }),
    })
    expect(bad.status).toBe(422)
    const err = await bad.json()
    expect(err.error.code).toBe("VALIDATION_FAILED")
    expect(err.error.fieldErrors.turnstileToken).toBeDefined()
    expect(turnstile.verify).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "turnstile-secret", token: "bad" })
    )
    expect(await conversations()).toHaveLength(0)

    turnstile.verify.mockResolvedValue(true)
    const { cookie } = await begin()
    // An existing chat is not checked again.
    turnstile.verify.mockClear()
    const again = await chatRequest("/start", {
      method: "POST",
      body: startBody({ message: "More" }),
      cookie,
    })
    expect(again.status).toBe(201)
    expect(turnstile.verify).not.toHaveBeenCalled()

    // A secret that no longer decrypts: logged, the check is skipped.
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    await getDb()
      .update(settings)
      .set({
        draft: {
          enabled: true,
          siteKey: "0x4AAAAAAAtestsitekey",
          secretKey: "v1:not:a:secret",
        },
      })
      .where(eq(settings.key, "integrations.turnstile"))
    turnstile.verify.mockResolvedValue(false)
    const unreadable = await chatRequest("/start", {
      method: "POST",
      body: startBody(),
    })
    expect(unreadable.status).toBe(201)
    expect(turnstile.verify).not.toHaveBeenCalled()
    expect(await conversations()).toHaveLength(2)
    expect(error.mock.calls.map((c) => String(c[0])).join("\n")).toContain(
      "[chat] Turnstile settings could not be read"
    )
    const st = await (await chatRequest("/status")).json()
    expect(st.turnstileSiteKey).toBeNull()
  })

  it("email saves lower-cased on an open chat; 409 when closed", async () => {
    const { cookie, view } = await begin()
    expect(view.hasEmail).toBe(false)
    const res = await chatRequest("/email", {
      method: "POST",
      body: { email: "  Aoife@Example.COM " },
      cookie,
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const after = await (await chatRequest("/conversation", { cookie })).json()
    expect(after.hasEmail).toBe(true)
    const [row] = await conversations()
    expect(row!.visitorEmail).toBe("aoife@example.com")

    const invalid = await chatRequest("/email", {
      method: "POST",
      body: { email: "not-an-email" },
      cookie,
    })
    expect(invalid.status).toBe(422)

    await chatRequest("/end", { method: "POST", cookie })
    const closed = await chatRequest("/email", {
      method: "POST",
      body: { email: "b@example.com" },
      cookie,
    })
    expect(closed.status).toBe(409)
  })

  it("status reports online when a chat:reply user touched presence in the last 120 s", async () => {
    const offline = await chatRequest("/status")
    expect(offline.status).toBe(200)
    expect(await offline.json()).toEqual({
      online: false,
      botActive: false,
      turnstileSiteKey: null,
    })

    const user = await createUser({ roles: ["intake"] })
    await touchPresence(user.id)
    expect((await (await chatRequest("/status")).json()).online).toBe(true)

    // Seen 121 s ago: outside the window.
    await getDb()
      .update(chatPresence)
      .set({ seenAt: sql`now() - interval '121 seconds'` })
    expect((await (await chatRequest("/status")).json()).online).toBe(false)
  })
})
