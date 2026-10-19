import { describe, expect, it } from "vitest"

import {
  convertLegacyCustomCode,
  placementSnippets,
  routeMatches,
  SNIPPET_RULES_JS,
  runnableSnippets,
  snippetAllowed,
} from "@/lib/analytics/snippets"
import {
  type CustomCodeSettings,
  customCodeSettings,
  routePattern,
  type Snippet,
} from "@/lib/schemas/settings/custom-code"

const ID = "6f1c7a52-3b0e-4d6a-9f3e-2a1b4c5d6e7f"
const ID2 = "0b9d2c1e-8f7a-4e6d-b5c4-3a2918f7e6d5"

const snippet = (over: Partial<Snippet> = {}): Snippet => ({
  id: ID,
  name: "Probe",
  placement: "head",
  src: "",
  html: "<script>window.__probe=1</script>",
  category: "necessary",
  routes: [],
  enabled: true,
  ...over,
})

const settings = (
  over: Partial<CustomCodeSettings> = {}
): CustomCodeSettings => ({
  disabled: false,
  allowedHosts: [],
  snippets: [snippet()],
  ...over,
})

describe("routeMatches", () => {
  it.each([
    ["/", "/", true],
    ["/", "/blog", false],
    ["/blog/*", "/blog", true],
    ["/blog/*", "/blog/", true],
    ["/blog/*", "/blog/x", true],
    ["/blog/*", "/blog/x/y", true],
    ["/blog/*", "/blogs", false],
    ["/blog/*", "/blogs/x", false],
    ["/blog/*", "/", false],
    ["/about", "/about", true],
    ["/about", "/about/", true],
    ["/about/", "/about", true],
    ["/about", "/about/team", false],
    ["/about", "/abou", false],
    ["/*", "/", true],
    ["/*", "/anything/here", true],
  ])("%s vs %s → %s", (pattern, pathname, expected) => {
    expect(routeMatches(pattern, pathname)).toBe(expected)
  })
})

// The loader runs SNIPPET_RULES_JS in the browser; it must agree with the
// TypeScript rules everywhere (review D2.3 M4).
describe("SNIPPET_RULES_JS agrees with routeMatches and snippetAllowed", () => {
  const js = new Function(
    `${SNIPPET_RULES_JS};return {spMatches:spMatches,spRoutesMatch:spRoutesMatch,spAllowed:spAllowed}`
  )() as {
    spMatches(p: string, path: string): boolean
    spRoutesMatch(r: string[], path: string): boolean
    spAllowed(s: { category: string }, c: unknown): boolean
  }
  const patterns = ["/", "/*", "/blog/*", "/about", "/about/", "/a-b/c_d/*"]
  const paths = [
    "/",
    "/blog",
    "/blog/",
    "/blog/x/y",
    "/blogs",
    "/about",
    "/about/",
    "/about/team",
    "/a-b/c_d",
    "/a-b/c_d/e",
    "/a-b",
  ]

  it("route matching", () => {
    for (const p of patterns)
      for (const path of paths)
        expect(js.spMatches(p, path), `${p} vs ${path}`).toBe(
          routeMatches(p, path)
        )
  })

  it("routes: empty matches all, else any", () => {
    for (const routes of [[], ["/blog/*"], ["/", "/about"]])
      for (const path of paths) {
        const cfg = settings({ snippets: [snippet({ routes })] })
        expect(js.spRoutesMatch(routes, path), `${routes} vs ${path}`).toBe(
          runnableSnippets(cfg, path, "head").length === 1
        )
      }
  })

  it("consent gating", () => {
    const choices = [
      null,
      undefined,
      { analytics: false, marketing: false },
      { analytics: true, marketing: false },
      { analytics: false, marketing: true },
      { analytics: true, marketing: true },
    ]
    for (const category of ["necessary", "analytics", "marketing"] as const)
      for (const c of choices)
        expect(
          js.spAllowed({ category }, c),
          `${category} ${JSON.stringify(c)}`
        ).toBe(snippetAllowed(snippet({ category }), c ?? null))
  })

  it("is safe to inline: no <", () => {
    expect(SNIPPET_RULES_JS).not.toContain("<")
  })
})

