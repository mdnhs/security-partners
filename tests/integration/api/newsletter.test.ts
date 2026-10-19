import { createHash } from "node:crypto"

import { eq } from "drizzle-orm"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest"

// Confirmation mail runs after the response (next/server `after`): collect
// the deferred tasks so a test can wait for them.
const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))
const drain = async () => {
  await Promise.allSettled(deferred.tasks.splice(0))
}

import type { Role } from "@/lib/auth/roles"
import { ROLES } from "@/lib/auth/roles"
import type { NewsletterSettings } from "@/lib/schemas/settings/newsletter"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, newsletterSubscribers, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { mailer } from "@/server/lib/mailer"
import {
  purgeStalePending,
  readUnsubscribeToken,
  unsubscribeToken,
} from "@/server/modules/newsletter/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let ipCounter = 0
const freshIp = () => `203.0.113.${++ipCounter % 250}`

function subscribe(body: Record<string, unknown>, ip = freshIp()) {
  return app.request("/api/v1/public/newsletter", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ sourcePath: "/blog", ...body }),
  })
}

function publicGet(path: string) {
  return app.request(`/api/v1/public/newsletter${path}`, {
    headers: { "x-forwarded-for": freshIp() },
  })
}

function unsubscribePost(token: string, form = false) {
  return app.request("/api/v1/public/newsletter/unsubscribe", {
    method: "POST",
    headers: {
      "content-type": form
        ? "application/x-www-form-urlencoded"
        : "application/json",
      "x-forwarded-for": freshIp(),
    },
    body: form
      ? new URLSearchParams({ token }).toString()
      : JSON.stringify({ token }),
  })
}

async function patchNewsletter(patch: Partial<NewsletterSettings>) {
  const [row] = await getDb()
    .select()
    .from(settings)
    .where(eq(settings.key, "newsletter"))
  const value = { ...(row.published as NewsletterSettings), ...patch }
  await getDb()
    .update(settings)
    .set({ draft: value, published: value })
    .where(eq(settings.key, "newsletter"))
}

const rows = () => getDb().select().from(newsletterSubscribers)

type SendArg = Parameters<typeof mailer.send>[0]
let send: MockInstance<typeof mailer.send>
const sent = (): SendArg[] => send.mock.calls.map((c) => c[0])
const props = (m: SendArg) =>
  m.react.props as { confirmUrl: string; unsubscribeUrl: string }
