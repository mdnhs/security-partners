import { describe, expect, it } from "vitest"

import {
  BLACK,
  contrast,
  fit,
  formatOklch,
  nudge,
  onColor,
  parseColor,
  scale,
  toHex,
  WHITE,
} from "@/lib/theme/color"
import { SP_SITE } from "@/lib/theme/presets"
import { SP_ADMIN_DARK, SP_ADMIN_LIGHT } from "@/lib/theme/sp-admin"

// Deterministic PRNG so the property test never flakes.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 2 ** 32
    return seed / 2 ** 32
  }
}

describe("parseColor", () => {
  it.each([
    "red",
    "rgb(0,0,0)",
    "var(--x)",
    "#fff",
    "#12345g",
    "oklch(1 0 0);--x:1",
    "red;}body{",
    "x".repeat(65),
    "#000;}</style><script>alert(1)</script>",
    "oklch(1 0)",
    "",
    "#".padEnd(10_000, "a"),
  ])("rejects %s", (s) => expect(parseColor(s)).toBeNull())

  it("round-trips hex", () =>
    expect(toHex(parseColor("#367318")!)).toBe("#367318"))

  it("normalises hex to canonical OKLCH", () => {
    expect(formatOklch(parseColor("#67bd31")!)).toMatch(
      /^oklch\(0\.\d{1,4} 0\.\d{1,4} \d{1,3}(\.\d{1,2})?\)$/
    )
    expect(parseColor("#FFFFFF")).toEqual({ l: 1, c: 0, h: 0 })
    expect(parseColor("  #000000 ")).toEqual({ l: 0, c: 0, h: 0 })
  })

  it("accepts oklch() with a percentage lightness and deg hue", () => {
    expect(parseColor("oklch(52% 0.1 190deg)")).toEqual(
      parseColor("oklch(0.52 0.1 190)")
    )
  })

  // Every base value must survive hex → canonical OKLCH → hex unchanged, or
  // the default theme would drift from the stylesheets.
  const BASE_HEX = [
    ...new Set([
      ...Object.values(SP_SITE),
      ...Object.values(SP_ADMIN_LIGHT),
      ...Object.values(SP_ADMIN_DARK),
    ]),
  ] as string[]
  it.each(BASE_HEX)("round-trips %s exactly", (hex) => {
    expect(toHex(parseColor(hex)!)).toBe(hex)
  })

  it("gamut-maps out-of-range input into sRGB", () => {
    const wild = parseColor("oklch(0.7 0.4 150)")!
    expect(wild.c).toBeLessThan(0.4)
    expect(toHex(wild)).toMatch(/^#[0-9a-f]{6}$/)
  })

  it("an achromatic colour has hue 0 and a hue of 360 wraps to 0", () => {
    expect(parseColor("#808080")!.h).toBe(0)
    expect(parseColor("oklch(0.5 0.1 360)")!.h).toBe(0)
  })
})

describe("formatOklch", () => {
  it("writes only numbers", () => {
    expect(formatOklch({ l: 0.45123456, c: 0.06, h: 194.7712 })).toBe(
      "oklch(0.4512 0.06 194.77)"
    )
  })
})

describe("contrast", () => {
  it("matches WCAG for black on white", () => {
    expect(contrast(BLACK, WHITE)).toBeCloseTo(21, 5)
  })
})

describe("scale", () => {
  it("builds 11 displayable steps, light to dark, with eased chroma", () => {
    const steps = scale(parseColor("#367318")!)
    expect(steps).toHaveLength(11)
    for (let i = 1; i < steps.length; i++)
      expect(steps[i]!.l).toBeLessThan(steps[i - 1]!.l)
    for (const step of steps) expect(fit(step)).toEqual(step)
    expect(steps[0]!.c).toBeLessThan(steps[5]!.c)
    expect(steps[10]!.c).toBeLessThan(steps[5]!.c)
  })
})

describe("onColor", () => {
  it("is always at least 4.5:1 (500 seeded colours)", () => {
    const next = rng(42)
    for (let i = 0; i < 500; i++) {
      const bg = fit({ l: next(), c: next() * 0.37, h: next() * 360 })
      expect(contrast(onColor(bg), bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
  it("prefers white on the dark SP primary", () => {
    expect(onColor(parseColor("#367318")!)).toEqual(WHITE)
  })
})

describe("nudge", () => {
  it("moves a colour away from the fixed one until the pair passes", () => {
    const text = parseColor("#cccccc")!
    const surface = parseColor("#f5f7fb")!
    const fixed = nudge(text, surface, 4.5)!
    expect(contrast(fixed, surface)).toBeGreaterThanOrEqual(4.5)
    expect(fixed.l).toBeLessThan(text.l)
  })
  it("returns null when no lightness can pass", () => {
    expect(nudge(WHITE, parseColor("#777777")!, 21)).toBeNull()
  })
})
