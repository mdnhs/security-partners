import { describe, expect, it } from "vitest"

import {
  formatDelta,
  formatNumber,
  formatPercent,
  initials,
  peakIndex,
  relativeTime,
} from "@/components/admin/kit/format"
import { toneForStatus } from "@/components/admin/kit/status-pill"
import { contentStatus } from "@/components/admin/kit/content-status"

const NOW = Date.parse("2026-10-16T12:00:00Z")

describe("kit format helpers", () => {
  it("formats numbers and percents for en-IE", () => {
    expect(formatNumber(12345)).toBe("12,345")
    expect(formatPercent(0.425)).toBe("43%")
  })

  it("formatDelta: 0→0 No change, 0→3 New, 10→12 +20.0%", () => {
    expect(formatDelta(12, 10)).toEqual({ label: "+20.0%", direction: "up" })
    expect(formatDelta(5, 10)).toEqual({ label: "-50.0%", direction: "down" })
    expect(formatDelta(0, 0)).toEqual({ label: "No change", direction: "flat" })
    expect(formatDelta(3, 0)).toEqual({ label: "New", direction: "up" })
    expect(formatDelta(10, 10)).toEqual({
      label: "No change",
      direction: "flat",
    })
    expect(formatDelta(1001, 1000)).toEqual({ label: "+0.1%", direction: "up" })
    expect(formatDelta(0, 4)).toEqual({ label: "-100.0%", direction: "down" })
  })

  it("formatDelta never shows ∞% or NaN", () => {
    for (const [current, previous] of [
      [0, 0],
      [3, 0],
      [0, 3],
      [7, 3],
    ] as const) {
      const label = formatDelta(current, previous)?.label ?? ""
      expect(label).not.toMatch(/∞|NaN|Infinity/)
    }
  })

  it("says how long ago, from a given clock", () => {
    expect(relativeTime("2026-10-16T11:59:40Z", NOW)).toBe("just now")
    expect(relativeTime("2026-10-16T11:55:00Z", NOW)).toBe("5 minutes ago")
    expect(relativeTime("2026-10-16T09:00:00Z", NOW)).toBe("3 hours ago")
    expect(relativeTime("2026-10-15T12:00:00Z", NOW)).toBe("yesterday")
  })

  it("says when a future time is, and never throws on a bad date", () => {
    expect(relativeTime("2026-10-16T12:00:20Z", NOW)).toBe("just now")
    expect(relativeTime("2026-10-16T15:00:00Z", NOW)).toBe("in 3 hours")
    expect(relativeTime("2026-10-17T12:00:00Z", NOW)).toBe("tomorrow")
    expect(relativeTime("not a date", NOW)).toBe("at an unknown time")
    expect(relativeTime("", NOW)).toBe("at an unknown time")
  })

  it("finds the busiest bar (first on ties, -1 when empty)", () => {
    expect(peakIndex([1, 4, 4, 2])).toBe(1)
    expect(peakIndex([])).toBe(-1)
  })

  it("makes up to two initials", () => {
    expect(initials("Edith Mary Editor")).toBe("EM")
    expect(initials("Cher")).toBe("C")
    expect(initials("  ")).toBe("?")
  })

  it("maps statuses to pill tones", () => {
    expect(toneForStatus("Published")).toBe("success")
    expect(toneForStatus(" draft ")).toBe("neutral")
    expect(toneForStatus("Unpublished changes")).toBe("warning")
    expect(toneForStatus("Something else")).toBe("neutral")
  })

  it("describes a versioned record as JW status pills", () => {
    expect(contentStatus({ published: null, dirty: true })).toEqual([
      { label: "Draft", tone: "neutral" },
    ])
    expect(contentStatus({ published: undefined, dirty: false })).toEqual([
      { label: "Draft", tone: "neutral" },
    ])
    expect(contentStatus({ published: {}, dirty: false })).toEqual([
      { label: "Published", tone: "success" },
    ])
    expect(contentStatus({ published: {}, dirty: true })).toEqual([
      { label: "Published", tone: "success" },
      { label: "Unpublished changes", tone: "warning" },
    ])
  })
})