const tokenOf = (m: SendArg) =>
  new URL(props(m).confirmUrl).searchParams.get("token")!

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  await patchNewsletter({ placement: "blog" })
  deferred.tasks.length = 0
  send = vi.spyOn(mailer, "send").mockResolvedValue({ delivered: true })
  vi.spyOn(console, "info").mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("POST /api/v1/public/newsletter (double opt-in)", () => {
  it("creates a pending row with a hashed token and mails a confirm link", async () => {
    const res = await subscribe({ email: "new@example.ie" })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    await drain()

    const [row] = await rows()
    expect(row).toMatchObject({
      email: "new@example.ie",
      status: "pending",
      sourcePath: "/blog",
      confirmedAt: null,
    })
    expect(sent()).toHaveLength(1)
    const mail = sent()[0]
    expect(mail).toMatchObject({
      to: "new@example.ie",
      template: "newsletter-confirmation",
    })
    const { confirmUrl, unsubscribeUrl } = props(mail)
    expect(confirmUrl).toContain("/api/v1/public/newsletter/confirm?token=")
    expect(unsubscribeUrl).toContain("/newsletter/unsubscribe?token=")
    const token = tokenOf(mail)
    expect(Buffer.from(token, "base64url")).toHaveLength(32)
    expect(row.tokenHash).not.toBe(token)
    expect(row.tokenHash).toBe(createHash("sha256").update(token).digest("hex"))
    expect(row.tokenExpiresAt!.getTime() - row.createdAt.getTime()).toBeCloseTo(
      7 * 86_400_000,
      -4
    )

    const url = new URL(confirmUrl)
    const ok = await app.request(url.pathname + url.search)
    expect(ok.status).toBe(303)
    expect(ok.headers.get("location")).toBe("/newsletter/confirmed")
    const [after] = await rows()
    expect(after).toMatchObject({ status: "confirmed", tokenHash: null })
    expect(after.confirmedAt).toBeInstanceOf(Date)

    // Single use: a second click is invalid.
    const again = await app.request(url.pathname + url.search)
    expect(again.headers.get("location")).toBe("/newsletter/invalid")
  })

  it("answers identically for new, pending and confirmed and never re-mails a confirmed one", async () => {
    await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "done@example.ie", status: "confirmed" })
    await subscribe({ email: "wait@example.ie" })
    await drain()
    send.mockClear()

    const answers = []
    for (const email of [
      "done@example.ie",
      "wait@example.ie",
      "x@example.ie",
    ]) {
      const res = await subscribe({ email })
      answers.push([res.status, await res.json()])
    }
    expect(answers).toEqual([
      [201, { ok: true }],
      [201, { ok: true }],
      [201, { ok: true }],
    ])
    await drain()
    expect(sent().map((m) => m.to)).toEqual(["wait@example.ie", "x@example.ie"])
    const done = (await rows()).find((r) => r.email === "done@example.ie")!
    expect(done).toMatchObject({ status: "confirmed", tokenHash: null })
  })

  it("expires confirm tokens after 7 days (row stays pending)", async () => {
    await subscribe({ email: "late@example.ie" })
    await drain()
    const token = tokenOf(sent()[0])
    vi.useFakeTimers({ now: Date.now() + 8 * 86_400_000, toFake: ["Date"] })
    const res = await publicGet(`/confirm?token=${token}`)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/newsletter/invalid")
    expect((await rows())[0].status).toBe("pending")
  })

  it("rejects missing, junk and oversized confirm tokens", async () => {
    for (const query of [
      "",
      "?token=",
      "?token=junk",
      `?token=${"a".repeat(500)}`,
    ]) {
      const res = await publicGet(`/confirm${query}`)
      expect(res.status).toBe(303)
      expect(res.headers.get("location")).toBe("/newsletter/invalid")
    }
  })

  it("unsubscribes by POST only; a forged token answers the same", async () => {
    const [row] = await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "bye@example.ie", status: "confirmed" })
      .returning()
    const token = unsubscribeToken(row.id)
    expect(token).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]{32}$/)
    expect(readUnsubscribeToken(token)).toBe(row.id)

    const forged = await unsubscribePost(`${row.id}.${"A".repeat(32)}`)
    const garbage = await unsubscribePost("nonsense")
    for (const res of [forged, garbage]) {
      expect(res.status).toBe(303)
      expect(res.headers.get("location")).toBe("/newsletter/unsubscribed")
    }
    expect((await rows())[0].status).toBe("confirmed")

    // GET never unsubscribes (link scanners).
    expect((await publicGet(`/unsubscribe?token=${token}`)).status).toBe(404)
    expect((await rows())[0].status).toBe("confirmed")

    const real = await unsubscribePost(token, true)
    expect(real.status).toBe(303)
    expect(real.headers.get("location")).toBe("/newsletter/unsubscribed")
    const [after] = await rows()
    expect(after.status).toBe("unsubscribed")
    expect(after.unsubscribedAt).toBeInstanceOf(Date)
  })

  it("confirms directly when doubleOptIn is off; honeypot is silent", async () => {
    await patchNewsletter({ doubleOptIn: false })
    expect((await subscribe({ email: "direct@example.ie" })).status).toBe(201)
    await drain()
    const [row] = await rows()
    expect(row).toMatchObject({ status: "confirmed", tokenHash: null })
    expect(send).not.toHaveBeenCalled()

    const bot = await subscribe({ email: "bot@example.ie", website: "x" })
    expect(bot.status).toBe(201)
    expect(await bot.json()).toEqual({ ok: true })
    expect(await rows()).toHaveLength(1)
  })

  it("normalises case/whitespace", async () => {
    await subscribe({ email: " Ann@Example.IE " })
    await subscribe({ email: "ann@example.ie" })
    await drain()
    const all = await rows()
    expect(all).toHaveLength(1)
    expect(all[0].email).toBe("ann@example.ie")
    // The DB itself refuses a mixed-case address.
    await expect(
      getDb()
        .insert(newsletterSubscribers)
        .values({ email: "Mixed@Example.ie", status: "pending" })
    ).rejects.toThrow()
  })

  it("re-subscribe after unsubscribe → pending with new token, unsubscribed_at kept", async () => {
    const unsubscribedAt = new Date("2026-01-01T00:00:00Z")
    const [row] = await getDb()
      .insert(newsletterSubscribers)
      .values({
        email: "back@example.ie",
        status: "unsubscribed",
        unsubscribedAt,
      })
      .returning()
    await subscribe({ email: "back@example.ie" })
    await drain()
    const [after] = await rows()
    expect(after.id).toBe(row.id)
    expect(after.status).toBe("pending")
    expect(after.tokenHash).toBe(
      createHash("sha256").update(tokenOf(sent()[0])).digest("hex")
    )
    expect(after.unsubscribedAt).toEqual(unsubscribedAt)

    const { cookie } = await signedInUser(["admin"])
    const list = await adminRequest("/newsletter?status=unsubscribed", {
      cookie,
    })
    expect((await list.json()).total).toBe(0)
  })

  it("placement off → POST 404", async () => {
    await patchNewsletter({ placement: "off" })
    const res = await subscribe({ email: "nobody@example.ie" })
    expect(res.status).toBe(404)
    expect(await rows()).toHaveLength(0)
  })

  it("seeded settings keep the form off (placement off → 404)", async () => {
    await resetDb()
    await seedContent(getDb())
    expect((await subscribe({ email: "seed@example.ie" })).status).toBe(404)
  })

  it("SMTP unconfigured still 201", async () => {
    send.mockRestore()
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined)
    const res = await subscribe({ email: "nosmtp@example.ie" })
    expect(res.status).toBe(201)
    await drain()
    expect((await rows())[0].status).toBe("pending")
    const logs = [...info.mock.calls, ...error.mock.calls].flat().join("\n")
    expect(logs).toContain("newsletter-confirmation")
    expect(logs).not.toContain("nosmtp@")
  })

  it("validates the address and the source path", async () => {
    expect((await subscribe({ email: "not-an-email" })).status).toBe(422)
    expect(
      (await subscribe({ email: "a@example.ie", sourcePath: "//evil.test" }))
        .status
    ).toBe(422)
    expect(await rows()).toHaveLength(0)
  })

  it("rate limits 5 per 10 minutes per IP and per address", async () => {
    const ip = "198.18.0.1"
    for (let i = 0; i < 5; i++)
      expect((await subscribe({ email: `p${i}@example.ie` }, ip)).status).toBe(
        201
      )
    expect((await subscribe({ email: "p6@example.ie" }, ip)).status).toBe(429)

    for (let i = 0; i < 5; i++)
      expect((await subscribe({ email: "same@example.ie" })).status).toBe(201)
    expect((await subscribe({ email: "SAME@example.ie" })).status).toBe(429)
    await drain()
  })
})

