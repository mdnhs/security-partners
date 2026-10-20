import { describe, expect, it } from "vitest"

import { sameTimeOn, startOfDay, weekWindow } from "@/lib/dashboard/week"

const keys = (days: { key: string }[]) => days.map((d) => d.key)
const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

describe("weekWindow (Europe/Dublin, Monday 00:00 to Sunday 23:59)", () => {
  it("week window across DST end has 7 Dublin days starting Monday", () => {
    const w = weekWindow(new Date("2026-10-28T12:00:00Z"))
    expect(keys(w.days)).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ])
    expect(w.days.map((d) => d.label)).toEqual(LABELS)
    // Monday 26 Oct is GMT (summer time ended on Sunday 25 Oct).
    expect(w.start.toISOString()).toBe("2026-10-26T00:00:00.000Z")
    expect(w.end.toISOString()).toBe("2026-11-02T00:00:00.000Z")
    // The previous Monday was still Irish summer time (UTC+1).
    expect(w.previousStart.toISOString()).toBe("2026-10-18T23:00:00.000Z")
    expect(keys(w.previousDays)).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ])
    expect(w.previousDays.map((d) => d.label)).toEqual(LABELS)
  })

  it("2026-10-26: the first minutes of Monday start a new week; Sunday night does not", () => {
    const monday = weekWindow(new Date("2026-10-26T00:30:00Z"))
    expect(monday.days[0]!.key).toBe("2026-10-26")
    expect(monday.start.toISOString()).toBe("2026-10-26T00:00:00.000Z")

    // 23:30 GMT on Sunday 25 Oct: the 25-hour Sunday still belongs to the
    // week that started on Monday 19 Oct (00:00 IST).
    const sunday = weekWindow(new Date("2026-10-25T23:30:00Z"))
    expect(sunday.days[0]!.key).toBe("2026-10-19")
    expect(sunday.days.at(-1)!.key).toBe("2026-10-25")
    expect(sunday.start.toISOString()).toBe("2026-10-18T23:00:00.000Z")
    expect(sunday.end.toISOString()).toBe("2026-10-26T00:00:00.000Z")
    expect(sunday.days).toHaveLength(7)
  })

  it("2026-03-30: the Monday after summer time starts is midnight IST", () => {
    // 23:30 UTC on Sunday 29 Mar is 00:30 IST on Monday 30 Mar.
    const w = weekWindow(new Date("2026-03-29T23:30:00Z"))
    expect(w.days[0]!.key).toBe("2026-03-30")
    expect(w.days.at(-1)!.key).toBe("2026-04-05")
    expect(w.start.toISOString()).toBe("2026-03-29T23:00:00.000Z")
    expect(w.end.toISOString()).toBe("2026-04-05T23:00:00.000Z")
    // The week before started in GMT.
    expect(w.previousStart.toISOString()).toBe("2026-03-23T00:00:00.000Z")
    expect(w.previousDays[0]!.key).toBe("2026-03-23")
    expect(w.previousDays.at(-1)!.key).toBe("2026-03-29")
  })

  it("Sunday 23:59 local is still the same week", () => {
    const w = weekWindow(new Date("2026-11-01T23:59:00Z"))
    expect(w.days[0]!.key).toBe("2026-10-26")
    const july = weekWindow(new Date("2026-07-19T22:59:00Z")) // 23:59 IST Sun
    expect(july.days[0]!.key).toBe("2026-07-13")
    expect(weekWindow(new Date("2026-07-19T23:00:00Z")).days[0]!.key).toBe(
      "2026-07-20"
    )
  })

  it("previousCut: last week up to the same weekday and Irish wall-clock time", () => {
    // Monday 26 Oct 09:15 GMT → Monday 19 Oct 09:15 IST (08:15 UTC).
    const monday = weekWindow(new Date("2026-10-26T09:15:00Z"))
    expect(monday.previousCut.toISOString()).toBe("2026-10-19T08:15:00.000Z")
    // Wednesday 1 Apr 10:00 IST → Wednesday 25 Mar 10:00 GMT.
    const spring = weekWindow(new Date("2026-04-01T09:00:00Z"))
    expect(spring.previousCut.toISOString()).toBe("2026-03-25T10:00:00.000Z")
    // Sunday 23:59 → last Sunday 23:59, still before this week's start.
    const sunday = weekWindow(new Date("2026-11-01T23:59:00Z"))
    expect(sunday.previousCut.toISOString()).toBe("2026-10-25T23:59:00.000Z")
    expect(sunday.previousCut.getTime()).toBeLessThanOrEqual(
      sunday.start.getTime()
    )
  })

  it("startOfDay and sameTimeOn follow the Dublin clock", () => {
    expect(startOfDay("2026-07-15").toISOString()).toBe(
      "2026-07-14T23:00:00.000Z"
    )
    expect(startOfDay("2026-12-15").toISOString()).toBe(
      "2026-12-15T00:00:00.000Z"
    )
    // 15:00 GMT on 28 Oct → 15:00 IST on 28 Sep.
    expect(
      sameTimeOn(new Date("2026-10-28T15:00:00Z"), "2026-09-28").toISOString()
    ).toBe("2026-09-28T14:00:00.000Z")
  })

  it("crosses month and year ends", () => {
    const w = weekWindow(new Date("2027-01-01T10:00:00Z")) // a Friday
    expect(keys(w.days)).toEqual([
      "2026-12-28",
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
      "2027-01-03",
    ])
    expect(w.previousDays[0]!.key).toBe("2026-12-21")
  })
})
