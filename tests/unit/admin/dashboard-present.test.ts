import { describe, expect, it } from "vitest"

import {
  firstName,
  greetingFor,
  weeklyBuckets,
} from "@/components/admin/dashboard/present"

describe("dashboard presenters", () => {
  it("greets by the clock in Ireland", () => {
    expect(greetingFor(new Date("2026-10-16T08:30:00Z"))).toBe("Good morning") // 09:30 IST
    expect(greetingFor(new Date("2026-10-16T12:00:00Z"))).toBe("Good afternoon")
    expect(greetingFor(new Date("2026-12-16T18:30:00Z"))).toBe("Good evening") // 18:30 GMT
  })

  it("uses the first name", () => {
    expect(firstName("Edith Mary Editor")).toBe("Edith")
    expect(firstName("  ")).toBe("there")
  })

  it("folds 90 days into 13 weekly pills, newest last", () => {
    const trend = Array.from({ length: 90 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 6, 19 + i)).toISOString().slice(0, 10),
      count: i === 89 ? 4 : i === 80 ? 3 : 0,
    }))
    const weeks = weeklyBuckets(trend)
    expect(weeks).toHaveLength(13)
    expect(weeks.at(-1)).toEqual({
      key: "2026-10-10",
      label: "10 Oct",
      current: 4,
    })
    expect(weeks.at(-2)!.current).toBe(3)
    expect(weeks.reduce((sum, w) => sum + w.current, 0)).toBe(7)
    expect(weeks[0]!.key).toBe("2026-07-19")
  })
})
