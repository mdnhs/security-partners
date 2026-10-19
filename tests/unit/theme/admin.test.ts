import { describe, expect, it } from "vitest"

import { ADMIN_DEFAULT, buildAdminTokens } from "@/lib/theme/admin"
import { ADMIN_PAIRS } from "@/lib/theme/checks"
import { contrast, sameColor } from "@/lib/theme/color"
import { NEUTRAL_CHROMA } from "@/lib/theme/derive"
import {
  ADMIN_RADII,
  ColorValue,
  DEFAULT_THEME,
  ThemeConfig,
} from "@/lib/theme/schema"
import { ADMIN_CONTRAST_PAIRS } from "@/lib/theme/sp-admin"
import { ADMIN_TOKENS } from "@/lib/theme/tokens"

const FIXED = [
  "destructive",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "hero-foreground",
  "hero-chip",
  "hero-chip-foreground",
  "promo-foreground",
] as const

describe("buildAdminTokens", () => {
  it.each(["light", "dark"] as const)(
    "the default config gives ADMIN_DEFAULT (%s)",
    (mode) => {
      expect(buildAdminTokens(DEFAULT_THEME.admin, mode)).toEqual(
        ADMIN_DEFAULT[mode]
      )
    }
  )

  it.each(["light", "dark"] as const)(
    "a new primary leaves the semantic colours alone (%s)",
    (mode) => {
      const tokens = buildAdminTokens(
        { ...DEFAULT_THEME.admin, primary: ColorValue.parse("#6a3f6b") },
        mode
      )
      for (const t of FIXED)
        expect(sameColor(tokens[t], ADMIN_DEFAULT[mode][t]), t).toBe(true)
      expect(sameColor(tokens.primary, ADMIN_DEFAULT[mode].primary)).toBe(false)
    }
  )

  it.each(["light", "dark"] as const)(
    "the navy family keeps SP's values under a blue primary (%s)",
    (mode) => {
      const tokens = buildAdminTokens(
        { ...DEFAULT_THEME.admin, preset: "ocean" },
        mode
      )
      for (const t of [
        "foreground",
        "muted-foreground",
        "input",
        "chart-4",
        "hero-from",
        "hero-to",
        "promo-from",
        "promo-to",
      ] as const)
        expect(tokens[t], t).toEqual(ADMIN_DEFAULT[mode][t])
      // The green family follows the primary's hue.
      expect(Math.abs(tokens.ring.h - tokens.primary.h)).toBeLessThan(15)
    }
  )

  it("dark keeps the SP dark primary lightness", () => {
    const dark = buildAdminTokens(
      { ...DEFAULT_THEME.admin, primary: ColorValue.parse("#2f5f8a") },
      "dark"
    )
    expect(dark.primary.l).toBeCloseTo(ADMIN_DEFAULT.dark.primary.l, 2)
  })

  it("tint none greys the neutrals, tint primary hues them", () => {
    const base = ThemeConfig.parse({ admin: { primary: "#6a3f6b" } }).admin
    const none = buildAdminTokens({ ...base, tint: "none" }, "light")
    const tinted = buildAdminTokens({ ...base, tint: "primary" }, "light")
    for (const t of ADMIN_TOKENS) {
      if (ADMIN_DEFAULT.light[t].c >= NEUTRAL_CHROMA) continue
      if ((FIXED as readonly string[]).includes(t)) continue
      // onColor() recomputes these for a custom primary.
      if (t === "primary-foreground" || t === "sidebar-primary-foreground")
        continue
      expect(none[t].c, t).toBe(0)
      expect(tinted[t].h, t).toBe(tinted.primary.h)
    }
  })

  it("an accent sets accent and sidebar accent with readable text", () => {
    for (const mode of ["light", "dark"] as const) {
      const t = buildAdminTokens(
        { ...DEFAULT_THEME.admin, accent: ColorValue.parse("#ffe08a") },
        mode
      )
      expect(t["sidebar-accent"]).toEqual(t.accent)
      expect(contrast(t["accent-foreground"], t.accent)).toBeGreaterThanOrEqual(
        4.5
      )
    }
  })
})

describe("schema", () => {
  it("defaults to the SP preset, radius 0.75, system mode", () => {
    expect(DEFAULT_THEME).toEqual({
      site: { preset: "security-partners", brand: null, tokens: {} },
      admin: {
        preset: "security-partners",
        primary: null,
        accent: null,
        tint: "preset",
        radius: 0.75,
        mode: "system",
      },
    })
    expect(ADMIN_RADII).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25])
  })

  it("stores colours as canonical oklch()", () => {
    expect(ColorValue.parse("#367318")).toMatch(
      /^oklch\([\d.]+ [\d.]+ [\d.]+\)$/
    )
    expect(ColorValue.parse(ColorValue.parse("#367318"))).toBe(
      ColorValue.parse("#367318")
    )
  })

  it("ADMIN_PAIRS = A1 ADMIN_CONTRAST_PAIRS", () => {
    expect(ADMIN_PAIRS).toEqual(ADMIN_CONTRAST_PAIRS)
  })
})
