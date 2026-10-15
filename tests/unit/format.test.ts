import { describe, expect, it } from "vitest"

import { describeUserAgent, formatDateTime } from "@/lib/format"

describe("formatDateTime (Europe/Dublin, en-IE)", () => {
  it("shows Irish summer time (UTC+1)", () => {
    expect(formatDateTime("2026-07-01T12:30:00Z")).toBe("1 Jul 2026, 13:30")
  })

  it("shows Irish winter time (UTC+0)", () => {
    expect(formatDateTime(new Date("2026-12-24T09:05:00Z"))).toBe(
      "24 Dec 2026, 09:05"
    )
  })
})

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
      "Chrome on macOS",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
      "Safari on iOS",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0",
      "Edge on Windows",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
      "Firefox on Linux",
    ],
    ["curl/8.7.1", "Unknown device"],
    [null, "Unknown device"],
  ])("%s → %s", (ua, expected) => {
    expect(describeUserAgent(ua)).toBe(expected)
  })
})