describe("admin /api/v1/admin/newsletter", () => {
  // [GET /, GET /export.csv, DELETE /:id]
  const MATRIX: Record<Role, [number, number, number]> = {
    owner: [200, 200, 200],
    admin: [200, 200, 200],
    marketer: [200, 200, 403],
    editor: [403, 403, 403],
    author: [403, 403, 403],
    intake: [403, 403, 403],
    viewer: [403, 403, 403],
  }

  it.each(ROLES)("RBAC for %s", async (role) => {
    const { cookie } = await signedInUser([role])
    const [row] = await getDb()
      .insert(newsletterSubscribers)
      .values({ email: `${role}-s@example.ie`, status: "confirmed" })
      .returning()
    expect([
      (await adminRequest("/newsletter", { cookie })).status,
      (await adminRequest("/newsletter/export.csv", { cookie })).status,
      (
        await adminRequest(`/newsletter/${row.id}`, {
          cookie,
          method: "DELETE",
        })
      ).status,
    ]).toEqual(MATRIX[role])
  })

  it("401 without a session", async () => {
    expect((await adminRequest("/newsletter")).status).toBe(401)
  })

  describe("as marketer / admin", () => {
    let marketer: string
    let admin: string
    beforeEach(async () => {
      marketer = (await signedInUser(["marketer"])).cookie
      admin = (await signedInUser(["admin"])).cookie
      await getDb()
        .insert(newsletterSubscribers)
        .values([
          { email: "a@example.ie", status: "confirmed", sourcePath: "/blog" },
          { email: "b@example.ie", status: "pending" },
          { email: "c@other.ie", status: "unsubscribed" },
          {
            email: "=cmd@example.ie",
            status: "confirmed",
            sourcePath: "/blog/x",
          },
        ])
    })

    it("lists with status tabs and search", async () => {
      const all = await (
        await adminRequest("/newsletter", { cookie: marketer })
      ).json()
      expect(all.total).toBe(4)
      expect(all.items[0]).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          status: expect.any(String),
          sourcePath: expect.any(String),
          createdAt: expect.any(String),
        })
      )
      expect(all.items[0]).not.toHaveProperty("tokenHash")
      expect(all.items[0]).not.toHaveProperty("ipHash")
      const confirmed = await (
        await adminRequest("/newsletter?status=confirmed", { cookie: marketer })
      ).json()
      expect(confirmed.total).toBe(2)
      const search = await (
        await adminRequest("/newsletter?q=other", { cookie: marketer })
      ).json()
      expect(search.items.map((i: { email: string }) => i.email)).toEqual([
        "c@other.ie",
      ])
      const wildcard = await (
        await adminRequest("/newsletter?q=%25", { cookie: marketer })
      ).json()
      expect(wildcard.total).toBe(0)
      expect(
        (await adminRequest("/newsletter?status=bogus", { cookie: marketer }))
          .status
      ).toBe(422)
    })

    it("exports confirmed by default, all on request; guards formulas; audits", async () => {
      const res = await adminRequest("/newsletter/export.csv", {
        cookie: marketer,
      })
      expect(res.status).toBe(200)
      expect(res.headers.get("cache-control")).toBe("no-store")
      expect(res.headers.get("content-type")).toContain("text/csv")
      expect(res.headers.get("content-disposition")).toMatch(
        /^attachment; filename="subscribers-\d{4}-\d{2}-\d{2}\.csv"$/
      )
      const csv = await res.text()
      expect(csv).toContain("a@example.ie")
      expect(csv).toContain("'=cmd@example.ie")
      expect(csv).not.toContain("b@example.ie")
      expect(csv).not.toContain("c@other.ie")

      const allCsv = await (
        await adminRequest("/newsletter/export.csv?status=all", {
          cookie: marketer,
        })
      ).text()
      expect(allCsv).toContain("b@example.ie")
      expect(allCsv).toContain("c@other.ie")

      const audits = await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "newsletter.exported"))
      expect(audits).toHaveLength(2)
      expect(JSON.stringify(audits)).not.toContain("@example.ie")
    })

    it("admin deletes (audited); unknown id 404", async () => {
      const [row] = (await rows()).filter((r) => r.email === "b@example.ie")
      const res = await adminRequest(`/newsletter/${row.id}`, {
        cookie: admin,
        method: "DELETE",
      })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true })
      expect(await rows()).toHaveLength(3)
      const audits = await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "newsletter.deleted"))
      expect(audits).toHaveLength(1)
      expect(audits[0].entityId).toBe(row.id)
      expect(
        (
          await adminRequest(`/newsletter/${row.id}`, {
            cookie: admin,
            method: "DELETE",
          })
        ).status
      ).toBe(404)
    })
  })
})

describe("retention", () => {
  it("purges pending rows older than pendingDays, never confirmed ones", async () => {
    const now = new Date("2026-10-19T12:00:00Z")
    const old = new Date(now.getTime() - 31 * 86_400_000)
    const fresh = new Date(now.getTime() - 2 * 86_400_000)
    await getDb()
      .insert(newsletterSubscribers)
      .values([
        {
          email: "old@example.ie",
          status: "pending",
          updatedAt: old,
          createdAt: old,
        },
        {
          email: "fresh@example.ie",
          status: "pending",
          updatedAt: fresh,
          createdAt: fresh,
        },
        {
          email: "kept@example.ie",
          status: "confirmed",
          updatedAt: old,
          createdAt: old,
        },
      ])
    expect(await purgeStalePending(now)).toBe(1)
    expect((await rows()).map((r) => r.email).sort()).toEqual([
      "fresh@example.ie",
      "kept@example.ie",
    ])
  })
})
