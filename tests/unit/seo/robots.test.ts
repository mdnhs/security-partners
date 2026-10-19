import { describe, expect, it } from "vitest"

import { seoDefaultsSettings } from "@/lib/schemas/settings/seo-defaults"
import { buildRobots } from "@/lib/seo/sitemap"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"

const ORIGIN = "https://www.securitypartnersltd.com"

describe("site robots mode (D1.6)", () => {
  it("index: the existing rules and the sitemap line, unchanged", () => {
    expect(buildRobots(ORIGIN, "index")).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/api/v1/media/file/"],
          disallow: ["/admin", "/api"],
        },
      ],
      sitemap: `${ORIGIN}/sitemap.xml`,
    })
    expect(buildRobots(ORIGIN, "index")).toEqual(buildRobots(ORIGIN))
  })

  it("noindex: disallow everything and no sitemap line", () => {
    expect(buildRobots(ORIGIN, "noindex")).toEqual({
      rules: [{ userAgent: "*", disallow: "/" }],
    })
  })
})

describe("seo.defaults schema (D1.6)", () => {
  const seeded = () =>
    structuredClone(fixtureSiteSources().settings["seo.defaults"])

  it("seeded defaults: index, empty verification tokens", () => {
    const parsed = seoDefaultsSettings.parse(seeded())
    expect(parsed.robots).toBe("index")
    expect(parsed.verification).toEqual({ google: "", bing: "" })
  })

  it("the title pattern must contain {title}", () => {
    const value = { ...seeded(), titleTemplate: "Security Partners Ltd." }
    const result = seoDefaultsSettings.safeParse(value)
    expect(result.success).toBe(false)
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["titleTemplate"],
        message: "Include {title} where the page name goes",
      }),
    ])
  })

  it.each([
    ["<meta name=x>", false],
    ['abc" onload="x', false],
    ["abc def", false],
    ["a".repeat(101), false],
    ["a".repeat(100), true],
    ["AbC-12_x", true],
    ["", true],
  ])("verification token %j valid: %s", (token, ok) => {
    for (const engine of ["google", "bing"] as const) {
      const value = seeded()
      value.verification[engine] = token
      const result = seoDefaultsSettings.safeParse(value)
      expect(result.success).toBe(ok)
      if (!ok)
        expect(result.error?.issues[0]?.path).toEqual(["verification", engine])
    }
  })

  it("robots accepts only index or noindex", () => {
    expect(
      seoDefaultsSettings.safeParse({ ...seeded(), robots: "noindex" }).success
    ).toBe(true)
    expect(
      seoDefaultsSettings.safeParse({ ...seeded(), robots: "none" }).success
    ).toBe(false)
  })
})
