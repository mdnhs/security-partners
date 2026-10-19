import { describe, expect, it } from "vitest"

import {
  adminThemeCss,
  liveDeclarations,
  SCOPES,
  siteThemeCss,
} from "@/lib/theme/css"
import { ColorValue, DEFAULT_THEME, ThemeConfig } from "@/lib/theme/schema"

const SAFE = /^[a-z0-9\-:;(){}.\[\]="\s]*$/i

describe("siteThemeCss", () => {
  it("default theme emits nothing", () => {
    expect(siteThemeCss(DEFAULT_THEME.site)).toBe("")
    expect(adminThemeCss(DEFAULT_THEME.admin)).toBe("")
  })

  it("a brand change emits only the green family on :root", () => {
    const css = siteThemeCss({
      ...DEFAULT_THEME.site,
      brand: ColorValue.parse("#2f5f8a"),
    })
    expect(css).toMatch(
      /^:root\{--color-brand-green:oklch\([^)]+\);--color-brand-green-dark:oklch\([^)]+\);--color-brand-mint:oklch\([^)]+\)\}$/
    )
  })

  it("a locked token emits only that token", () => {
    const site = ThemeConfig.parse({
      site: { tokens: { "brand-navy": "#102040" } },
    }).site
    expect(siteThemeCss(site)).toMatch(
      /^:root\{--color-brand-navy:oklch\([\d.]+ [\d.]+ [\d.]+\)\}$/
    )
  })

  it("no NaN for black, white and greys", () => {
    for (const brand of ["#000000", "#ffffff", "#808080"]) {
      const css = siteThemeCss(ThemeConfig.parse({ site: { brand } }).site)
      expect(css).not.toContain("NaN")
      expect(css).toMatch(SAFE)
    }
  })
})

describe("adminThemeCss", () => {
  it("admin primary change emits light and dark blocks, radius only when changed", () => {
    const css = adminThemeCss({
      ...DEFAULT_THEME.admin,
      primary: ColorValue.parse("#157d38"),
      radius: 0.5,
    })
    expect(css).toContain("html[data-admin]{")
    expect(css).toContain("html[data-admin].dark{")
    expect(css).toContain("--radius:0.5rem")
    expect(css).not.toMatch(/--destructive:/)
    expect(css).toMatch(SAFE)
  })

  it("radius alone emits only the radius", () => {
    expect(adminThemeCss({ ...DEFAULT_THEME.admin, radius: 1 })).toBe(
      "html[data-admin]{--radius:1rem}"
    )
  })

  it("uses the SP admin scopes", () => {
    expect(SCOPES).toEqual({
      site: ":root",
      admin: "html[data-admin]",
      adminDark: "html[data-admin].dark",
    })
  })
})

describe("liveDeclarations", () => {
  it("lists every admin token and the radius", () => {
    const decls = liveDeclarations(DEFAULT_THEME.admin, "light")
    expect(decls).toHaveLength(49)
    expect(decls).toContainEqual(["--radius", "0.75rem"])
    expect(decls.find(([n]) => n === "--primary")?.[1]).toMatch(/^oklch\(/)
  })
})

describe("serialiser safety", () => {
  const MALICIOUS = [
    "red;}</style><script>alert(1)</script>",
    "#367318;}</style><script>",
    "oklch(0.5 0.1 200);}",
    "oklch(1 0 0);--x:1",
    "var(--x)",
    "red",
    "#".padEnd(10_000, "a"),
  ]

  it.each(MALICIOUS)("rejects %s at Zod parse", (value) => {
    expect(ThemeConfig.safeParse({ site: { brand: value } }).success).toBe(
      false
    )
    expect(
      ThemeConfig.safeParse({ site: { tokens: { "brand-navy": value } } })
        .success
    ).toBe(false)
    expect(ThemeConfig.safeParse({ admin: { primary: value } }).success).toBe(
      false
    )
    expect(ThemeConfig.safeParse({ admin: { accent: value } }).success).toBe(
      false
    )
  })

  it("reports the colour error message", () => {
    const parsed = ColorValue.safeParse("red")
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(
      "Use a #rrggbb or oklch(L C H) colour"
    )
  })

  it("rejects unknown token names", () => {
    const parsed = ThemeConfig.safeParse({
      site: { tokens: { "x}</style>": "#000000" } },
    })
    expect(parsed.success).toBe(false)
  })
})
