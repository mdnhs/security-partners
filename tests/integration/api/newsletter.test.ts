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
const deferred = vi.hoisted(() => ({
  tasks: [] as Promise<unknown>[],
  outside: false,
}))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    if (deferred.outside)
      throw new Error("`after` was called outside a request scope")
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))
const drain = async () => {
  await Promise.allSettled(deferred.tasks.splice(0))
}

import type { Role } from "@/lib/auth/roles"
import { ROLES } from "@/lib/auth/roles"
import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import type { NewsletterSettings } from "@/lib/schemas/settings/newsletter"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { auditLog, newsletterSubscribers, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import type { Actor } from "@/server/lib/actor"
import { RECURRING_JOBS } from "@/server/lib/jobs"
import { purgeNewsletterJob } from "@/server/lib/jobs/purge-newsletter"
import { mailer } from "@/server/lib/mailer"
import {
  CONFIRM_TTL_MS,
  findSubscriberByEmail,
  purgeStalePending,
  readUnsubscribeToken,
  RESEND_COOLDOWN_MS,
  RESEND_DAILY_CAP,
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

function tokenPost(
  path: "/confirm" | "/unsubscribe",
  token: string,
  form = false,
  ip = freshIp()
) {
  return app.request(`/api/v1/public/newsletter${path}`, {
    method: "POST",
    headers: {
      "content-type": form
        ? "application/x-www-form-urlencoded"
        : "application/json",
      "x-forwarded-for": ip,
    },
    body: form
      ? new URLSearchParams({ token }).toString()
      : JSON.stringify({ token }),
  })
}
const unsubscribePost = (token: string, form = false) =>
  tokenPost("/unsubscribe", token, form)
const confirmPost = (token: string, form = false) =>
  tokenPost("/confirm", token, form)

const actorWith = (roles: Role[]): Actor => ({
  userId: "00000000-0000-7000-8000-000000000000",
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})

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
    // The mail opens the confirm view (a page with a POST button), never an
    // endpoint that changes state.
    expect(new URL(confirmUrl).pathname).toBe("/newsletter/confirm")
    expect(unsubscribeUrl).toContain("/newsletter/unsubscribe?token=")
    const token = tokenOf(mail)
    expect(Buffer.from(token, "base64url")).toHaveLength(32)
    expect(row.tokenHash).not.toBe(token)
    expect(row.tokenHash).toBe(createHash("sha256").update(token).digest("hex"))
    expect(row.tokenExpiresAt!.getTime() - row.createdAt.getTime()).toBeCloseTo(
      7 * 86_400_000,
      -4
    )
    expect(row.ipHash).toEqual(expect.any(String))
  })

  it("confirms by POST only: GET is side-effect free, POST confirms once", async () => {
    await subscribe({ email: "click@example.ie" })
    await drain()
    const token = tokenOf(sent()[0])

    // A link scanner pre-fetching the API GET changes nothing: it only
    // redirects to the confirm view.
    const get = await publicGet(`/confirm?token=${token}`)
    expect(get.status).toBe(303)
    const location = new URL(get.headers.get("location")!, "http://x")
    expect(location.pathname).toBe("/newsletter/confirm")
    expect(location.searchParams.get("token")).toBe(token)
    expect(get.headers.get("referrer-policy")).toBe("no-referrer")
    const [stillPending] = await rows()
    expect(stillPending).toMatchObject({ status: "pending", confirmedAt: null })
    expect(stillPending.tokenHash).not.toBeNull()

    // The view's button POSTs the token (form), or JSON.
    const ok = await confirmPost(token, true)
    expect(ok.status).toBe(303)
    expect(ok.headers.get("location")).toBe("/newsletter/confirmed")
    const [after] = await rows()
    expect(after).toMatchObject({
      status: "confirmed",
      tokenHash: null,
      tokenExpiresAt: null,
      ipHash: null,
    })
    expect(after.confirmedAt).toBeInstanceOf(Date)

    // Replay: single use.
    const again = await confirmPost(token)
    expect(again.status).toBe(303)
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
    // wait@ is inside the resend cooldown, so only the new address is mailed.
    expect(sent().map((m) => m.to)).toEqual(["x@example.ie"])
    const done = (await rows()).find((r) => r.email === "done@example.ie")!
    expect(done).toMatchObject({ status: "confirmed", tokenHash: null })
  })

  it("does not re-mail a pending address inside the resend cooldown", async () => {
    const t0 = Date.now()
    await subscribe({ email: "bomb@example.ie" })
    await drain()
    const [first] = await rows()
    expect(sent()).toHaveLength(1)

    vi.useFakeTimers({
      now: t0 + RESEND_COOLDOWN_MS - 60_000,
      toFake: ["Date"],
    })
    const res = await subscribe({ email: "bomb@example.ie" })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ ok: true })
    await drain()
    expect(sent()).toHaveLength(1)
    const [same] = await rows()
    // The first link still works: the token was not rotated.
    expect(same.tokenHash).toBe(first.tokenHash)
    expect(same.updatedAt).toEqual(first.updatedAt)

    vi.useFakeTimers({
      now: t0 + RESEND_COOLDOWN_MS + 60_000,
      toFake: ["Date"],
    })
    expect((await subscribe({ email: "bomb@example.ie" })).status).toBe(201)
    await drain()
    expect(sent()).toHaveLength(2)
    const [rotated] = await rows()
    expect(rotated.tokenHash).not.toBe(first.tokenHash)
  })

  it("mails one address at most 3 times per 24 h, cooldown or not", async () => {
    const t0 = Date.now()
    const at = (ms: number) =>
      vi.useFakeTimers({ now: t0 + ms, toFake: ["Date"] })
    const step = RESEND_COOLDOWN_MS + 60_000
    for (let i = 0; i < 3; i++) {
      at(i * step)
      expect((await subscribe({ email: "cap@example.ie" })).status).toBe(201)
      await drain()
    }
    expect(sent()).toHaveLength(3)
    const [third] = await rows()

    // Past the cooldown but over the daily cap: same 201, no mail, and the
    // last link keeps working (the token is not rotated).
    at(3 * step)
    const capped = await subscribe({ email: "cap@example.ie" })
    expect(capped.status).toBe(201)
    expect(await capped.json()).toEqual({ ok: true })
    await drain()
    expect(sent()).toHaveLength(3)
    const [kept] = await rows()
    expect(kept.tokenHash).toBe(third.tokenHash)
    expect(kept.updatedAt).toEqual(third.updatedAt)

    // Another address is not affected by this one's cap.
    expect((await subscribe({ email: "other@example.ie" })).status).toBe(201)
    await drain()
    expect(sent().at(-1)?.to).toBe("other@example.ie")

    // A day after the first mail the address can be mailed again.
    at(RESEND_DAILY_CAP.windowMs + 60_000)
    expect((await subscribe({ email: "cap@example.ie" })).status).toBe(201)
    await drain()
    expect(sent().filter((m) => m.to === "cap@example.ie")).toHaveLength(4)
  })

  it("expires confirm tokens after 7 days (row stays pending)", async () => {
    await subscribe({ email: "late@example.ie" })
    await drain()
    const token = tokenOf(sent()[0])
    vi.useFakeTimers({ now: Date.now() + 8 * 86_400_000, toFake: ["Date"] })
    const res = await confirmPost(token)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("/newsletter/invalid")
    expect((await rows())[0].status).toBe("pending")
  })

  it("rejects missing, junk and oversized confirm tokens", async () => {
    for (const query of ["", "?token=", `?token=${"a".repeat(500)}`]) {
      const res = await publicGet(`/confirm${query}`)
      expect(res.status).toBe(303)
      expect(res.headers.get("location")).toBe("/newsletter/invalid")
    }
    for (const token of ["", "junk", "a".repeat(500)]) {
      const res = await confirmPost(token)
      expect(res.status).toBe(303)
      expect(res.headers.get("location")).toBe("/newsletter/invalid")
    }
    const malformed = await app.request("/api/v1/public/newsletter/confirm", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": freshIp(),
      },
      body: "{not json",
    })
    expect(malformed.headers.get("location")).toBe("/newsletter/invalid")
  })

  it("rate limits confirm and unsubscribe per IP (30 per 10 minutes)", async () => {
    for (const path of ["/confirm", "/unsubscribe"] as const) {
      const ip = path === "/confirm" ? "198.18.1.1" : "198.18.1.2"
      for (let i = 0; i < 30; i++)
        expect((await tokenPost(path, "junk", false, ip)).status).toBe(303)
      const limited = await tokenPost(path, "junk", false, ip)
      expect(limited.status).toBe(429)
      expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0)
    }
  })

  it("unsubscribes by POST only; a forged token answers the same", async () => {
    const [row] = await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "bye@example.ie", status: "confirmed", ipHash: "h" })
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
    expect(after.ipHash).toBeNull()
  })

  it("confirms directly when doubleOptIn is off; honeypot is silent", async () => {
    await patchNewsletter({ doubleOptIn: false })
    expect((await subscribe({ email: "direct@example.ie" })).status).toBe(201)
    await drain()
    const [row] = await rows()
    expect(row).toMatchObject({
      status: "confirmed",
      tokenHash: null,
      ipHash: null,
    })
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
        confirmedAt: new Date("2025-06-01T00:00:00Z"),
        unsubscribedAt,
      })
      .returning()
    await subscribe({ email: "back@example.ie" })
    await drain()
    const [after] = await rows()
    expect(after.id).toBe(row.id)
    expect(after.status).toBe("pending")
    // Re-pending: no stale confirmation date on an unconsented row.
    expect(after.confirmedAt).toBeNull()
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
    const byEmail = await subscribe({ email: "SAME@example.ie" })
    expect(byEmail.status).toBe(429)
    expect(byEmail.headers.get("cache-control")).toBe("no-store")
    const retryAfter = Number(byEmail.headers.get("retry-after"))
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(600)
    expect((await byEmail.json()).error.code).toBe("RATE_LIMITED")
    await drain()
  })

  it("warns when the post-response hook is unavailable and the mail runs detached", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    // Outside a request scope next/server's `after` throws.
    deferred.outside = true
    try {
      expect((await subscribe({ email: "detached@example.ie" })).status).toBe(
        201
      )
    } finally {
      deferred.outside = false
    }
    await vi.waitFor(() => expect(sent()).toHaveLength(1))
    expect(warn.mock.calls.flat().join("\n")).toMatch(
      /\[newsletter\].*after\(\).*detached/
    )
    expect(warn.mock.calls.flat().join("\n")).not.toContain("detached@")
  })
})

