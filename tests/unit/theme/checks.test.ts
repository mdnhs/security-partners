import { describe, expect, it } from "vitest"

import {
  checkTheme,
  describeIssue,
  fixAll,
  fixIssue,
  pairRatings,
  SITE_PAIRS,
} from "@/lib/theme/checks"
import { contrast } from "@/lib/theme/color"
import { PRESET_IDS } from "@/lib/theme/presets"
import { ColorValue, DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"
import { presetSiteTheme, resolveSiteTokens } from "@/lib/theme/site"

const withSite = (site: object) =>
  ThemeConfig.parse({ site: { ...DEFAULT_THEME.site, ...site } })

describe("checkTheme", () => {
  it("the default theme has no issues", () => {
    expect(checkTheme(DEFAULT_THEME)).toEqual([])
  })

  it("pins the SITE_PAIRS from the brief", () => {
    expect(SITE_PAIRS).toEqual([
      ["brand-ink", "brand-surface", 4.5],
      ["brand-muted", "brand-surface", 3],
      ["brand-navy", "brand-mint", 4.5],
      ["brand-navy", "brand-green", 4.5],
      ["brand-blue", "brand-surface", 4.5],
    ])
  })

  it("every preset × mode passes admin pairs", () => {
    for (const p of PRESET_IDS)
      expect(
        checkTheme({
          ...DEFAULT_THEME,
          admin: { ...DEFAULT_THEME.admin, preset: p, primary: null },
        }),
        p
      ).toEqual([])
  })

  // The brief's preset brands are dark, so the consent button (navy text on
  // brand green) is their only failing pair; publish is blocked until
  // "fix all" lightens the green. Pinned so a change here is deliberate.
  it("non-SP site presets fail only the consent pair, and fixAll repairs it", () => {
    for (const p of PRESET_IDS) {
      const config = { ...DEFAULT_THEME, site: presetSiteTheme(p) }
      const issues = checkTheme(config)
      if (p === "security-partners") expect(issues).toEqual([])
      else
        expect(
          issues.map((i) => `${i.text}/${i.surface}`),
          p
        ).toEqual(["brand-navy/brand-green"])
      expect(fixAll(config).remaining, p).toEqual([])
    }
  })

  it("rates every pair three times (site + admin light + dark)", () => {
    const rows = pairRatings(DEFAULT_THEME)
    expect(new Set(rows.map((r) => r.scope))).toEqual(
      new Set(["site", "admin-light", "admin-dark"])
    )
    expect(rows.every((r) => r.rating !== "fail")).toBe(true)
  })

  it("finds a failing site pair and explains it in words", () => {
    const issues = checkTheme(withSite({ tokens: { "brand-ink": "#cccccc" } }))
    const ink = issues.find((i) => i.text === "brand-ink")!
    expect(ink).toMatchObject({ scope: "site", min: 4.5 })
    expect(describeIssue(ink)).toMatch(
      /^Body text on Page surface is \d\.\d{2}:1; it needs 4\.5:1 \(body text\)\.$/
    )
  })

  it("never rounds a failing ratio up to the threshold", () => {
    expect(
      describeIssue({
        scope: "admin-dark",
        text: "primary-foreground",
        surface: "primary",
        ratio: 4.4999,
        min: 4.5,
      })
    ).toBe(
      "Admin (dark): Text on primary on Primary is 4.49:1; it needs 4.5:1 (body text)."
    )
  })
})

describe("fix automatically", () => {
  it("a pale primary fails and fixAll repairs it", () => {
    const bad = {
      ...DEFAULT_THEME,
      admin: { ...DEFAULT_THEME.admin, primary: ColorValue.parse("#d4f5c0") },
    }
    expect(checkTheme(bad).length).toBeGreaterThan(0)
    expect(fixAll(bad).remaining).toEqual([])
  })

  it("fixes a site text token by locking a darker value", () => {
    const config = withSite({ tokens: { "brand-ink": "#cccccc" } })
    const [issue] = checkTheme(config)
    const fixed = fixIssue(config, issue!)!
    const tokens = resolveSiteTokens(fixed.site)
    expect(
      contrast(tokens["brand-ink"], tokens["brand-surface"])
    ).toBeGreaterThanOrEqual(4.5)
    expect(fixed.site.tokens["brand-surface"]).toBeUndefined()
  })

  it("moves the brand green, not the navy text, for the consent button", () => {
    const config = withSite({ brand: "#1f3a10" })
    const issue = checkTheme(config).find(
      (i) => i.text === "brand-navy" && i.surface === "brand-green"
    )!
    expect(issue).toBeDefined()
    const fixed = fixIssue(config, issue)!
    expect(fixed.site.brand).not.toBe(config.site.brand)
    expect(fixed.site.tokens["brand-navy"]).toBeUndefined()
  })

  it("fixAll never leaves a theme with more failing pairs", () => {
    const configs = [
      withSite({ brand: "#000000" }),
      withSite({ brand: "#ffffff" }),
      withSite({ brand: "#000000", tokens: { "brand-muted": "#dddddd" } }),
      ThemeConfig.parse({ admin: { primary: "#000000", accent: "#ffff00" } }),
      ThemeConfig.parse({ admin: { primary: "#ffffff" } }),
    ]
    for (const config of configs) {
      const before = checkTheme(config).length
      const result = fixAll(config)
      expect(checkTheme(result.config).length).toBeLessThanOrEqual(before)
      expect(result.remaining.length).toBeLessThanOrEqual(before)
    }
  })
})
