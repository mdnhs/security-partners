import { describe, expect, it } from "vitest"

import { formatPostDate, isoDate } from "@/lib/format"

describe("article dates (Europe/Dublin)", () => {
  it.each([
    ["2026-09-20T09:00:00Z", "2026-09-20", "20 Sep 2026"],
    ["2026-08-05T09:00:00Z", "2026-08-05", "05 Aug 2026"],
    ["2026-07-02T09:00:00Z", "2026-07-02", "02 Jul 2026"],
    ["2026-06-04T09:00:00Z", "2026-06-04", "04 Jun 2026"],
    // 23:30 UTC on 31 Mar is already 1 Apr in Irish summer time
    ["2026-03-31T23:30:00Z", "2026-04-01", "01 Apr 2026"],
    // winter: Irish time = UTC
    ["2026-12-31T23:30:00Z", "2026-12-31", "31 Dec 2026"],
  ])("%s → %s, %s", (iso, date, display) => {
    expect(isoDate(new Date(iso))).toBe(date)
    expect(formatPostDate(new Date(iso))).toBe(display)
  })

  it("prints Sep, not Intl's en-IE 'Sept'", () => {
    expect(formatPostDate(new Date("2026-09-12T09:00:00Z"))).toBe("12 Sep 2026")
  })
})
