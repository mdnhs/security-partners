import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  ADMIN_CONTRAST_PAIRS,
  ADMIN_TOKEN_NAMES,
  SP_ADMIN_DARK,
  SP_ADMIN_LIGHT,
} from "@/lib/theme/sp-admin"

const css = readFileSync(
  path.join(import.meta.dirname, "../../../app/(admin)/admin/admin.css"),
  "utf8"
)
const publicCss = readFileSync(
  path.join(import.meta.dirname, "../../../app/globals.css"),
  "utf8"
)

/** Custom properties declared in the first `<selector> {` block. */
function declarations(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start === -1) throw new Error(`admin.css has no "${selector} {" block`)
  const body = css.slice(start, css.indexOf("}", start))
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [
      name,
      value.trim().toLowerCase(),
    ])
  )
}

const light = declarations("html[data-admin]")
// Dark only overrides; anything it leaves out falls back to light.
const dark = { ...light, ...declarations("html[data-admin].dark") }

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const REQUIRED = [
  "radius",
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "border",
  "input",
  "ring",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "sidebar",
  "sidebar-foreground",
  "sidebar-primary",
  "sidebar-primary-foreground",
  "sidebar-accent",
  "sidebar-accent-foreground",
  "sidebar-border",
  "sidebar-ring",
  "success",
  "success-soft",
  "warning",
  "warning-soft",
  "danger",
  "danger-soft",
  "skeleton",
  "hatch",
  "hero-from",
  "hero-to",
  "hero-foreground",
  "hero-chip",
  "hero-chip-foreground",
  "hero-delta",
  "promo-from",
  "promo-to",
  "promo-foreground",
]

// Text on the surfaces the admin actually puts it on (WCAG 1.4.3).
const TEXT_PAIRS: [text: string, surface: string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "sidebar"],
  ["foreground", "sidebar-accent"],
  ["muted-foreground", "card"],
  ["muted-foreground", "sidebar"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "sidebar-accent"],
  ["primary-foreground", "primary"],
  ["primary", "card"],
  ["primary", "sidebar"],
  ["accent-foreground", "accent"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["success", "card"],
  ["danger", "card"],
  ["hero-foreground", "hero-to"],
  ["hero-delta", "hero-to"],
  ["hero-chip-foreground", "hero-chip"],
  ["promo-foreground", "promo-to"],
]

// Chart marks the reader must perceive (WCAG 1.4.11): bars and swatches.
// --hatch (the striped comparison series) follows MK's light tint (spec
// §4.2) and is told apart by its stripes and the legend, not its colour.
const NON_TEXT_PAIRS: [mark: string, surface: string][] = [["chart-2", "card"]]

