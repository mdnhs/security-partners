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
// resolve a URL the same way (first matching rule wins, as in Next). Next
// passes the query string through unchanged.
function resolve(url: string): string | null {
  const [path, query] = url.split("?") as [string, string | undefined]
  for (const rule of ADMIN_LEGACY_REDIRECTS) {
    const found = match(rule.source)(path)
    if (!found) continue
    const to = compile(rule.destination)(found.params)
    return query === undefined ? to : `${to}?${query}`
  }
  return null
}

describe("ADMIN_LEGACY_REDIRECTS (spec §5.2)", () => {
  it.each([
    // B2: Insights and Collections.
    ["/admin/articles", "/admin/insights"],
    ["/admin/articles/new", "/admin/insights/new"],
    ["/admin/articles/0192abc", "/admin/insights/0192abc"],
    ["/admin/categories", "/admin/insights/categories"],
    ["/admin/team", "/admin/collections/team"],
    ["/admin/clients", "/admin/collections/clients"],
    ["/admin/group-companies", "/admin/collections/group-companies"],
    // B3: Growth and admin pages.
    ["/admin/marketing/tracking", "/admin/marketing"],
    ["/admin/marketing/custom-code", "/admin/marketing/code"],
    ["/admin/audit", "/admin/activity"],
    [
      "/admin/audit?actor=x&action=user.invite",
      "/admin/activity?actor=x&action=user.invite",
    ],
    ["/admin/settings/integrations/ai", "/admin/settings/ai-assistant"],
  ])("%s → %s", (from, to) => expect(resolve(from)).toBe(to))

  it.each([
    "/admin/insights",
    "/admin/collections/team",
    "/admin",
    "/team",
    "/admin/marketing",
    "/admin/marketing/consent",
    "/admin/activity",
    "/admin/audit-archive",
    "/admin/settings/integrations",
    "/admin/settings/integrations/smtp",
    "/admin/settings/integrations/ai-extra",
  ])("leaves %s alone", (path) => expect(resolve(path)).toBeNull())

  it("only admin sources, all permanent", () => {
    for (const rule of ADMIN_LEGACY_REDIRECTS) {
      expect(rule.source.startsWith("/admin/")).toBe(true)
      expect(rule.permanent).toBe(true)
    }
  })
})
