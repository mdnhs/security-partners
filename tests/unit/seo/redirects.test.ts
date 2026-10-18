import { describe, expect, it } from "vitest"

import {
  checkRedirectChain,
  fromPathProblem,
  redirectLocation,
  toPathProblem,
} from "@/lib/seo/redirects"

describe("redirect rules", () => {
  it("from: plain site paths only", () => {
    expect(fromPathProblem("/old-page")).toBeNull()
    expect(fromPathProblem("/services/old-name")).toBeNull()
    for (const bad of [
      "old",
      "/",
      "/old/",
      "//evil",
      "/a?b=1",
      "/a#b",
      "/admin",
      "/admin/x",
      "/api/v1/x",
      "/_next/static/x",
      "/_sp-missing",
      "/og/page/home",
      "/images/logo.png",
      "/old.html",
      "/wp-login.php",
      `/${"x".repeat(300)}`,
      // Hardening beyond the brief: dot segments, shape-changing escapes, case.
      "/a/../admin",
      "/a/./b",
      "/%2e%2e/admin",
      "/a%2Fb",
      "/a%5Cb",
      "/a%0d%0aSet-Cookie",
      "/a%zz",
      "/ADMIN/x",
      "/Api",
    ])
      expect(fromPathProblem(bad), bad).not.toBeNull()
  })

  it("to: the app href guard, site paths or http(s) only", () => {
    expect(toPathProblem("/services/alarm-responses")).toBeNull()
    expect(toPathProblem("/blog?category=news")).toBeNull()
    expect(toPathProblem("https://example.ie/x")).toBeNull()
    for (const bad of [
      "",
      "javascript:alert(1)",
      "//evil.example",
      "/\\evil.example",
      "mailto:a@b.ie",
      "tel:123",
      "#top",
      "{phone24hHref}",
      "data:text/html,x",
      // CR/LF header injection, tabs, protocol-relative via whitespace.
      "/x\r\nSet-Cookie: a=1",
      "https://x.ie/\nSet-Cookie: a=1",
      "/\t/evil.example",
      " /x",
      "https:evil.example",
    ])
      expect(toPathProblem(bad), bad).not.toBeNull()
  })

  it("loops and long chains are refused; external targets end a chain", () => {
    const edges = new Map([["/b", "/a"]])
    expect(checkRedirectChain(edges, "/a", "/b")).toEqual({
      ok: false,
      reason: "loop",
      chain: ["/a", "/b", "/a"],
    })
    expect(checkRedirectChain(new Map(), "/a", "/a?x=1")).toMatchObject({
      ok: false,
      reason: "loop",
    })
    expect(
      checkRedirectChain(new Map([["/b", "https://x.ie/a"]]), "/a", "/b")
    ).toEqual({ ok: true })
    const chain = new Map([
      ["/h2", "/h3"],
      ["/h3", "/h4"],
      ["/h4", "/h5"],
      ["/h5", "/h6"],
      ["/h6", "/h7"],
    ])
    expect(checkRedirectChain(chain, "/h1", "/h2")).toMatchObject({
      ok: false,
      reason: "too-long",
    })
    chain.delete("/h6")
    expect(checkRedirectChain(chain, "/h1", "/h2")).toEqual({ ok: true })
  })

  it("Location keeps the query unless the target has its own", () => {
    const req = new URL("https://x.ie/old?utm_source=a")
    expect(redirectLocation("/new", req).toString()).toBe(
      "https://x.ie/new?utm_source=a"
    )
    expect(redirectLocation("/new?b=1", req).toString()).toBe(
      "https://x.ie/new?b=1"
    )
    expect(redirectLocation("https://y.ie/z", req).toString()).toBe(
      "https://y.ie/z"
    )
  })
})
