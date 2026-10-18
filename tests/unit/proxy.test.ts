import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server"
import { type NextFetchEvent, NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { resolvePublicPath } = vi.hoisted(() => ({
  resolvePublicPath: vi.fn(),
}))
vi.mock("@/server/modules/redirects/resolve", () => ({
  MISSING_PATH: "/_sp-missing",
  resolvePublicPath,
}))

import {
  BLOCKING_METADATA_MARK,
  HTML_LIMITED_BOTS,
} from "@/lib/seo/blocking-metadata"
import { REQUEST_PATH_HEADER } from "@/lib/request-path"
import { config, proxy } from "@/proxy"

type Init = {
  cookie?: string
  method?: string
  headers?: Record<string, string>
}
const request = (path: string, init: Init = {}) =>
  new NextRequest(new URL(path, "http://127.0.0.1:3100"), {
    method: init.method ?? "GET",
    headers: {
      ...init.headers,
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
  })

const event = () => {
  const waitUntil = vi.fn()
  return { event: { waitUntil } as unknown as NextFetchEvent, waitUntil }
}
const run = (path: string, init?: Init) =>
  proxy(request(path, init), event().event)

beforeEach(() => {
  resolvePublicPath.mockReset()
  resolvePublicPath.mockResolvedValue({ kind: "pass" })
})

describe("proxy.ts matcher", () => {
  it("admin plus public pages; never /api, static files, OG cards, sitemap or robots", () => {
    expect(config.matcher).toEqual([
      "/admin/:path*",
      "/((?!api(?:/|$)|admin(?:/|$)|_next/|og/|images/|favicon\\.ico$|sitemap\\.xml$|robots\\.txt$).*)",
    ])
  })

  const matches = (matcher: string | string[], path: string) =>
    unstable_doesMiddlewareMatch({
      config: { matcher },
      url: `http://127.0.0.1:3100${path}`,
    })

  it("the public matcher skips only whole reserved segments and exact files", () => {
    const publicMatcher = config.matcher[1]
    for (const path of [
      "/",
      "/about",
      "/services/alarm-responses",
      "/apiary",
      "/api-docs",
      "/admin-old",
      "/administration",
      "/images-old",
      "/sitemap.xml.bak",
      "/old/robots.txt",
    ])
      expect(matches(publicMatcher, path), path).toBe(true)
    for (const path of [
      "/api",
      "/api/v1/x",
      "/admin",
      "/admin/x",
      "/_next/static/x",
      "/og/service/x",
      "/images/logo.svg",
      "/sitemap.xml",
      "/robots.txt",
      "/favicon.ico",
    ])
      expect(matches(publicMatcher, path), path).toBe(false)
  })

  it("the whole config still runs the admin gate and never sees /api", () => {
    for (const path of ["/admin", "/admin/x", "/admin-old", "/apiary"])
      expect(matches(config.matcher, path), path).toBe(true)
    for (const path of ["/api/v1/x", "/_next/static/x", "/robots.txt"])
      expect(matches(config.matcher, path), path).toBe(false)
  })
})

describe("proxy.ts (optimistic /admin gate)", () => {
  it("redirects /admin without a session cookie to /admin/sign-in?next=/admin", async () => {
    const res = await run("/admin")
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.pathname).toBe("/admin/sign-in")
    expect(location.searchParams.get("next")).toBe("/admin")
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
    expect(resolvePublicPath).not.toHaveBeenCalled()
  })

  it("keeps the query string in next", async () => {
    const res = await run("/admin/users?page=2")
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.searchParams.get("next")).toBe("/admin/users?page=2")
  })

  it("lets the auth pages through without a cookie", async () => {
    for (const path of [
      "/admin/sign-in",
      "/admin/two-factor",
      "/admin/set-password",
      "/admin/reset-password",
      "/admin/forgot-password",
    ]) {
      const res = await run(path)
      expect(res.headers.get("location"), path).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("lets requests with a session cookie through (http and https cookie names)", async () => {
    for (const cookie of [
      "sp.session_token=abc.def",
      "__Secure-sp.session_token=abc.def",
    ]) {
      const res = await run("/admin", { cookie })
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("sends a signed-in /admin/settings to the first key with a 307", async () => {
    const cookie = "sp.session_token=abc.def"
    const res = await run("/admin/settings", { cookie })
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.pathname).toBe("/admin/settings/site")
    expect(location.search).toBe("")
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
    // Only the exact path; keys and a signed-out visit are left alone.
    expect(
      (await run("/admin/settings/contact", { cookie })).headers.get("location")
    ).toBeNull()
    const signedOut = new URL(
      (await run("/admin/settings")).headers.get("location") ?? ""
    )
    expect(signedOut.pathname).toBe("/admin/sign-in")
  })

  it("does not treat look-alike paths as auth pages", async () => {
    expect((await run("/admin/sign-in-later")).status).toBe(307)
  })

  it("gates sub-paths of auth pages (only the exact page is public)", async () => {
    expect((await run("/admin/sign-in/anything")).status).toBe(307)
    expect((await run("/admin/sign-in/")).headers.get("location")).toBeNull()
  })
})

describe("proxy.ts (public pages: real 404 and redirects)", () => {
  it("lets live pages through untouched (no X-Robots-Tag)", async () => {
    const res = await run("/services/alarm-responses")
    expect(res.headers.get("x-middleware-next")).toBe("1")
    expect(res.headers.get("x-robots-tag")).toBeNull()
    expect(resolvePublicPath).toHaveBeenCalledWith(
      "/services/alarm-responses",
      { draft: false }
    )
  })

  it("rewrites a missing record to the catch-all 404", async () => {
    resolvePublicPath.mockResolvedValue({ kind: "missing" })
    const res = await run("/blog/nope")
    // NextRequest normalises loopback hosts to "localhost" (NextURL); at
    // runtime Next's adapter turns same-host URLs into relative ones.
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3100/_sp-missing"
    )
  })

  it("redirects with the stored code and counts the hit after responding", async () => {
    const recordHit = vi.fn().mockResolvedValue(undefined)
    resolvePublicPath.mockResolvedValue({
      kind: "redirect",
      to: "/services/new",
      code: 301,
      recordHit,
    })
    const { event: e, waitUntil } = event()
    const res = await proxy(request("/services/old?utm=x"), e)
    expect(res.status).toBe(301)
    expect(res.headers.get("location")).toBe(
      "http://localhost:3100/services/new?utm=x"
    )
    expect(recordHit).toHaveBeenCalledTimes(1)
    expect(waitUntil).toHaveBeenCalledTimes(1)
  })

  it("never waits for the hit write (a hung write cannot delay the redirect)", async () => {
    resolvePublicPath.mockResolvedValue({
      kind: "redirect",
      to: "/services/new?ref=old",
      code: 301,
      recordHit: () => new Promise<void>(() => undefined),
    })
    const res = await run("/services/old?utm=x", { method: "HEAD" })
    expect(res.status).toBe(301)
    // A target with its own query keeps it (and drops the request's).
    expect(res.headers.get("location")).toBe(
      "http://localhost:3100/services/new?ref=old"
    )
  })

  it("302 for temporary redirects", async () => {
    resolvePublicPath.mockResolvedValue({
      kind: "redirect",
      to: "https://example.ie/x",
      code: 302,
      recordHit: vi.fn().mockResolvedValue(undefined),
    })
    const res = await run("/promo")
    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe("https://example.ie/x")
  })

  it("previews (draft-mode cookie) skip the slug check", async () => {
    await run("/services/x", { cookie: "__prerender_bypass=abc" })
    expect(resolvePublicPath).toHaveBeenCalledWith("/services/x", {
      draft: true,
    })
  })

  it("a database failure inside the lookup never blocks the page", async () => {
    resolvePublicPath.mockRejectedValue(new Error("db down"))
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const res = await run("/services/x")
    expect(res.headers.get("x-middleware-next")).toBe("1")
    log.mockRestore()
  })

  it("only GET and HEAD are looked up", async () => {
    const res = await run("/contact", { method: "POST" })
    expect(resolvePublicPath).not.toHaveBeenCalled()
    expect(res.headers.get("x-middleware-next")).toBe("1")
  })
})

describe("proxy.ts (blocking metadata for public documents only)", () => {
  const CHROME = "Mozilla/5.0 (Macintosh) Chrome/140.0 Safari/537.36"
  /** The user agent the page renders with (NextResponse.next({ request })). */
  const renderedUa = (res: Response) =>
    res.headers
      .get("x-middleware-override-headers")
      ?.split(",")
      .includes("user-agent")
      ? res.headers.get("x-middleware-request-user-agent")
      : null

  it("marks the user agent of a public document request", async () => {
    const res = await run("/about", { headers: { "user-agent": CHROME } })
    expect(res.headers.get("x-middleware-next")).toBe("1")
    expect(renderedUa(res)).toBe(`${CHROME} ${BLOCKING_METADATA_MARK}`)
    expect(HTML_LIMITED_BOTS.test(renderedUa(res) ?? "")).toBe(true)
  })

  it("a request without a user agent is marked too", async () => {
    expect(renderedUa(await run("/"))).toBe(BLOCKING_METADATA_MARK)
  })

  it("the catch-all 404 rewrite is marked (its description is in <head>)", async () => {
    resolvePublicPath.mockResolvedValue({ kind: "missing" })
    const res = await run("/blog/nope", { headers: { "user-agent": CHROME } })
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3100/_sp-missing"
    )
    expect(renderedUa(res)).toBe(`${CHROME} ${BLOCKING_METADATA_MARK}`)
  })

  it("a failed lookup still serves the page with blocking metadata", async () => {
    resolvePublicPath.mockRejectedValue(new Error("db down"))
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const res = await run("/services/x", { headers: { "user-agent": CHROME } })
    expect(renderedUa(res)).toBe(`${CHROME} ${BLOCKING_METADATA_MARK}`)
    log.mockRestore()
  })

  it("never marks RSC requests (client navigations and prefetches)", async () => {
    for (const headers of [
      { "user-agent": CHROME, rsc: "1" } as Record<string, string>,
      { "user-agent": CHROME, rsc: "1", "next-router-prefetch": "1" },
    ]) {
      const res = await run("/about", { headers })
      expect(res.headers.get("x-middleware-next")).toBe("1")
      expect(renderedUa(res)).toBe(CHROME)
    }
  })

  it("strips a client-sent mark from RSC requests (no opting into bot rendering)", async () => {
    for (const ua of [
      `${CHROME} ${BLOCKING_METADATA_MARK}`,
      `${BLOCKING_METADATA_MARK} ${CHROME}`,
    ]) {
      const res = await run("/about", {
        headers: { "user-agent": ua, rsc: "1" },
      })
      expect(renderedUa(res)).toBe(CHROME)
      expect(HTML_LIMITED_BOTS.test(renderedUa(res) ?? "")).toBe(false)
    }
  })

  it("never marks admin requests", async () => {
    const res = await run("/admin", {
      cookie: "sp.session_token=abc.def",
      headers: { "user-agent": CHROME },
    })
    expect(renderedUa(res)).toBeNull()
  })

  it("only the mark makes metadata blocking (htmlLimitedBots)", () => {
    expect(HTML_LIMITED_BOTS.test(CHROME)).toBe(false)
    expect(HTML_LIMITED_BOTS.test("Googlebot/2.1")).toBe(false)
    expect(
      HTML_LIMITED_BOTS.test(`Googlebot/2.1 ${BLOCKING_METADATA_MARK}`)
    ).toBe(true)
  })
})

describe("proxy.ts (the public page's path for the preview exit)", () => {
  const forwarded = (res: Response) =>
    res.headers
      .get("x-middleware-override-headers")
      ?.split(",")
      .includes(REQUEST_PATH_HEADER)
      ? res.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)
      : null

  it("documents and RSC requests carry the path and query", async () => {
    expect(forwarded(await run("/terms?x=1"))).toBe("/terms?x=1")
    expect(forwarded(await run("/about", { headers: { rsc: "1" } }))).toBe(
      "/about"
    )
  })

  it("a client-sent value never reaches a POST (server action) either", async () => {
    const res = await run("/contact", {
      method: "POST",
      headers: { [REQUEST_PATH_HEADER]: "/elsewhere" },
    })
    expect(res.headers.get("x-middleware-next")).toBe("1")
    expect(res.headers.get("x-middleware-override-headers")).not.toBeNull()
    expect(forwarded(res)).toBeNull()
    expect(
      res.headers.get(`x-middleware-request-${REQUEST_PATH_HEADER}`)
    ).toBeNull()
  })

  it("a client-sent value is replaced", async () => {
    const res = await run("/about", {
      headers: { [REQUEST_PATH_HEADER]: "/elsewhere" },
    })
    expect(forwarded(res)).toBe("/about")
  })
})
