import { describe, expect, it } from "vitest"

import nextConfig from "../../next.config"

const asObject = (headers: { key: string; value: string }[]) =>
  Object.fromEntries(headers.map((h) => [h.key, h.value]))

describe("security headers (spec §13)", () => {
  it("sends the hardening headers on every page except /api (Hono sets its own)", async () => {
    const rules = await nextConfig.headers!()
    expect(rules[0].source).toBe("/((?!api/).*)")
    expect(asObject(rules[0].headers)).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy":
        "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      "Strict-Transport-Security": "max-age=31536000",
      // No script/style/connect/img/frame restrictions: Next's inline
      // bootstrap (static shells, no nonce), consent-gated tags, Turnstile,
      // custom code and the AI panel keep working unchanged.
      "Content-Security-Policy":
        "base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
    })
  })

  it("never restricts where scripts, frames or requests may come from", async () => {
    const [pages] = await nextConfig.headers!()
    const csp = asObject(pages.headers)["Content-Security-Policy"]
    for (const directive of [
      "default-src",
      "script-src",
      "connect-src",
      "frame-src",
      "img-src",
      "style-src",
      "upgrade-insecure-requests",
    ])
      expect(csp).not.toContain(directive)
  })

  it("newsletter token pages: never cached or indexed, never a Referer", async () => {
    const rules = await nextConfig.headers!()
    const rule = rules.find((r) => r.source === "/newsletter/:path*")
    expect(rule).toBeDefined()
    // After the site-wide rule, so its Referrer-Policy wins.
    expect(rules.indexOf(rule!)).toBeGreaterThan(0)
    expect(asObject(rule!.headers)).toEqual({
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    })
  })

  it("forbids framing the admin at all (the later rule wins)", async () => {
    const rules = await nextConfig.headers!()
    expect(rules.at(-1)).toEqual({
      source: "/admin/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        {
          key: "Content-Security-Policy",
          value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
        },
      ],
    })
  })
})