describe("admin /api/v1/admin/newsletter", () => {
  // [GET /, GET /export.csv (confirmed), GET /export.csv?status=all, DELETE /:id]
  // "all" includes pending (unconsented) and unsubscribed addresses: owner/admin only.
  const MATRIX: Record<Role, [number, number, number, number]> = {
    owner: [200, 200, 200, 200],
    admin: [200, 200, 200, 200],
    marketer: [200, 200, 403, 403],
    editor: [403, 403, 403, 403],
    author: [403, 403, 403, 403],
    intake: [403, 403, 403, 403],
    viewer: [403, 403, 403, 403],
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
      (await adminRequest("/newsletter/export.csv?status=all", { cookie }))
        .status,
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

    it("exports confirmed by default (marketer), all only for owner/admin; guards formulas; audits", async () => {
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

      const denied = await adminRequest("/newsletter/export.csv?status=all", {
        cookie: marketer,
      })
      expect(denied.status).toBe(403)
      expect(await denied.text()).not.toContain("b@example.ie")

      const allCsv = await (
        await adminRequest("/newsletter/export.csv?status=all", {
          cookie: admin,
        })
      ).text()
      expect(allCsv).toContain("b@example.ie")
      expect(allCsv).toContain("c@other.ie")

      const audits = await getDb()
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "newsletter.exported"))
      // The refused export is not audited as an export.
      expect(audits).toHaveLength(2)
      expect(JSON.stringify(audits)).not.toContain("@example.ie")
    })

    it("findSubscriberByEmail requires newsletter:read", async () => {
      await expect(
        findSubscriberByEmail(actorWith(["editor"]), "a@example.ie")
      ).rejects.toMatchObject({ code: "FORBIDDEN" })
      await expect(
        findSubscriberByEmail(actorWith(["marketer"]), " A@Example.ie ")
      ).resolves.toMatchObject({ email: "a@example.ie", status: "confirmed" })
      await expect(
        findSubscriberByEmail(actorWith(["owner"]), "nobody@example.ie")
      ).resolves.toBeNull()
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

  it("measures pendingDays from created_at (not token expiry); a re-pended row counts from its new link", async () => {
    const now = new Date("2026-10-19T12:00:00Z")
    const ago = (days: number) => new Date(now.getTime() - days * 86_400_000)
    const pending = (email: string, createdAt: Date, issuedAt = createdAt) => ({
      email,
      status: "pending" as const,
      tokenHash: `hash-${email}`,
      tokenExpiresAt: new Date(issuedAt.getTime() + CONFIRM_TTL_MS),
      createdAt,
      updatedAt: issuedAt,
    })
    await getDb()
      .insert(newsletterSubscribers)
      .values([
        // Token expired 24 days ago, created 31 days ago: stale.
        pending("stale@example.ie", ago(31)),
        pending("young@example.ie", ago(29)),
        // Unsubscribed long ago, re-subscribed yesterday: its link is live.
        pending("again@example.ie", ago(400), ago(1)),
      ])
    expect(await purgeStalePending(now)).toBe(1)
    expect((await rows()).map((r) => r.email).sort()).toEqual([
      "again@example.ie",
      "young@example.ie",
    ])
  })
})

describe("purge-newsletter job (D4.3)", () => {
  it("is a daily recurring job that removes stale pending rows only", async () => {
    expect(RECURRING_JOBS.map((j) => j.key)).toContain("purge-newsletter")
    expect(purgeNewsletterJob.everyMs).toBe(24 * 60 * 60_000)
    const now = new Date("2026-10-19T12:00:00Z")
    const old = new Date(now.getTime() - 60 * 86_400_000)
    const fresh = new Date(now.getTime() - 86_400_000)
    await getDb()
      .insert(newsletterSubscribers)
      .values([
        {
          email: "stale@example.ie",
          status: "pending",
          createdAt: old,
          updatedAt: old,
        },
        {
          email: "new@example.ie",
          status: "pending",
          createdAt: fresh,
          updatedAt: fresh,
        },
        {
          email: "yes@example.ie",
          status: "confirmed",
          createdAt: old,
          updatedAt: old,
        },
        {
          email: "gone@example.ie",
          status: "unsubscribed",
          createdAt: old,
          updatedAt: old,
        },
      ])
    expect(await purgeNewsletterJob.run({ now, payload: null })).toEqual({})
    expect((await rows()).map((r) => r.email).sort()).toEqual([
      "gone@example.ie",
      "new@example.ie",
      "yes@example.ie",
    ])
  })

  it("warns (and purges nothing) while settings.newsletter is unpublished", async () => {
    await getDb()
      .update(settings)
      .set({ published: null })
      .where(eq(settings.key, "newsletter"))
    expect(
      await purgeNewsletterJob.run({ now: new Date(), payload: null })
    ).toEqual({
      warning: "settings.newsletter is not published; no sign-ups purged",
    })
  })
})

describe("privacy helper (lead CSV-by-email, D4.3)", () => {
  // [POST /lookup, POST /erase]
  const MATRIX: Record<Role, [number, number]> = {
    owner: [200, 200],
    admin: [200, 200],
    marketer: [200, 403],
    editor: [403, 403],
    author: [403, 403],
    intake: [403, 403],
    viewer: [403, 403],
  }

  it.each(ROLES)("RBAC for %s", async (role) => {
    const { cookie } = await signedInUser([role])
    await getDb()
      .insert(newsletterSubscribers)
      .values({ email: `${role}-p@example.ie`, status: "confirmed" })
    const json = { email: `${role}-p@example.ie` }
    expect([
      (
        await adminRequest("/newsletter/lookup", {
          cookie,
          method: "POST",
          json,
        })
      ).status,
      (
        await adminRequest("/newsletter/erase", {
          cookie,
          method: "POST",
          json,
        })
      ).status,
    ]).toEqual(MATRIX[role])
  })

  it("looks an address up case-insensitively and erases it with an audit entry", async () => {
    const { cookie } = await signedInUser(["admin"])
    const [row] = await getDb()
      .insert(newsletterSubscribers)
      .values({ email: "ann@example.ie", status: "confirmed" })
      .returning()
    const lookup = async (email: string) => {
      const res = await adminRequest("/newsletter/lookup", {
        cookie,
        method: "POST",
        json: { email },
      })
      return (await res.json()) as { subscriber: unknown }
    }
    expect(await lookup(" Ann@Example.IE ")).toEqual({
      subscriber: expect.objectContaining({
        id: row.id,
        email: "ann@example.ie",
        status: "confirmed",
      }),
    })
    expect(await lookup("nobody@example.ie")).toEqual({ subscriber: null })

    const erased = await adminRequest("/newsletter/erase", {
      cookie,
      method: "POST",
      json: { email: "ANN@example.ie" },
    })
    expect(erased.status).toBe(200)
    expect(await erased.json()).toEqual({ erased: 1 })
    expect(await rows()).toEqual([])
    const audits = await getDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "newsletter.deleted"))
    expect(audits).toHaveLength(1)
    expect(JSON.stringify(audits[0])).not.toContain("ann@example.ie")
    expect(await lookup("ann@example.ie")).toEqual({ subscriber: null })
  })

  it("rejects a malformed address with 422", async () => {
    const { cookie } = await signedInUser(["admin"])
    const res = await adminRequest("/newsletter/lookup", {
      cookie,
      method: "POST",
      json: { email: "not-an-email" },
    })
    expect(res.status).toBe(422)
  })
})

