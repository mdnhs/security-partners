import { readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  isLegalSlug,
  isReservedLegalSlug,
  LEGAL_SLUG_MAX,
  RESERVED_LEGAL_SLUGS,
} from "@/lib/legal-slug"
import { legalSlug } from "@/lib/schemas/api/legal-pages"
import { PAGE_PATHS } from "@/templates/registry"

const APP = join(process.cwd(), "app")

/** Folder names under `dir` that are plain route segments (not groups or params). */
const segments = (dir: string) =>
  readdirSync(join(APP, dir), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !/^[([_]/.test(e.name))
    .map((e) => e.name)

describe("reserved legal slugs", () => {
  it("cover every static route of the public site, so a legal page can never shadow one", () => {
    const routes = [
      ...segments("(site)"),
      ...segments("."), // app/api, app/og, …
      ...Object.values(PAGE_PATHS)
        .map((path) => path.split("/")[1])
        .filter(Boolean),
      // The admin lives in the (admin) group at /admin.
      "admin",
    ]
    for (const route of routes)
      expect(isReservedLegalSlug(route), `/${route} must be reserved`).toBe(
        true
      )
  })

  it("cover the root files the app serves", () => {
    for (const name of ["sitemap", "robots", "favicon"])
      expect(isReservedLegalSlug(name)).toBe(true)
  })

  it("has no duplicates", () => {
    expect(new Set(RESERVED_LEGAL_SLUGS).size).toBe(RESERVED_LEGAL_SLUGS.length)
  })
})

describe("legal slug rules", () => {
  it("accepts lower-case words joined by single hyphens", () => {
    for (const slug of ["cookie-policy", "a", "gdpr-2026", "x1-y2-z3"])
      expect(isLegalSlug(slug), slug).toBe(true)
  })

  it("rejects everything else", () => {
    for (const slug of [
      "",
      "Cookie",
      "cookie_policy",
      "-cookie",
      "cookie-",
      "cookie--policy",
      "cookie policy",
      "a/b",
      "../x",
      "cookie.html",
      "about",
      "a".repeat(LEGAL_SLUG_MAX + 1),
    ])
      expect(isLegalSlug(slug), JSON.stringify(slug)).toBe(false)
  })

  it("the API schema agrees with the plain check", () => {
    for (const slug of ["cookie-policy", "about", "Cookie", "x".repeat(61)])
      expect(legalSlug.safeParse(slug).success).toBe(isLegalSlug(slug))
  })
})
