import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

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
  ["hero-foreground", "hero-to"],
  ["hero-delta", "hero-to"],
  ["hero-chip-foreground", "hero-chip"],
  ["promo-foreground", "promo-to"],
]

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

  // WCAG 1.4.11: control edges and the focus ring on every surface.
  it.each(["background", "card", "sidebar"])(
    "--input and --ring on --%s meet 3:1",
    (surface) => {
      expect(contrast(tokens.input, tokens[surface])).toBeGreaterThanOrEqual(3)
      expect(contrast(tokens.ring, tokens[surface])).toBeGreaterThanOrEqual(3)
    }
  )

  // Floating panels stand off the canvas; cards stand off the panels.
  it.each([
    ["sidebar", "background"],
    ["card", "sidebar"],
  ])("--%s is distinct from --%s", (a, b) => {
    expect(contrast(tokens[a], tokens[b])).toBeGreaterThanOrEqual(1.08)
  })
})

describe("admin stylesheet", () => {
  it("builds on the public entry without redefining it", () => {
    expect(css).toContain('@import "../../globals.css";')
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