describe("dashboard KPI subscribers (D4.3)", () => {
  const kpi = async (roles: Role[]) => {
    const { cookie } = await signedInUser(roles)
    const res = await adminRequest("/dashboard", { cookie })
    return ((await res.json()) as DashboardDto).kpis.subscribers
  }

  it("shows confirmed subscribers to newsletter readers while a placement is on", async () => {
    const now = Date.now()
    await getDb()
      .insert(newsletterSubscribers)
      .values([
        {
          email: "a@example.ie",
          status: "confirmed",
          confirmedAt: new Date(now - 86_400_000),
        },
        {
          email: "b@example.ie",
          status: "confirmed",
          confirmedAt: new Date(now - 60 * 86_400_000),
        },
        { email: "c@example.ie", status: "pending" },
      ])
    expect(await kpi(["marketer"])).toEqual({ confirmed: 2, since30d: 1 })
    expect(await kpi(["editor"])).toBeNull()
    expect(await kpi(["viewer"])).toBeNull()
  })

  it("placement off: hidden at 0 confirmed, shown once there are some", async () => {
    await patchNewsletter({ placement: "off" })
    expect(await kpi(["admin"])).toBeNull()
    await getDb().insert(newsletterSubscribers).values({
      email: "a@example.ie",
      status: "confirmed",
      confirmedAt: new Date(),
    })
    expect(await kpi(["admin"])).toEqual({ confirmed: 1, since30d: 1 })
  })

  it("placement on: shown at 0", async () => {
    expect(await kpi(["owner"])).toEqual({ confirmed: 0, since30d: 0 })
  })
})