describe.each([
  ["light", light],
  ["dark", dark],
])("%s admin tokens", (_name, tokens) => {
  it.each(REQUIRED)("defines --%s", (token) => {
    expect(tokens[token]).toBeTruthy()
  })

  it.each(TEXT_PAIRS)("--%s on --%s meets 4.5:1", (text, surface) => {
    expect(contrast(tokens[text], tokens[surface])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(NON_TEXT_PAIRS)("--%s on --%s meets 3:1", (mark, surface) => {
    expect(contrast(tokens[mark], tokens[surface])).toBeGreaterThanOrEqual(3)
  })

  // WCAG 1.4.11: control edges and the focus ring on every surface.
  it.each(["background", "card", "sidebar"])(
    "--input and --ring on --%s meet 3:1",
    (surface) => {
      expect(contrast(tokens.input, tokens[surface])).toBeGreaterThanOrEqual(3)
      expect(contrast(tokens.ring, tokens[surface])).toBeGreaterThanOrEqual(3)
    }
  )

  // Soft destructive buttons (components/ui/button.tsx): --destructive text on
  // its own tint over the card (10 % light, 20 % dark). Axe flagged the old
  // reds at 4.1:1 / 3.9:1 on the record sheet's Delete button.
  it("--destructive on its own soft tint meets 4.5:1", () => {
    const tint = (hex: string, over: string, alpha: number) =>
      "#" +
      [1, 3, 5]
        .map((i) => {
          const top = parseInt(hex.slice(i, i + 2), 16)
          const under = parseInt(over.slice(i, i + 2), 16)
          return Math.round(top * alpha + under * (1 - alpha))
            .toString(16)
            .padStart(2, "0")
        })
        .join("")
    const alpha = tokens === light ? 0.1 : 0.2
    const soft = tint(tokens.destructive, tokens.card, alpha)
    expect(contrast(tokens.destructive, soft)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens.destructive, tokens.card)).toBeGreaterThanOrEqual(
      4.5
    )
  })

  // The editor's "Unsaved changes" pill is text-warning on bg-muted (final
  // review I5: the old #b45309 was 4.27:1 there).
  it.each(["muted", "card", "warning-soft"])(
    "--warning text on --%s meets 4.5:1",
    (surface) => {
      expect(contrast(tokens.warning, tokens[surface])).toBeGreaterThanOrEqual(
        4.5
      )
    }
  )

  // Focus ring of destructive buttons (final review M1): ring-destructive/60
  // over the card stays ≥ 3:1 (WCAG 1.4.11).
  it("the destructive focus ring at 60 % meets 3:1 on the card", () => {
    const mixed =
      "#" +
      [1, 3, 5]
        .map((i) => {
          const top = parseInt(tokens.destructive.slice(i, i + 2), 16)
          const under = parseInt(tokens.card.slice(i, i + 2), 16)
          return Math.round(top * 0.6 + under * 0.4)
            .toString(16)
            .padStart(2, "0")
        })
        .join("")
    expect(contrast(mixed, tokens.card)).toBeGreaterThanOrEqual(3)
  })

  // Floating panels stand off the canvas; cards stand off the panels.
  it.each([
    ["sidebar", "background"],
    ["card", "sidebar"],
  ])("--%s is distinct from --%s", (a, b) => {
    expect(contrast(tokens[a], tokens[b])).toBeGreaterThanOrEqual(1.08)
  })
})

describe("admin stylesheet", () => {
  it("is self-contained and scopes every token to html[data-admin]", () => {
    expect(css).not.toContain("globals.css")
    expect(css).not.toMatch(/(^|\n):root\s*\{/)
    expect(css).not.toMatch(/(^|\n)\.dark\s*\{/)
  })

  it.each([
    "--text-title:",
    "--text-card-title:",
    "--text-kpi:",
    "--radius-card:",
    "--color-success-soft:",
    "--color-skeleton:",
  ])("declares %s", (token) => {
    expect(css).toContain(token)
  })

  it("keeps the admin-only utilities out of the public stylesheet", () => {
    expect(publicCss).not.toContain("--radius-card")
    expect(publicCss).not.toContain("--text-kpi")
  })

  it("honours reduced motion inside the admin only", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*html\[data-admin\] \*/
    )
  })
})

describe("admin palette = SP_ADMIN (spec §4.2)", () => {
  it("names the 48 MK admin tokens", () => {
    expect(ADMIN_TOKEN_NAMES).toHaveLength(48)
    expect(new Set(ADMIN_TOKEN_NAMES).size).toBe(48)
    expect(Object.keys(SP_ADMIN_LIGHT).sort()).toEqual(
      [...ADMIN_TOKEN_NAMES].sort()
    )
  })
  it("light block declares every token with the table's value", () => {
    for (const name of ADMIN_TOKEN_NAMES)
      expect(light[name], name).toBe(SP_ADMIN_LIGHT[name])
    expect(light.radius).toBe("0.75rem")
  })
  it("dark block equals the dark overrides", () => {
    const own = declarations("html[data-admin].dark")
    expect(Object.keys(own).sort()).toEqual(Object.keys(SP_ADMIN_DARK).sort())
    for (const [name, value] of Object.entries(SP_ADMIN_DARK))
      expect(dark[name], name).toBe(value)
  })
  it("keeps the contrast-tuned destructive and warning (ruling 6)", () => {
    expect(light.destructive).toBe("#b91c1c")
    expect(dark.destructive).toBe("#fca5a5")
    expect(light.warning).toBe("#92400e")
  })
  it.each(["light", "dark"] as const)("%s pairs meet their minimum", (mode) => {
    const t = mode === "light" ? light : dark
    for (const [text, surface, min] of ADMIN_CONTRAST_PAIRS)
      expect(
        contrast(t[text], t[surface]),
        `${text} on ${surface}`
      ).toBeGreaterThanOrEqual(min)
  })
})
