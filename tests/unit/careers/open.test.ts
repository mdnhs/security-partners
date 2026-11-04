import { describe, expect, it } from "vitest"

import { isOpen, openJobs, previousJobs } from "@/lib/careers/open"

// Europe/Dublin is UTC+0 in winter: 30 Nov 23:30 Dublin = 23:30Z.
const dublin = (iso: string) => new Date(iso)

describe("isOpen (Europe/Dublin calendar day)", () => {
  const job = { closingDate: "2026-11-30", filled: false }

  it("is open on the closing day itself, until midnight in Dublin", () => {
    expect(isOpen(job, dublin("2026-11-30T23:30:00Z"))).toBe(true)
  })

  it("is closed from the next day", () => {
    expect(isOpen(job, dublin("2026-12-01T00:05:00Z"))).toBe(false)
  })

  it("uses Irish summer time (UTC+1)", () => {
    const summer = { closingDate: "2026-07-31", filled: false }
    // 23:30Z on 31 Jul is already 00:30 on 1 Aug in Dublin.
    expect(isOpen(summer, dublin("2026-07-31T22:30:00Z"))).toBe(true)
    expect(isOpen(summer, dublin("2026-07-31T23:30:00Z"))).toBe(false)
  })

  it("a filled role is never open", () => {
    expect(isOpen({ ...job, filled: true }, dublin("2026-11-01T09:00:00Z"))).toBe(
      false
    )
  })
})

describe("openJobs / previousJobs", () => {
  const now = dublin("2026-11-10T12:00:00Z")
  const job = (
    slug: string,
    closingDate: string,
    publishedAt: string,
    filled = false
  ) => ({
    slug,
    content: { closingDate, filled },
    publishedAt: new Date(publishedAt),
  })
  const all = [
    job("old-open", "2026-12-01", "2026-10-01T00:00:00Z"),
    job("new-open", "2026-12-15", "2026-11-05T00:00:00Z"),
    job("expired", "2026-11-01", "2026-09-01T00:00:00Z"),
    job("filled", "2026-12-20", "2026-10-15T00:00:00Z", true),
    job("expired-later", "2026-11-09", "2026-08-01T00:00:00Z"),
  ]

  it("open: not filled, closing today or later, newest posted first", () => {
    expect(openJobs(all, now).map((j) => j.slug)).toEqual([
      "new-open",
      "old-open",
    ])
  })

  it("previous: filled or expired, newest closing date first, capped", () => {
    expect(previousJobs(all, now).map((j) => j.slug)).toEqual([
      "filled",
      "expired-later",
      "expired",
    ])
    expect(previousJobs(all, now, 2)).toHaveLength(2)
  })
})
