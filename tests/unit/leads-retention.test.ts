import { describe, expect, it } from "vitest"

import { retentionCutoff } from "@/server/modules/leads/service"

describe("retentionCutoff (settings.leads.retentionMonths)", () => {
  it.each([
    ["2026-10-16T12:00:00.000Z", 24, "2024-10-16T12:00:00.000Z"],
    ["2026-10-16T12:00:00.000Z", 1, "2026-09-16T12:00:00.000Z"],
    ["2026-03-31T08:30:00.000Z", 1, "2026-02-28T08:30:00.000Z"],
    ["2028-03-31T08:30:00.000Z", 1, "2028-02-29T08:30:00.000Z"],
    ["2026-01-15T00:00:00.000Z", 13, "2024-12-15T00:00:00.000Z"],
  ])("%s minus %i months → %s", (now, months, expected) => {
    expect(retentionCutoff(new Date(now), months).toISOString()).toBe(expected)
  })
})
