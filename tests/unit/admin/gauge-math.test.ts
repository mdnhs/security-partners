import { describe, expect, it } from "vitest"

import { formatShare, gaugeSummary } from "@/components/admin/kit/gauge-math"

describe("gauge maths (JW chart-math port)", () => {
  it("headlines the named part, else the first; clamps bad values", () => {
    const parts = [
      { key: "passed", label: "Passing", value: 30, tone: "solid" as const },
      {
        key: "failed",
        label: "Needs work",
        value: 10,
        tone: "hatched" as const,
      },
      { key: "junk", label: "Junk", value: Number.NaN, tone: "dark" as const },
    ]
    expect(gaugeSummary(parts, "failed")).toMatchObject({
      total: 40,
      headline: 10,
      ratio: 0.25,
    })
    expect(gaugeSummary(parts).headline).toBe(30)
    expect(gaugeSummary([], "x")).toMatchObject({ total: 0, ratio: 0 })
  })

  it("formatShare floors and shows a dash for nothing", () => {
    expect(formatShare(7, 8)).toBe("87%")
    expect(formatShare(0, 0)).toBe("—")
  })
})
