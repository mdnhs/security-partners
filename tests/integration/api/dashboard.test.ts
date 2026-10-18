import { beforeEach, describe, expect, it } from "vitest"

import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import { getDb } from "@/server/db/client"
import { leads, settings } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { getDashboard, trendDays } from "@/server/modules/dashboard/service"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

const DAY = 86_400_000

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
})

async function dashboard(cookie: string) {
  const res = await adminRequest("/dashboard", { cookie })
  expect(res.status).toBe(200)
  return (await res.json()) as DashboardDto
}

describe("dashboard (master 4.7)", () => {
  it("counts leads (30 d, open), published content and builds a 90-day trend", async () => {
    const now = Date.now()
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
    const { cookie } = await signedInUser(["admin"])
    const dto = await dashboard(cookie)
    expect(dto.kpis.leads30d).toBe(4)
    expect(dto.kpis.openLeads).toBe(3)
    expect(dto.kpis.published).toEqual({
      pages: 8,
      services: 6,
      articles: expect.any(Number),
    })
    expect(dto.kpis.published!.articles).toBeGreaterThan(0)
    expect(dto.kpis.inReview).toBe(0)
    expect(dto.leadsTrend).toHaveLength(90)
    expect(dto.leadsTrend!.reduce((sum, d) => sum + d.count, 0)).toBe(6)
    expect(dto.leadsTrend!.at(-1)!.count).toBeGreaterThanOrEqual(1)
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
      "two-factor": false,
      review: true,
      "unassigned-leads": false,
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

  it("hides what the role may not see", async () => {
    const viewer = await dashboard((await signedInUser(["viewer"])).cookie)
    expect(viewer.kpis.leads30d).toBeNull()
    expect(viewer.leadsTrend).toBeNull()
    expect(viewer.kpis.published).not.toBeNull()
    expect(viewer.nextUp).toEqual([])

    const intake = await dashboard((await signedInUser(["intake"])).cookie)
    expect(intake.kpis.leads30d).toBe(0)
    expect(intake.kpis.published).toBeNull()
    expect(intake.nextUp.map((i) => i.id)).toEqual(["unassigned-leads"])
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
