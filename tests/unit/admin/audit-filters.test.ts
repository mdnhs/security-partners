import { describe, expect, it } from "vitest"

import {
  auditFilterQuery,
  dublinMidnightUtc,
  EMPTY_AUDIT_FILTERS,
  hasAuditFilters,
} from "@/lib/admin/audit-filters"

describe("dublinMidnightUtc — Irish calendar days to UTC instants", () => {
  it.each([
    ["2026-01-15", 0, "2026-01-15T00:00:00.000Z"], // GMT
    ["2026-07-01", 0, "2026-06-30T23:00:00.000Z"], // IST (UTC+1)
    ["2026-03-29", 0, "2026-03-29T00:00:00.000Z"], // clocks go forward at 01:00 UTC
    ["2026-03-29", 1, "2026-03-29T23:00:00.000Z"],
    ["2026-10-25", 0, "2026-10-24T23:00:00.000Z"], // clocks go back at 01:00 UTC
    ["2026-10-25", 1, "2026-10-26T00:00:00.000Z"],
    ["2026-12-31", 1, "2027-01-01T00:00:00.000Z"],
  ])("%s (+%i days) → %s", (day, add, iso) => {
    expect(dublinMidnightUtc(day, add).toISOString()).toBe(iso)
  })
})

describe("auditFilterQuery", () => {
  it("omits empty filters", () => {
    expect(auditFilterQuery(EMPTY_AUDIT_FILTERS)).toEqual({
      actor: undefined,
      action: undefined,
      entityType: undefined,
      from: undefined,
      to: undefined,
    })
    expect(hasAuditFilters(EMPTY_AUDIT_FILTERS)).toBe(false)
  })

  it("sends whole Irish days, inclusive, as UTC (API from/to)", () => {
    const filters = {
      actor: "0190f0e0-0000-7000-8000-000000000001",
      action: " user.invite ",
      entityType: "user",
      from: "2026-07-01",
      to: "2026-07-01",
    }
    expect(auditFilterQuery(filters)).toEqual({
      actor: "0190f0e0-0000-7000-8000-000000000001",
      action: "user.invite",
      entityType: "user",
      from: "2026-06-30T23:00:00.000Z",
      to: "2026-07-01T22:59:59.999Z",
    })
    expect(hasAuditFilters(filters)).toBe(true)
  })

  it("ignores a half-typed date (a date input can hold a bad value)", () => {
    expect(
      auditFilterQuery({ ...EMPTY_AUDIT_FILTERS, from: "0002-1", to: "x" })
    ).toMatchObject({ from: undefined, to: undefined })
  })
})
