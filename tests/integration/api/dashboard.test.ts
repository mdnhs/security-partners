import { eq, isNotNull } from "drizzle-orm"
import { Client } from "pg"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Outside Next there is no "use cache" scope: record the cache tags, and let
// a test make a cached content reader fail (review M2).
const { cacheTag, failing } = vi.hoisted(() => ({
  cacheTag: vi.fn(),
  failing: { seo: false, qa: false },
}))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheLife: vi.fn(),
  cacheTag,
}))
vi.mock("@/server/modules/dashboard/content-review", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/server/modules/dashboard/content-review")
    >()
  return {
    ...actual,
    cachedSeoHealth: () =>
      failing.seo
        ? Promise.reject(new TypeError("settings row no longer parses"))
        : actual.cachedSeoHealth(),
    cachedQa: (scope: Parameters<typeof actual.cachedQa>[0]) =>
      failing.qa
        ? Promise.reject(new Error("bad jsonb"))
        : actual.cachedQa(scope),
  }
})

import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import type { Actor } from "@/server/lib/actor"
import { getDb } from "@/server/db/client"
import { articles, builderPages, leads, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import {
  countLeadsFromDay,
  leadsFromDayQuery,
} from "@/server/modules/dashboard/repo"
import { getDashboard, trendDays } from "@/server/modules/dashboard/service"

import { resetDb, TEST_DATABASE_URL } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const DAY = 86_400_000

beforeEach(async () => {
  failing.seo = false
  failing.qa = false
  cacheTag.mockClear()
  await resetDb()
  await seedContent(getDb())
})

afterEach(() => {
  vi.restoreAllMocks()
})

const actorFor = (userId: string, roles: Actor["roles"]): Actor => ({
  userId,
  roles,
  ip: null,
  userAgent: null,
  impersonatorId: null,
})

async function dashboard(cookie: string) {
  const res = await adminRequest("/dashboard", { cookie })
  expect(res.status).toBe(200)
  return (await res.json()) as DashboardDto
}

describe("dashboard (master 4.7)", () => {
  it("counts leads (30 d vs the 30 d before, open) and published content", async () => {
    // Fixed clock: 15:00 GMT on Wednesday 28 Oct 2026.
    const now = Date.parse("2026-10-28T15:00:00Z")
    const lead = (
      daysAgo: number,
      status: "new" | "won" | "spam" | "contacted"
    ) => ({
      name: "N",
      email: "n@example.ie",
      message: "Hello",
      status,
      createdAt: new Date(now - daysAgo * DAY),
    })
    await getDb()
      .insert(leads)
      .values([
        lead(0, "new"),
        lead(1, "contacted"),
        lead(10, "won"),
        lead(40, "new"),
        lead(2, "spam"),
      ])
    // The 30-day figure is calendar-aligned (Europe/Dublin), like the trend:
    // noon UTC on the first day of the window counts, the day before does not.
    const [firstDay] = trendDays(new Date(now), 30)
    const dayBefore = trendDays(new Date(now), 31)[0]
    await getDb()
      .insert(leads)
      .values([
        { ...lead(0, "won"), createdAt: new Date(`${firstDay}T12:00:00Z`) },
        { ...lead(0, "won"), createdAt: new Date(`${dayBefore}T12:00:00Z`) },
      ])
    const { cookie, user } = await signedInUser(["admin"])
    // kpis.leads30d.previous counts the 30 Irish days before, cut on its
    // last day (28 Sep, the day before the window) at the same Irish time
    // as now, 15:00 (review M6): noon UTC (13:00 IST) that day and 40 days
    // ago count; 15:30 IST that day, 70 days ago and spam do not.
    const [firstPreviousDay] = trendDays(new Date(now), 60)
    expect(dayBefore).toBe("2026-09-28")
    await getDb()
      .insert(leads)
      .values([
        lead(70, "won"),
        lead(45, "spam"),
        {
          ...lead(0, "won"),
          createdAt: new Date(`${firstPreviousDay}T12:00:00Z`),
        },
        { ...lead(0, "won"), createdAt: new Date("2026-09-28T14:30:00Z") },
      ])
    const service = await getDashboard(
      actorFor(user.id, ["admin"]),
      new Date(now)
    )
    expect(service.kpis.leads30d).toEqual({ value: 4, previous: 3 })
    const dto = await dashboard(cookie)
    expect(dto.kpis.openLeads).toBe(3)
    expect(dto.kpis.published).toEqual({
      pages: 8,
      services: 6,
      articles: expect.any(Number),
    })
    expect(dto.kpis.published!.articles).toBeGreaterThan(0)
    expect(dto.kpis.inReview).toBe(0)
    expect(dto).not.toHaveProperty("leadsTrend")
  })

  it("Monday morning: previousToDate counts last week only up to the same weekday and Irish time (review I1)", async () => {
    const at = (iso: string) => ({
      name: "N",
      email: "n@example.ie",
      message: "Hello",
      createdAt: new Date(iso),
    })
    await getDb()
      .insert(leads)
      .values([
        at("2026-10-19T07:00:00Z"), // last Mon 08:00 IST: before the cut
        at("2026-10-19T08:30:00Z"), // last Mon 09:30 IST: after the cut
        at("2026-10-21T10:00:00Z"), // last Wed
        at("2026-10-26T08:00:00Z"), // this Mon 08:00 GMT
      ])
    const owner = await signedInUser(["owner"])
    // Monday 26 Oct, 09:15 GMT (summer time ended on Sunday).
    const dto = await getDashboard(
      actorFor(owner.user.id, ["owner"]),
      new Date("2026-10-26T09:15:00Z")
    )
    expect(dto.enquiriesWeek).toMatchObject({
      current: 1,
      previous: 3,
      previousToDate: 1,
    })
  })

  it("enquiriesWeek counts per Irish day, this week (Mon–Sun) vs last week", async () => {
    const at = (iso: string, status: "new" | "spam" = "new") => ({
      name: "N",
      email: "n@example.ie",
      message: "Hello",
      status,
      createdAt: new Date(iso),
    })
    await getDb()
      .insert(leads)
      .values([
        at("2026-10-18T22:59:59Z"), // Sun 18 Oct 23:59 IST: two weeks back
        at("2026-10-18T23:00:00Z"), // Mon 19 Oct 00:00 IST: last week, Mon
        at("2026-10-25T23:30:00Z"), // Sun 25 Oct 23:30 GMT: last week, Sun
        at("2026-10-26T00:00:00Z"), // Mon 26 Oct 00:00 GMT: this week, Mon
        at("2026-10-28T09:00:00Z"), // Wed: this week
        at("2026-10-28T10:00:00Z"), // Wed: this week
        at("2026-10-28T11:00:00Z", "spam"), // spam never counts
        at("2026-11-02T00:00:00Z"), // next Monday: outside the window
      ])
    const owner = await signedInUser(["owner"])
    const actor = {
      userId: owner.user.id,
      roles: ["owner" as const],
      ip: null,
      userAgent: null,
      impersonatorId: null,
    }
    const dto = await getDashboard(actor, new Date("2026-10-28T12:00:00Z"))
    const week = dto.enquiriesWeek!
    expect(week.current).toBe(3)
    expect(week.previous).toBe(2)
    expect(week.days).toEqual([
      { key: "2026-10-26", label: "Mon", current: 1, previous: 1 },
      { key: "2026-10-27", label: "Tue", current: 0, previous: 0 },
      { key: "2026-10-28", label: "Wed", current: 2, previous: 0 },
      { key: "2026-10-29", label: "Thu", current: 0, previous: 0 },
      { key: "2026-10-30", label: "Fri", current: 0, previous: 0 },
      { key: "2026-10-31", label: "Sat", current: 0, previous: 0 },
      { key: "2026-11-01", label: "Sun", current: 0, previous: 1 },
    ])
  })

  it("Next up: Reply to the oldest new enquiry, for lead readers", async () => {
    const DAY_MS = 86_400_000
    const [older] = await getDb()
      .insert(leads)
      .values({
        name: "  Ada <b>Lovelace</b>  ",
        email: "ada@example.ie",
        message: "Hi",
        createdAt: new Date(Date.now() - 2 * DAY_MS),
      })
      .returning({ id: leads.id })
    await getDb()
      .insert(leads)
      .values([
        { name: "Newer", email: "b@example.ie", message: "Hi" },
        {
          name: "Old but contacted",
          email: "c@example.ie",
          message: "Hi",
          status: "contacted",
          createdAt: new Date(Date.now() - 9 * DAY_MS),
        },
      ])
    const intake = await dashboard((await signedInUser(["intake"])).cookie)
    expect(intake.nextUp).toContainEqual({
      id: "reply",
      title: "Reply to Ada <b>Lovelace</b>",
      description: "The oldest enquiry still marked New.",
      href: `/admin/leads?lead=${older!.id}`,
      done: false,
    })
    const editor = await dashboard((await signedInUser(["editor"])).cookie)
    expect(editor.nextUp.map((i) => i.id)).not.toContain("reply")
  })

  it("SEO score, content health and QA follow the viewer's permissions", async () => {
    const admin = await dashboard((await signedInUser(["admin"])).cookie)
    expect(admin.kpis.seoScore).toEqual(expect.any(Number))
    const health = admin.contentHealth!
    expect(health.complete + health.needsWork + health.missing).toBeGreaterThan(
      0
    )
    // Seeded legal pages are still the starter text.
    expect(admin.qa).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "legal-unpublished",
          href: "/admin/pages/privacy",
        }),
        expect.objectContaining({
          rule: "legal-unpublished",
          href: "/admin/pages/terms",
        }),
      ])
    )

    const intake = await dashboard((await signedInUser(["intake"])).cookie)
    expect(intake.qa).toBeNull()
    expect(intake.contentHealth).toBeNull()
    expect(intake.kpis.seoScore).toBeNull()

    // An author reads neither settings nor pages nor SEO.
    const author = await dashboard((await signedInUser(["author"])).cookie)
    expect(author.qa).toBeNull()
    expect(author.contentHealth).toBeNull()
  })

  it("QA flags a placeholder in the published contact settings; a marketer (no settings:read) does not see it", async () => {
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "contact"))
    await getDb()
      .update(settings)
      .set({
        published: {
          ...(row!.published as Record<string, unknown>),
          office: "[phone]",
        },
      })
      .where(eq(settings.key, "contact"))
    const admin = await dashboard((await signedInUser(["admin"])).cookie)
    expect(admin.qa).toContainEqual(
      expect.objectContaining({
        rule: "placeholder-contact",
        label: "Contact details",
        href: "/admin/settings/contact",
      })
    )
    const marketer = await dashboard((await signedInUser(["marketer"])).cookie)
    expect(marketer.qa).not.toBeNull()
    expect(marketer.qa!.map((f) => f.href)).not.toContain(
      "/admin/settings/contact"
    )
  })

  it("computes Next up from state (SMTP/R2 unset, 2FA off, unassigned leads)", async () => {
    await getDb()
      .insert(leads)
      .values({ name: "N", email: "n@example.ie", message: "Hi" })
    const owner = await signedInUser(["owner"])
    const before = await dashboard(owner.cookie)
    const state = Object.fromEntries(before.nextUp.map((i) => [i.id, i.done]))
    expect(state).toEqual({
      smtp: false,
      r2: false,
      ai: false,
      "two-factor": false,
      review: true,
      "unassigned-leads": false,
      reply: false,
    })
    expect(before.nextUp.find((i) => i.id === "unassigned-leads")?.title).toBe(
      "Assign 1 new enquiry"
    )
    // Settings ▸ Integrations (Phase 6 Task 2).
    expect(
      Object.fromEntries(before.nextUp.map((i) => [i.id, i.href]))
    ).toMatchObject({
      smtp: "/admin/settings/integrations/smtp",
      r2: "/admin/settings/integrations/r2",
    })

    await getDb()
      .insert(settings)
      .values({ key: "integrations.smtp", draft: { host: "smtp.example.ie" } })
    const after = await dashboard(owner.cookie)
    expect(after.nextUp.find((i) => i.id === "smtp")?.done).toBe(true)
  })

  it("offers managers to turn on the AI assistant until it is on (MK C7)", async () => {
    const item = {
      id: "ai",
      title: "Turn on the AI assistant",
      description: "Draft copy, check SEO and summarise enquiries.",
      href: "/admin/settings/ai-assistant",
      done: false,
    }
    const owner = await signedInUser(["owner"])
    const admin = await signedInUser(["admin"])
    const editor = await signedInUser(["editor"])
    expect((await dashboard(owner.cookie)).nextUp).toContainEqual(item)
    expect((await dashboard(admin.cookie)).nextUp).toContainEqual(item)
    expect(
      (await dashboard(editor.cookie)).nextUp.map((i) => i.id)
    ).not.toContain("ai")

    // Saved but off: still offered.
    const values = {
      enabled: false,
      provider: "anthropic",
      model: "claude-sonnet-5-5",
      apiKey: "sk-ant-dashboard-key-1234",
      allowedRoles: ["owner", "admin", "editor"],
    }
    const put = (version: number, json: Record<string, unknown>) =>
      adminRequest("/integrations/integrations.ai", {
        cookie: owner.cookie,
        method: "PUT",
        json: { version, values: json },
      })
    expect((await put(0, values)).status).toBe(200)
    expect((await dashboard(owner.cookie)).nextUp).toContainEqual(item)

    // On: gone.
    expect((await put(1, { enabled: true })).status).toBe(200)
    expect(
      (await dashboard(owner.cookie)).nextUp.map((i) => i.id)
    ).not.toContain("ai")
  })

  it("hides what the role may not see", async () => {
    const viewer = await dashboard((await signedInUser(["viewer"])).cookie)
    expect(viewer.kpis.leads30d).toBeNull()
    expect(viewer.enquiriesWeek).toBeNull()
    expect(viewer.kpis.published).not.toBeNull()
    expect(viewer.nextUp).toEqual([])

    const intake = await dashboard((await signedInUser(["intake"])).cookie)
    expect(intake.kpis.leads30d).toEqual({ value: 0, previous: 0 })
    expect(intake.enquiriesWeek!.days).toHaveLength(7)
    expect(intake.kpis.published).toBeNull()
    expect(intake.nextUp.map((i) => i.id)).toEqual(["unassigned-leads"])
  })

  it("a failing SEO health or QA scan hides only that part, and says why in the log (review M1/M2)", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    failing.seo = true
    failing.qa = true
    const dto = await dashboard((await signedInUser(["admin"])).cookie)
    expect(dto.kpis.seoScore).toBeNull()
    expect(dto.contentHealth).toBeNull()
    expect(dto.qa).toBeNull()
    expect(dto.kpis.openLeads).toBe(0)
    expect(errors.mock.calls.map(([line]) => line)).toEqual(
      expect.arrayContaining([
        "[dashboard] SEO health unavailable, part hidden (TypeError: settings row no longer parses)",
        "[dashboard] Content QA unavailable, part hidden (Error: bad jsonb)",
      ])
    )
  })

  it("SEO health and QA come from cached readers tagged for content writes (review M3)", async () => {
    await dashboard((await signedInUser(["admin"])).cookie)
    const tags = cacheTag.mock.calls.flat()
    expect(tags).toEqual(
      expect.arrayContaining([
        "content-review",
        "services",
        "articles",
        "builder-pages",
        "page:privacy",
        "settings:contact",
        "settings:seo.defaults",
      ])
    )
  })

  it("QA scans builder pages for page readers (review M8)", async () => {
    const [page] = await getDb()
      .insert(builderPages)
      .values({
        slug: "spring-offer",
        title: "Spring offer",
        draft: {
          blocks: [
            {
              id: "0190a1b2-c3d4-7e5f-8a9b-000000000001",
              type: "rich-text",
              data: { heading: "Lorem ipsum dolor" },
            },
          ],
        } as never,
      })
      .returning({ id: builderPages.id })
    const finding = expect.objectContaining({
      rule: "placeholder-copy",
      label: "Spring offer",
      href: `/admin/pages/custom/${page!.id}`,
    })
    const marketer = await dashboard((await signedInUser(["marketer"])).cookie)
    expect(marketer.qa).toContainEqual(finding)
  })

  it("counts a live article with a scheduled update as published (final review minor 5)", async () => {
    const { cookie } = await signedInUser(["admin"])
    const before = (await dashboard(cookie)).kpis.published!.articles
    const [live] = await getDb()
      .select({ id: articles.id })
      .from(articles)
      .where(isNotNull(articles.published))
      .limit(1)
    await getDb()
      .update(articles)
      .set({ status: "scheduled", scheduledAt: new Date(Date.now() + DAY) })
      .where(eq(articles.id, live.id))
    expect((await dashboard(cookie)).kpis.published!.articles).toBe(before)
  })

  it("leads from an Irish day: exact Dublin-midnight boundary, served by leads_created_at_idx (final review minor 6)", async () => {
    const at = (iso: string) => ({
      name: "N",
      email: "n@example.ie",
      message: "Hello",
      createdAt: new Date(iso),
    })
    await getDb()
      .insert(leads)
      .values([
        at("2026-07-14T22:59:59.999Z"), // 23:59:59 IST on the 14th
        at("2026-07-14T23:00:00.000Z"), // midnight IST on the 15th
        at("2026-12-14T23:59:59.999Z"), // GMT: still the 14th
        at("2026-12-15T00:00:00.000Z"), // midnight GMT on the 15th
      ])
    expect(await countLeadsFromDay(getDb(), "2026-07-15")).toBe(3)
    expect(await countLeadsFromDay(getDb(), "2026-12-15")).toBe(1)

    const query = leadsFromDayQuery(getDb(), "2026-07-15").toSQL()
    const client = new Client({ connectionString: TEST_DATABASE_URL })
    await client.connect()
    try {
      await client.query("set enable_seqscan = off")
      const plan = await client.query<{ "QUERY PLAN": string }>(
        `explain ${query.sql}`,
        query.params
      )
      expect(
        plan.rows.map((row: { "QUERY PLAN": string }) => row["QUERY PLAN"])
      ).toEqual(
        expect.arrayContaining([
          expect.stringContaining("leads_created_at_idx"),
        ])
      )
    } finally {
      await client.end()
    }
  })

  it("rejects anonymous requests", async () => {
    expect((await adminRequest("/dashboard")).status).toBe(401)
  })

  it("lists 90 Irish calendar days ending today, across DST changes", () => {
    const days = trendDays(new Date("2026-10-26T00:30:00Z"))
    expect(days).toHaveLength(90)
    expect(days.at(-1)).toBe("2026-10-26")
    expect(new Set(days).size).toBe(90)
    expect(trendDays(new Date("2026-03-29T23:30:00Z")).at(-1)).toBe(
      "2026-03-30"
    )
  })

  it("works through the service for an actor without a session row", async () => {
    const owner = await signedInUser(["owner"])
    const dto = await getDashboard({
      userId: owner.user.id,
      roles: ["owner"],
      ip: null,
      userAgent: null,
      impersonatorId: null,
    })
    expect(dto.nextUp.length).toBeGreaterThan(0)
  })
})
