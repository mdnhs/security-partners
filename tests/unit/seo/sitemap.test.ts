import { describe, expect, it } from "vitest"

import { buildRobots, buildSitemap } from "@/lib/seo/sitemap"

const ORIGIN = "https://www.securitypartnersltd.com"
const when = new Date("2026-10-01T09:00:00Z")

describe("sitemap and robots", () => {
  it("lists indexable canonical URLs once, with lastmod when known", () => {
    expect(
      buildSitemap(
        [
          { path: "/", lastModified: when, noindex: false, canonical: null },
          {
            path: "/about",
            lastModified: null,
            noindex: false,
            canonical: null,
          },
          {
            path: "/terms",
            lastModified: when,
            noindex: true,
            canonical: null,
          },
          {
            path: "/blog/a",
            lastModified: when,
            noindex: false,
            canonical: "https://elsewhere.ie/a",
          },
          {
            path: "/blog/b",
            lastModified: when,
            noindex: false,
            canonical: `${ORIGIN}/blog/b`,
          },
          { path: "/", lastModified: when, noindex: false, canonical: null },
        ],
        ORIGIN
      )
    ).toEqual([
      { url: `${ORIGIN}/`, lastModified: when },
      { url: `${ORIGIN}/about` },
      { url: `${ORIGIN}/blog/b`, lastModified: when },
    ])
  })

  it("an origin with a trailing slash or a path still gives clean URLs", () => {
    expect(
      buildSitemap(
        [
          {
            path: "/about",
            lastModified: null,
            noindex: false,
            canonical: null,
          },
        ],
        "https://example.ie/"
      )
    ).toEqual([{ url: "https://example.ie/about" }])
    // An origin given with a path (e.g. a productionUrl of ".../home") keeps
    // only its origin.
    expect(
      buildSitemap(
        [
          {
            path: "/about",
            lastModified: null,
            noindex: false,
            canonical: null,
          },
        ],
        "https://example.ie/home/"
      )
    ).toEqual([{ url: "https://example.ie/about" }])
    expect(buildRobots("https://example.ie/sub/path").sitemap).toBe(
      "https://example.ie/sitemap.xml"
    )
  })

  it("robots: everything but /admin and /api (media files stay crawlable), plus the sitemap", () => {
    expect(buildRobots(ORIGIN)).toEqual({
      rules: [
        {
          userAgent: "*",
          allow: ["/", "/api/v1/media/file/"],
          disallow: ["/admin", "/api"],
        },
      ],
      sitemap: `${ORIGIN}/sitemap.xml`,
    })
  })
})