describe("placementSnippets", () => {
  it("every enabled snippet of the placement, whatever its routes; [] when disabled", () => {
    const blog = snippet({ id: ID, routes: ["/blog/*"] })
    const off = snippet({ id: ID2, enabled: false })
    const body = snippet({ id: ID2, placement: "body" })
    expect(
      placementSnippets(settings({ snippets: [blog, off, body] }), "head")
    ).toEqual([blog])
    expect(
      placementSnippets(settings({ disabled: true, snippets: [blog] }), "head")
    ).toEqual([])
  })
})

describe("runnableSnippets", () => {
  it("returns [] when the kill switch is on", () => {
    expect(runnableSnippets(settings({ disabled: true }), "/", "head")).toEqual(
      []
    )
  })

  it("keeps enabled snippets of the placement whose routes match (empty = all)", () => {
    const all = snippet({ id: ID, routes: [] })
    const blog = snippet({ id: ID2, routes: ["/blog/*"] })
    const off = snippet({ id: ID, enabled: false })
    const body = snippet({ id: ID2, placement: "body" })
    const cfg = settings({ snippets: [all, blog, off, body] })
    expect(runnableSnippets(cfg, "/blog/x", "head")).toEqual([all, blog])
    expect(runnableSnippets(cfg, "/", "head")).toEqual([all])
    expect(runnableSnippets(cfg, "/blogs", "head")).toEqual([all])
    expect(runnableSnippets(cfg, "/", "body")).toEqual([body])
  })

  it("any matching route is enough", () => {
    const s = snippet({ routes: ["/", "/contact"] })
    expect(
      runnableSnippets(settings({ snippets: [s] }), "/contact/", "head")
    ).toHaveLength(1)
    expect(
      runnableSnippets(settings({ snippets: [s] }), "/about", "head")
    ).toEqual([])
  })
})

describe("snippetAllowed", () => {
  const yes = { analytics: true, marketing: true }
  const analyticsOnly = { analytics: true, marketing: false }
  it("necessary always runs, even without a choice", () => {
    expect(snippetAllowed(snippet({ category: "necessary" }), null)).toBe(true)
  })
  it("analytics and marketing wait for their own consent", () => {
    expect(snippetAllowed(snippet({ category: "analytics" }), null)).toBe(false)
    expect(
      snippetAllowed(snippet({ category: "analytics" }), analyticsOnly)
    ).toBe(true)
    expect(
      snippetAllowed(snippet({ category: "marketing" }), analyticsOnly)
    ).toBe(false)
    expect(snippetAllowed(snippet({ category: "marketing" }), yes)).toBe(true)
    expect(snippetAllowed(snippet({ category: "marketing" }), null)).toBe(false)
  })
})

describe("convertLegacyCustomCode", () => {
  it("non-empty head and body become necessary, all-route snippets", () => {
    const out = convertLegacyCustomCode({
      headHtml: '<meta name="a">',
      bodyEndHtml: "<script>1</script>",
    })
    expect(out.disabled).toBe(false)
    expect(out.allowedHosts).toEqual([])
    expect(out.snippets.map((s) => ({ ...s, id: "ID" }))).toEqual([
      {
        id: "ID",
        name: "Head code",
        placement: "head",
        src: "",
        html: '<meta name="a">',
        category: "necessary",
        routes: [],
        enabled: true,
      },
      {
        id: "ID",
        name: "Body code",
        placement: "body",
        src: "",
        html: "<script>1</script>",
        category: "necessary",
        routes: [],
        enabled: true,
      },
    ])
    expect(customCodeSettings.safeParse(out).success).toBe(true)
    expect(out.snippets[0]!.id).not.toBe(out.snippets[1]!.id)
  })

  it("empty or blank code gives no snippet", () => {
    expect(
      convertLegacyCustomCode({ headHtml: "  \n", bodyEndHtml: "" })
    ).toEqual({ disabled: false, allowedHosts: [], snippets: [] })
  })
})

