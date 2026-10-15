import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { config, proxy } from "@/proxy"

const request = (path: string, cookie?: string) =>
  new NextRequest(new URL(path, "http://127.0.0.1:3100"), {
    headers: cookie ? { cookie } : {},
  })

describe("proxy.ts (optimistic /admin gate)", () => {
  it("matches /admin only (never /api: upload bodies must not be buffered)", () => {
    expect(config.matcher).toEqual(["/admin/:path*"])
  })

  it("redirects /admin without a session cookie to /admin/sign-in?next=/admin", () => {
    const res = proxy(request("/admin"))
    expect(res.status).toBe(307)
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.pathname).toBe("/admin/sign-in")
    expect(location.searchParams.get("next")).toBe("/admin")
    expect(res.headers.get("x-robots-tag")).toBe("noindex")
  })

  it("keeps the query string in next", () => {
    const res = proxy(request("/admin/users?page=2"))
    const location = new URL(res.headers.get("location") ?? "")
    expect(location.searchParams.get("next")).toBe("/admin/users?page=2")
  })

  it("lets the auth pages through without a cookie", () => {
    for (const path of [
      "/admin/sign-in",
      "/admin/two-factor",
      "/admin/set-password",
      "/admin/reset-password",
      "/admin/forgot-password",
    ]) {
      const res = proxy(request(path))
      expect(res.headers.get("location"), path).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("lets requests with a session cookie through (http and https cookie names)", () => {
    for (const cookie of [
      "sp.session_token=abc.def",
      "__Secure-sp.session_token=abc.def",
    ]) {
      const res = proxy(request("/admin", cookie))
      expect(res.headers.get("location")).toBeNull()
      expect(res.headers.get("x-robots-tag")).toBe("noindex")
    }
  })

  it("does not treat look-alike paths as auth pages", () => {
    expect(proxy(request("/admin/sign-in-later")).status).toBe(307)
  })
})
