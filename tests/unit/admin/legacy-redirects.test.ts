// @ts-expect-error -- Next ships its compiled copy without type declarations
import * as pathToRegexp from "next/dist/compiled/path-to-regexp"
import { describe, expect, it } from "vitest"

import { ADMIN_LEGACY_REDIRECTS } from "@/lib/admin/legacy-redirects"

type Params = Record<string, string | string[]>
const { compile, match } = pathToRegexp as {
  match: (source: string) => (path: string) => false | { params: Params }
  compile: (destination: string) => (params: Params) => string
}

// Next matches `redirects()` sources with this bundled path-to-regexp;
// resolve a path the same way (first matching rule wins, as in Next).
function resolve(path: string): string | null {
  for (const rule of ADMIN_LEGACY_REDIRECTS) {
    const found = match(rule.source)(path)
    if (found) return compile(rule.destination)(found.params)
  }
  return null
}

describe("ADMIN_LEGACY_REDIRECTS", () => {
  it.each([
    ["/admin/articles", "/admin/insights"],
    ["/admin/articles/new", "/admin/insights/new"],
    ["/admin/articles/0192abc", "/admin/insights/0192abc"],
    ["/admin/categories", "/admin/insights/categories"],
    ["/admin/team", "/admin/collections/team"],
    ["/admin/clients", "/admin/collections/clients"],
    ["/admin/group-companies", "/admin/collections/group-companies"],
  ])("%s → %s", (from, to) => expect(resolve(from)).toBe(to))

  it.each(["/admin/insights", "/admin/collections/team", "/admin", "/team"])(
    "leaves %s alone",
    (path) => expect(resolve(path)).toBeNull()
  )

  it("only admin sources, all permanent", () => {
    for (const rule of ADMIN_LEGACY_REDIRECTS) {
      expect(rule.source.startsWith("/admin/")).toBe(true)
      expect(rule.permanent).toBe(true)
    }
  })
})
