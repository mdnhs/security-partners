import { describe, expect, it } from "vitest"

import { jobContent } from "@/lib/schemas/content/job"

import { jobRecord } from "./fixtures"

const withClosing = (closingDate: string) =>
  jobContent.safeParse({ ...jobRecord("role").content, closingDate })

describe("jobContent closingDate", () => {
  it("takes real calendar dates, leap days included", () => {
    expect(withClosing("2026-11-30").success).toBe(true)
    expect(withClosing("2028-02-29").success).toBe(true)
  })

  it("refuses dates that do not exist", () => {
    for (const date of ["2026-02-31", "2026-02-29", "2026-13-01", "2026-04-31", "2026-00-10"])
      expect(withClosing(date).success, date).toBe(false)
  })
})
