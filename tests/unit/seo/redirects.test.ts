import { describe, expect, it } from "vitest"

import {
  checkRedirectChain,
  fromPathProblem,
  noteProblem,
  redirectLocation,
  redirectTargetPath,
  toPathProblem,
} from "@/lib/seo/redirects"

describe("noteProblem (review D1.8 #2)", () => {
  it("allows text, TAB and line breaks; refuses NUL and other controls", () => {
    for (const ok of ["", "Old brochure", "a\tb", "a\r\nb", "Dinn Rí"])
      expect(noteProblem(ok), JSON.stringify(ok)).toBeNull()
    for (const bad of ["a\u0000b", "\u0001", "x\u001b[31m", "del\u007f"])
      expect(noteProblem(bad), JSON.stringify(bad)).toMatch(/control/)
  })
})

describe("redirect rules: builder pages (D5.2)", () => {
  it("from: /p and /p/ alone are refused; /p/<slug> is a normal source", () => {
    expect(fromPathProblem("/p")).not.toBeNull()
    expect(fromPathProblem("/P")).not.toBeNull()
    expect(fromPathProblem("/p/")).not.toBeNull()
    expect(fromPathProblem("/p/old-landing")).toBeNull()
    expect(fromPathProblem("/pages")).toBeNull()
  })
})

describe("redirect rules (review fix round 1)", () => {
  it("from: no %-escapes of unreserved characters (aliases)", () => {
    for (const bad of [
      "/%61dmin/x",
      "/%5fnext/x",
      "/%61bout",
      "/a%2Db",
      "/a%7e",
    ])
      expect(fromPathProblem(bad), bad).not.toBeNull()
    expect(fromPathProblem("/caf%C3%A9")).toBeNull()
    expect(fromPathProblem("/a%20b")).toBeNull()
  })

  it("the hop cap counts the whole chain, incoming runs included", () => {
    const edges = new Map([
      ["/h1", "/h2"],
      ["/h2", "/h3"],
      ["/h3", "/h4"],
      ["/h4", "/h5"],
      ["/h5", "/h6"],
    ])
    expect(checkRedirectChain(edges, "/h6", "/h7")).toEqual({
      ok: false,
      reason: "too-long",
      chain: ["/h1", "/h2", "/h3", "/h4", "/h5", "/h6", "/h7"],
    })
    edges.delete("/h1")
    expect(checkRedirectChain(edges, "/h6", "/h7")).toEqual({ ok: true })
    // Editing a redirect replaces its own edge: no self-counting.
    expect(checkRedirectChain(edges, "/h5", "/h6")).toEqual({ ok: true })
  })

  it("trailing slashes and own-origin URLs are the same path", () => {
    expect(redirectTargetPath("/b/?x=1")).toBe("/b")
    expect(redirectTargetPath("/")).toBe("/")
    expect(redirectTargetPath("https://x.ie/b/", "https://x.ie")).toBe("/b")
    expect(redirectTargetPath("https://x.ie/b")).toBeNull()
    expect(redirectTargetPath("https://y.ie/b", "https://x.ie")).toBeNull()
    expect(checkRedirectChain(new Map([["/b", "/a/"]]), "/a", "/b")).toEqual({
      ok: false,
      reason: "loop",
      chain: ["/a", "/b", "/a"],
    })
    const viaOrigin = new Map([["/b", "https://x.ie/a"]])
    expect(checkRedirectChain(viaOrigin, "/a", "/b")).toEqual({ ok: true })
    expect(
      checkRedirectChain(viaOrigin, "/a", "/b", "https://x.ie")
    ).toMatchObject({ ok: false, reason: "loop" })
  })
})

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
      // Newsletter state pages (D4.2) belong to the site.
      "/newsletter",
      "/newsletter/confirmed",
      "/Newsletter/unsubscribe",
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
