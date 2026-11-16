import { globSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

/**
 * MK parity C3: every public page wraps its request-time content in
 * SiteThemed, so the published brand overrides paint with (never after) the
 * content. A page with a bare `<Suspense>` would flash the default colours.
 * The catch-all only calls notFound() and renders nothing.
 */
const ROOT = "app/(site)"
const EXEMPT = new Set([`${ROOT}/[...notFound]/page.tsx`])
const pages = globSync(`${ROOT}/**/page.tsx`)
  .filter((f) => !EXEMPT.has(f))
  .sort()

/** Source with comments stripped, so a commented-out wrapper never counts. */
function source(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
}

describe("public pages use SiteThemed", () => {
  it("finds the public pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(10)
  })

  it("the exempt catch-all still exists", () => {
    expect(globSync(`${ROOT}/**/page.tsx`)).toEqual(
      expect.arrayContaining([...EXEMPT])
    )
  })

  it.each(pages)("%s renders inside SiteThemed", (file) => {
    const src = source(file)
    expect(src).toMatch(
      /import \{ SiteThemed \} from "@\/components\/site-themed"/
    )
    expect(src).toMatch(/<SiteThemed>/)
    expect(src, "no bare page-level Suspense").not.toMatch(/<Suspense\b/)
  })
})
