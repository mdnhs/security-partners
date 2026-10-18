import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import { deriveKey } from "@/server/lib/crypto"
import { hashIp } from "@/server/lib/ip"

const SECRET = "s".repeat(40)

describe("hashIp (spec §13: lead IPs stored as a salted hash)", () => {
  it("is HMAC-SHA256 with the lead-ip key, base64url, stable per secret", () => {
    const hash = hashIp("203.0.113.7", SECRET)
    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).toBe(hashIp("203.0.113.7", SECRET))
    expect(hash).toBe(
      createHmac("sha256", deriveKey("lead-ip", SECRET))
        .update("203.0.113.7")
        .digest("base64url")
    )
    expect(hash).not.toContain("203")
  })

  it("differs per IP and per secret, and does not reuse other key purposes", () => {
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(
      hashIp("203.0.113.8", SECRET)
    )
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(
      hashIp("203.0.113.7", "t".repeat(40))
    )
    expect(hashIp("203.0.113.7", SECRET)).not.toBe(
      createHmac("sha256", deriveKey("preview", SECRET))
        .update("203.0.113.7")
        .digest("base64url")
    )
  })
})
