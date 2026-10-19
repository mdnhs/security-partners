import { globSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { permissionFor } from "@/lib/admin/nav"

/**
 * MK parity B5: every panel page guards with `requirePage(href)`, so the nav
 * registry is the single source of a page's permission and a page missing
 * from the registry 404s instead of rendering unguarded. No exemptions: a
 * section index that only redirects guards too.
 */
const ROOT = "app/(admin)/admin/(panel)"
const pages = globSync(`${ROOT}/**/page.tsx`).sort()

/**
 * The URL a page file serves: route groups dropped, cut at the first
 * dynamic segment (dynamic routes guard with their static parent).
 */
function guardHref(file: string): string {
  const segments = file
    .slice(ROOT.length, -"/page.tsx".length)
    .split("/")
    .filter((s) => s && !/^\(.*\)$/.test(s))
  const dynamic = segments.findIndex((s) => s.startsWith("["))
  const fixed = dynamic === -1 ? segments : segments.slice(0, dynamic)
  return ["/admin", ...fixed].join("/")
}

/**
 * Pages whose action needs more than the registry's read permission for
 * their href: the page must keep its finer check next to requirePage.
 */
const FINER_CHECKS: Record<string, string> = {
  "insights/new/page.tsx": `requirePermission({ article: ["create"] })`,
  "services/new/page.tsx": `requirePermission({ service: ["create"] })`,
  "settings/[key]/page.tsx": "requirePermission(SETTINGS_ENTRIES[key].read)",
}

describe("panel page guards", () => {
  it("finds the panel pages", () => {
    expect(pages.length).toBeGreaterThan(25)
  })

  it.each(pages)(
    "%s guards with requirePage on its registered href",
    (file) => {
      // Comments stripped, so a commented-out guard never counts.
      const src = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
      const calls = [...src.matchAll(/requirePage\(\s*([^)]*)\)/g)]
      expect(calls, "calls requirePage").toHaveLength(1)
      const m = calls[0]![1]!.match(/^"([^"]+)"$/)
      expect(m, "requirePage takes a string literal").not.toBeNull()
      expect(src, "the guard is awaited").toMatch(/await requirePage\("/)
      const href = m![1]!
      expect(href, "the page's own URL (static parent for [params])").toBe(
        guardHref(file)
      )
      expect(permissionFor(href), "href is in the nav registry").not.toBe(
        undefined
      )
    }
  )

  it.each(Object.entries(FINER_CHECKS))(
    "%s keeps its finer check",
    (rel, check) => {
      expect(readFileSync(`${ROOT}/${rel}`, "utf8")).toContain(check)
    }
  )

  it("maps page files to guard hrefs", () => {
    expect(guardHref(`${ROOT}/page.tsx`)).toBe("/admin")
    expect(guardHref(`${ROOT}/insights/[id]/page.tsx`)).toBe("/admin/insights")
    expect(guardHref(`${ROOT}/settings/integrations/[slug]/page.tsx`)).toBe(
      "/admin/settings/integrations"
    )
    expect(guardHref(`${ROOT}/(group)/media/page.tsx`)).toBe("/admin/media")
  })
})
