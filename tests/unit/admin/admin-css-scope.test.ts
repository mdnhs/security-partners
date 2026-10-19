import { globSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

const root = path.join(import.meta.dirname, "../../..")
const css = readFileSync(path.join(root, "app/(admin)/admin/admin.css"), "utf8")

// Public-only utilities (app/globals.css brand colours, font-heading) and the
// public button variants. button.tsx defines the variants, so it is skipped.
const PUBLIC_ONLY =
  /\b(?:text|bg|border|ring|fill|stroke)-brand-|font-heading|variant="(?:brand|brand-outline[\w-]*|pill)"/

describe("admin stylesheet scope (spec §4.1)", () => {
  it("admin.css is its own Tailwind entry", () => {
    expect(css).not.toMatch(/globals\.css/)
    expect(css).toMatch(/@import "tailwindcss";/)
    expect(css).toMatch(/--font-sans: var\(--font-jakarta\)/)
    expect(css).toMatch(/--text-title--font-weight: 600/)
    expect(css).toMatch(/--text-card-title--font-weight: 600/)
    expect(css).toMatch(/--text-kpi--font-weight: 600/)
  })

  it("no admin file uses public-only classes or variants", () => {
    const files = globSync(
      [
        "components/admin/**/*.{ts,tsx}",
        "app/(admin)/**/*.{ts,tsx}",
        "components/ui/**/*.{ts,tsx}",
      ],
      { cwd: root }
    ).filter((f) => path.basename(f) !== "button.tsx")
    // The scan must actually reach all three trees.
    expect(files.some((f) => f.startsWith("app/(admin)/"))).toBe(true)
    expect(files.some((f) => f.startsWith("components/admin/"))).toBe(true)
    expect(files.some((f) => f.startsWith("components/ui/"))).toBe(true)
    const offenders = files.filter((f) =>
      PUBLIC_ONLY.test(readFileSync(path.join(root, f), "utf8"))
    )
    expect(offenders).toEqual([])
  })

  it("admin.css reads no public brand variables", () => {
    expect(css).not.toMatch(/--color-brand-|--font-heading/)
  })
})
