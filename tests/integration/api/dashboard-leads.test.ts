import { beforeEach, describe, expect, it, vi } from "vitest"

// The dashboard's cached content readers (D3.5) run outside a "use cache"
// scope here: record nothing, compute directly.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

import type { DashboardDto } from "@/lib/schemas/api/dashboard"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { seedContent } from "@/server/db/seed"
import { mailer } from "@/server/lib/mailer"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  vi.spyOn(mailer, "send").mockResolvedValue({ delivered: false })
})

describe("dashboard uses real lead data (master 4.7 × 7.3)", () => {
  it("a public enquiry raises leads 30d / open leads and links Next up to the filtered inbox", async () => {
    const { cookie } = await signedInUser(["admin"])
    const before = (await (
      await adminRequest("/dashboard", { cookie })
    ).json()) as DashboardDto
    const res = await app.request("/api/v1/public/leads", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.200",
      },
      body: JSON.stringify({
        name: "Dash",
        email: "dash@example.ie",
        message: "Hi",
      }),
    })
    expect(res.status).toBe(200)
    const after = (await (
      await adminRequest("/dashboard", { cookie })
    ).json()) as DashboardDto
    expect(after.kpis.leads30d!.value).toBe(
      (before.kpis.leads30d?.value ?? 0) + 1
    )
    expect(after.kpis.openLeads).toBe((before.kpis.openLeads ?? 0) + 1)
    expect(after.enquiriesWeek!.current).toBe(
      (before.enquiriesWeek?.current ?? 0) + 1
    )
    expect(after.nextUp.find((i) => i.id === "reply")?.title).toBe(
      "Reply to Dash"
    )
    expect(after.nextUp.find((i) => i.id === "unassigned-leads")?.href).toBe(
      "/admin/leads?status=new&assignee=none"
    )
  })
})
