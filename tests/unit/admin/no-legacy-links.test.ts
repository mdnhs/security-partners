import { globSync, readFileSync } from "node:fs"

import { expect, it } from "vitest"

import { ADMIN_LEGACY_REDIRECTS } from "@/lib/admin/legacy-redirects"

/**
 * MK parity §5.2: every internal admin link moved to the new path. A quoted
 * literal that starts with an old admin path (then a quote, `/` or `?`) is a
 * stale link; the old URLs only live on as redirects. The banned set is every
 * redirect source (static part), so each move's redirects (B2 content, B3
 * growth/admin) ban its old paths, plus the B3 paths listed explicitly.
 */
const SPEC_OLD = [
  "audit",
  "marketing/tracking",
  "marketing/custom-code",
  "settings/integrations/ai",
]
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const fromRedirects = ADMIN_LEGACY_REDIRECTS.map((r) =>
  r.source.split("/:")[0]!.replace(/^\/admin\//, "")
)
const OLD = new RegExp(
  `["'\`]/admin/(?:${[...new Set([...SPEC_OLD, ...fromRedirects])]
    .map(escape)
    .join("|")})(?:["'\`/?])`
)

/** Where the old paths are meant to appear: the redirects and their tests. */
const ALLOWED = new Set([
  "lib/admin/legacy-redirects.ts",
  "tests/unit/admin/legacy-redirects.test.ts",
  "tests/e2e/legacy-redirects.spec.ts",
  "tests/unit/admin/no-legacy-links.test.ts",
])

it("no source file links an old admin path", () => {
  const files = globSync("{app,components,lib,server,tests}/**/*.{ts,tsx}")
  expect(files.length).toBeGreaterThan(100)
  const hits = files
    .filter((f) => !ALLOWED.has(f))
    .filter((f) => OLD.test(readFileSync(f, "utf8")))
  expect(hits).toEqual([])
})

it("the pattern catches the old forms and spares the new ones", () => {
  expect(OLD.test(`href="/admin/audit"`)).toBe(true)
  expect(OLD.test("`/admin/audit?actor=${id}`")).toBe(true)
  expect(OLD.test(`"/admin/marketing/tracking"`)).toBe(true)
  expect(OLD.test(`'/admin/settings/integrations/ai'`)).toBe(true)
  expect(OLD.test(`"/admin/activity"`)).toBe(false)
  expect(OLD.test(`"/api/v1/admin/audit"`)).toBe(false)
  expect(OLD.test(`"/admin/settings/integrations/smtp"`)).toBe(false)
})
