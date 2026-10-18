import { expect, test } from "@playwright/test"

// Spec §13 hardening headers (next.config.ts headers(); Hono covers /api),
// checked against the real server: next.config rules only apply there.

const COMMON = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy":
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  "strict-transport-security": "max-age=31536000",
}

test.describe("security headers", () => {
  for (const path of ["/", "/services", "/blog", "/contact"]) {
    test(`public page ${path} sends the hardening headers, frameable by itself only`, async ({
      request,
    }) => {
      const res = await request.get(path)
      expect(res.status()).toBe(200)
      const headers = res.headers()
      expect(headers).toMatchObject(COMMON)
      expect(headers["x-frame-options"]).toBe("SAMEORIGIN")
      const csp = headers["content-security-policy"]
      expect(csp).toBe(
        "base-uri 'self'; object-src 'none'; frame-ancestors 'self'"
      )
      // Consent-gated tags (googletagmanager), Turnstile
      // (challenges.cloudflare.com), custom code and Next's inline bootstrap
      // must never be blocked: no script/connect/frame/img restrictions.
      expect(csp).not.toMatch(/script-src|connect-src|frame-src|default-src/)
      expect(headers["x-powered-by"]).toBeUndefined()
    })
  }

  test("the admin is never framed", async ({ request }) => {
    const res = await request.get("/admin/sign-in")
    expect(res.status()).toBe(200)
    const headers = res.headers()
    expect(headers).toMatchObject(COMMON)
    expect(headers["x-frame-options"]).toBe("DENY")
    expect(headers["content-security-policy"]).toBe(
      "base-uri 'self'; object-src 'none'; frame-ancestors 'none'"
    )
  })

  test("/api keeps Hono's secureHeaders, without duplicated page headers", async ({
    request,
  }) => {
    const res = await request.get("/api/v1/health/live")
    expect(res.status()).toBe(200)
    const headers = res.headers()
    expect(headers["x-content-type-options"]).toBe("nosniff")
    expect(headers["x-frame-options"]).toBe("SAMEORIGIN")
    expect(headers["strict-transport-security"]).toBe("max-age=31536000")
    expect(headers["permissions-policy"]).toBeUndefined()
    expect(headers["content-security-policy"]).toBeUndefined()
  })

  test("the home page loads with no CSP violations", async ({ page }) => {
    const violations: string[] = []
    page.on("console", (message) => {
      if (/Content.Security.Policy/i.test(message.text()))
        violations.push(message.text())
    })
    await page.goto("/")
    await page.waitForLoadState("networkidle")
    expect(violations).toEqual([])
  })
})
