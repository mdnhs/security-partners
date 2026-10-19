import { describe, expect, it } from "vitest"

import { ADMIN_LEGACY_REDIRECTS } from "@/lib/admin/legacy-redirects"

/**
 * A minimal next.config `redirects()` matcher: `:name` is one segment,
 * `:name*` zero or more. Next passes the query string through unchanged.
 */
function compile(source: string) {
  const names: string[] = []
  const pattern = source
    .split("/")
    .map((part) => {
      const star = /^:(\w+)\*$/.exec(part)
      if (star) {
        names.push(star[1]!)
        return "(?:/(.*))?"
      }
      const one = /^:(\w+)$/.exec(part)
      if (one) {
        names.push(one[1]!)
        return "/([^/]+)"
      }
      return part ? `/${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` : ""
    })
    .join("")
  const re = new RegExp(`^${pattern}/?$`)
  return (path: string) => {
    const m = re.exec(path)
    if (!m) return null
    return Object.fromEntries(names.map((n, i) => [n, m[i + 1] ?? ""]))
  }
}

function resolve(url: string): string | null {
  const [path, query] = url.split("?") as [string, string | undefined]
  for (const r of ADMIN_LEGACY_REDIRECTS) {
    const params = compile(r.source)(path)
    if (!params) continue
    const to = r.destination
      .replace(/\/:(\w+)\*/g, (_, n: string) =>
        params[n] ? `/${params[n]}` : ""
      )
      .replace(/:(\w+)/g, (_, n: string) => params[n] ?? "")
    return query === undefined ? to : `${to}?${query}`
  }
  return null
}

describe("ADMIN_LEGACY_REDIRECTS (spec §5.2)", () => {
  it.each([
    ["/admin/marketing/tracking", "/admin/marketing"],
    ["/admin/marketing/custom-code", "/admin/marketing/code"],
    ["/admin/audit", "/admin/activity"],
    [
      "/admin/audit?actor=x&action=user.invite",
      "/admin/activity?actor=x&action=user.invite",
    ],
    ["/admin/settings/integrations/ai", "/admin/settings/ai-assistant"],
  ])("%s → %s", (from, to) => expect(resolve(from)).toBe(to))

  it("leaves the new paths and look-alikes alone", () => {
    for (const path of [
      "/admin/marketing",
      "/admin/marketing/consent",
      "/admin/activity",
      "/admin/audit-archive",
      "/admin/settings/integrations",
      "/admin/settings/integrations/smtp",
      "/admin/settings/integrations/ai-extra",
    ])
      expect(resolve(path)).toBeNull()
  })

  it("only admin sources, all permanent", () => {
    for (const r of ADMIN_LEGACY_REDIRECTS) {
      expect(r.source.startsWith("/admin/")).toBe(true)
      expect(r.permanent).toBe(true)
    }
  })
})
