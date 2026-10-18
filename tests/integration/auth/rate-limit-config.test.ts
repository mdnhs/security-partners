import { afterEach, describe, expect, it } from "vitest"

import { getAuth } from "@/server/auth/auth"

// Next types NODE_ENV as read-only; the test flips it.
const ENV = process.env as Record<string, string | undefined>
const saved = ENV.NODE_ENV
afterEach(() => {
  ENV.NODE_ENV = saved
})

describe("Better Auth rate limits (spec §6, §13)", () => {
  it("are on in production, stored in Postgres, strict on sign-in, 2FA and resets", () => {
    ENV.NODE_ENV = "production"
    const { rateLimit, advanced } = getAuth().options
    expect(rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/two-factor/*": { window: 60, max: 5 },
        "/request-password-reset": { window: 300, max: 3 },
      },
    })
    // Traefik overwrites X-Forwarded-For with the client address (single
    // value); X-Real-Ip is the fallback (docs/runbook.md "Client IPs").
    expect(advanced?.ipAddress?.ipAddressHeaders).toEqual([
      "x-forwarded-for",
      "x-real-ip",
    ])
  })

  it("are off outside production (tests, dev)", () => {
    ENV.NODE_ENV = "test"
    expect(getAuth().options.rateLimit?.enabled).toBe(false)
  })
})
