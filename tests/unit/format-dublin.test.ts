import { describe, expect, it } from "vitest"

import { fromDublinInput, toDublinInput } from "@/lib/format"

describe("Irish wall-clock time ↔ instant (schedule dialog, Europe/Dublin)", () => {
  it("shows an instant as Irish local time", () => {
    expect(toDublinInput(new Date("2026-07-01T09:00:00Z"))).toBe(
      "2026-07-01T10:00"
    )
    expect(toDublinInput(new Date("2026-12-01T10:00:00Z"))).toBe(
      "2026-12-01T10:00"
    )
  })

  it("reads summer (IST, UTC+1) and winter (GMT) times", () => {
    expect(fromDublinInput("2026-07-01T10:00")?.toISOString()).toBe(
      "2026-07-01T09:00:00.000Z"
    )
    expect(fromDublinInput("2026-12-01T10:00")?.toISOString()).toBe(
      "2026-12-01T10:00:00.000Z"
    )
  })

  it("handles the clock changes (29 Mar and 25 Oct 2026)", () => {
    // 01:30 does not exist on 29 March: it means 02:30 IST.
    expect(fromDublinInput("2026-03-29T01:30")?.toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    )
    // 01:30 happens twice on 25 October: the later (GMT) one.
    expect(fromDublinInput("2026-10-25T01:30")?.toISOString()).toBe(
      "2026-10-25T01:30:00.000Z"
    )
  })

  it("round-trips and rejects malformed values", () => {
    const at = new Date("2026-10-20T08:15:00Z")
    expect(fromDublinInput(toDublinInput(at))?.toISOString()).toBe(
      at.toISOString()
    )
    for (const bad of [
      "",
      "2026-07-01",
      "2026-13-01T10:00",
      "2026-07-01T24:00",
      "tomorrow",
    ])
      expect(fromDublinInput(bad)).toBeNull()
  })
})
