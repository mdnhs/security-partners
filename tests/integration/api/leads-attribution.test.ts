import { eq } from "drizzle-orm"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { LeadDto } from "@/lib/schemas/api/leads"
import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { leads } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { mailer } from "@/server/lib/mailer"

import { resetDb } from "../db"
import { adminRequest, signedInUser } from "../helpers/auth"

let ipCounter = 0
const freshIp = () => `203.0.113.${++ipCounter}`

const BODY = {
  name: "Dinn Rí",
  email: "dinn@example.ie",
  message: "Please quote for static security.",
  consent: true,
  sourcePage: "/contact",
}

const ATTRIBUTION = {
  referrer: "https://www.google.com/search",
  landingPath: "/services/static-guarding",
  utm: {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "autumn-26",
    utm_term: "security dublin",
    utm_content: "ad-1",
  },
  capturedAt: "2026-10-20T09:30:00.000Z",
}

function post(body: unknown) {
  return app.request("/api/v1/public/leads", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": freshIp(),
    },
    body: JSON.stringify(body),
  })
}

async function onlyLead() {
  const rows = await getDb().select().from(leads)
  expect(rows).toHaveLength(1)
  return rows[0]
}

let admin: string

beforeEach(async () => {
  await resetDb()
  await seedContent(getDb())
  vi.spyOn(mailer, "send").mockResolvedValue({ delivered: true })
  admin = (await signedInUser(["admin"])).cookie
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("lead attribution (D3.1)", () => {
  it("a lead with attribution round-trips to GET /leads/:id", async () => {
    expect((await post({ ...BODY, attribution: ATTRIBUTION })).status).toBe(200)
    const row = await onlyLead()
    expect(row.attribution).toEqual(ATTRIBUTION)

    const res = await adminRequest(`/leads/${row.id}`, { cookie: admin })
    expect(res.status).toBe(200)
    const dto = (await res.json()) as LeadDto
    expect(dto.attribution).toEqual(ATTRIBUTION)
  })

  it("a lead without attribution stores null (and the DTO says so)", async () => {
    expect((await post(BODY)).status).toBe(200)
    const row = await onlyLead()
    expect(row.attribution).toBeNull()
    const dto = (await (
      await adminRequest(`/leads/${row.id}`, { cookie: admin })
    ).json()) as LeadDto
    expect(dto.attribution).toBeNull()
  })

  it("invalid attribution never loses the enquiry: dropped, warned, lead saved (M5)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const invalid = [
      { ...ATTRIBUTION, utm: { utm_source: "x".repeat(10_000) } },
      { ...ATTRIBUTION, referrer: `https://e.example/${"r".repeat(300)}` },
      { ...ATTRIBUTION, landingPath: `/${"p".repeat(300)}` },
      { ...ATTRIBUTION, utm: { gclid: "abc" } },
      { ...ATTRIBUTION, capturedAt: "not a date" },
      "a string",
      42,
    ]
    for (const [i, attribution] of invalid.entries()) {
      const res = await post({
        ...BODY,
        email: `m5-${i}@example.ie`,
        attribution,
      })
      expect(res.status).toBe(200)
    }
    const rows = await getDb().select().from(leads)
    expect(rows).toHaveLength(invalid.length)
    expect(rows.every((r) => r.attribution === null)).toBe(true)
    expect(warn).toHaveBeenCalledTimes(invalid.length)
    expect(warn).toHaveBeenCalledWith(
      "[leads] invalid attribution dropped; enquiry kept"
    )
    // The log line never carries the visitor's values.
    expect(JSON.stringify(warn.mock.calls)).not.toContain("e.example")
  })

  it("a lone surrogate or an emoji at the cap still saves the lead (I2)", async () => {
    const res = await post({
      ...BODY,
      attribution: {
        ...ATTRIBUTION,
        utm: {
          utm_source: "\ud800x",
          utm_content: `${"a".repeat(198)}\u{1F680}`,
          utm_term: `${"b".repeat(199)}\ud83d`,
        },
      },
    })
    expect(res.status).toBe(200)
    const row = await onlyLead()
    expect(row.attribution?.utm).toEqual({
      utm_source: "x",
      utm_content: `${"a".repeat(198)}\u{1F680}`,
      utm_term: "b".repeat(199),
    })
  })

  it("the server strips a referrer query and forces a site landing path (M1, M2)", async () => {
    const res = await post({
      ...BODY,
      attribution: {
        ...ATTRIBUTION,
        referrer: "https://www.google.com/search?q=private#x",
        landingPath: "https://evil.example/x",
      },
    })
    expect(res.status).toBe(200)
    const row = await onlyLead()
    expect(row.attribution).toMatchObject({
      referrer: "https://www.google.com/search",
      landingPath: "/",
    })
  })

  it("hostile values are stored as plain text: control/bidi characters stripped, non-web referrers dropped", async () => {
    const res = await post({
      ...BODY,
      attribution: {
        referrer: "javascript:alert(1)",
        landingPath: "/x\u0000\u202E",
        utm: {
          utm_source: "  <script>alert(1)</script>\u0007 ",
          utm_medium: "\u2028",
        },
        capturedAt: ATTRIBUTION.capturedAt,
      },
    })
    expect(res.status).toBe(200)
    const row = await onlyLead()
    expect(row.attribution).toEqual({
      referrer: null,
      landingPath: "/x",
      utm: { utm_source: "<script>alert(1)</script>" },
      capturedAt: ATTRIBUTION.capturedAt,
    })
  })

  it("the CSV has the new columns, and a formula-like UTM gets the ' guard", async () => {
    expect(
      (
        await post({
          ...BODY,
          attribution: {
            ...ATTRIBUTION,
            utm: {
              ...ATTRIBUTION.utm,
              utm_campaign: '=HYPERLINK("http://evil","x")',
              utm_term: "+1",
            },
          },
        })
      ).status
    ).toBe(200)
    await post({ ...BODY, email: "plain@example.ie" })
    const res = await adminRequest("/leads/export.csv", { cookie: admin })
    expect(res.status).toBe(200)
    const lines = (await res.text()).replace(/^\uFEFF/, "").split("\r\n")
    expect(
      lines[0].endsWith(
        ",Lead ID,Referrer,Landing page,UTM source,UTM medium,UTM campaign,UTM term,UTM content"
      )
    ).toBe(true)
    const withSource = lines.find((l) => l.includes("dinn@example.ie"))!
    expect(withSource).toMatch(
      /,https:\/\/www\.google\.com\/search,\/services\/static-guarding,google,cpc,"'=HYPERLINK\(""http:\/\/evil"",""x""\)",'\+1,ad-1$/
    )
    const plain = lines.find((l) => l.includes("plain@example.ie"))!
    expect(plain.endsWith(",,,,,,,")).toBe(true)
  })

  it("stores attribution only on the lead row, never in the audit log or events", async () => {
    await post({ ...BODY, attribution: ATTRIBUTION })
    const row = await onlyLead()
    const dto = (await (
      await adminRequest(`/leads/${row.id}`, { cookie: admin })
    ).json()) as LeadDto
    expect(JSON.stringify(dto.events)).not.toContain("google")
    const [fresh] = await getDb()
      .select({ a: leads.attribution })
      .from(leads)
      .where(eq(leads.id, row.id))
    expect(fresh.a?.utm.utm_source).toBe("google")
  })
})