describe("customCodeSettings schema", () => {
  const issuePaths = (value: unknown) => {
    const r = customCodeSettings.safeParse(value)
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."))
  }
  const withSrc = (src: string, allowedHosts = ["cdn.example.com"]) =>
    settings({
      allowedHosts,
      snippets: [snippet({ src, html: "" })],
    })

  it("accepts the seeded value and an https src on an allowed host", () => {
    expect(
      issuePaths({ disabled: false, allowedHosts: [], snippets: [] })
    ).toEqual([])
    expect(issuePaths(withSrc("https://cdn.example.com/a.js"))).toEqual([])
    expect(issuePaths(withSrc("https://CDN.example.com:443/a.js"))).toEqual([])
  })

  it("a src on a host that is not allowed is an error on snippets.0.src", () => {
    expect(issuePaths(withSrc("https://evil.example.net/a.js"))).toEqual([
      "snippets.0.src",
    ])
    expect(
      issuePaths(withSrc("https://cdn.example.com.evil.net/a.js"))
    ).toEqual(["snippets.0.src"])
    expect(issuePaths(withSrc("https://cdn.example.com/a.js", []))).toEqual([
      "snippets.0.src",
    ])
  })

  it("rejects credentials, a port, http and non-URLs", () => {
    expect(issuePaths(withSrc("https://user:pw@cdn.example.com/a.js"))).toEqual(
      ["snippets.0.src"]
    )
    expect(issuePaths(withSrc("https://user@cdn.example.com/a.js"))).toEqual([
      "snippets.0.src",
    ])
    expect(issuePaths(withSrc("https://cdn.example.com:8080/a.js"))).toEqual([
      "snippets.0.src",
    ])
    expect(issuePaths(withSrc("http://cdn.example.com/a.js"))).toEqual([
      "snippets.0.src",
    ])
    expect(issuePaths(withSrc("//cdn.example.com/a.js"))).toEqual([
      "snippets.0.src",
    ])
    expect(issuePaths(withSrc("javascript:alert(1)"))).toEqual([
      "snippets.0.src",
    ])
  })

  it("src and html together are rejected; one of them is required", () => {
    const both = settings({
      allowedHosts: ["cdn.example.com"],
      snippets: [snippet({ src: "https://cdn.example.com/a.js" })],
    })
    expect(issuePaths(both)).toEqual(["snippets.0.src"])
    const neither = settings({ snippets: [snippet({ html: "  " })] })
    expect(issuePaths(neither)).toEqual(["snippets.0.html"])
  })

  it("reports the failing snippet's own index", () => {
    const cfg = settings({
      allowedHosts: ["cdn.example.com"],
      snippets: [
        snippet(),
        snippet({ id: ID2, src: "https://other.example/a.js", html: "" }),
      ],
    })
    expect(issuePaths(cfg)).toEqual(["snippets.1.src"])
  })

  it("snippet ids are unique", () => {
    expect(issuePaths(settings({ snippets: [snippet(), snippet()] }))).toEqual([
      "snippets.1.id",
    ])
  })

  it("allowed hosts are bare host names", () => {
    for (const host of [
      "https://cdn.example.com",
      "cdn.example.com/x",
      "cdn.example.com:443",
      "localhost",
      "*.example.com",
    ])
      expect(issuePaths(settings({ allowedHosts: [host] }))).toEqual([
        "allowedHosts.0",
      ])
    const ok = customCodeSettings.parse(
      settings({ allowedHosts: [" CDN.Example.com "] })
    )
    expect(ok.allowedHosts).toEqual(["cdn.example.com"])
  })

  it("route patterns", () => {
    for (const ok of ["/", "/blog/*", "/a-b/c_d", "/*"])
      expect(routePattern.safeParse(ok).success).toBe(true)
    for (const bad of ["blog", "/blog*/x", "/a b", "/blog?x", "https://x/"])
      expect(routePattern.safeParse(bad).success).toBe(false)
  })

  it('"/blog*" and "//" are rejected with a clear message on the route (review D2.3 M3)', () => {
    for (const [bad, message] of [
      ["/blog*", /"\/blog\/\*" for a section/],
      ["/blog-x*", /"\/blog\/\*" for a section/],
      ["//blog", /double/],
      ["/blog//*", /double/],
    ] as const) {
      const r = routePattern.safeParse(bad)
      expect(r.success, bad).toBe(false)
      expect(r.error!.issues[0]!.message).toMatch(message)
    }
    expect(
      issuePaths(settings({ snippets: [snippet({ routes: ["/", "/blog*"] })] }))
    ).toEqual(["snippets.0.routes.1"])
  })
})
