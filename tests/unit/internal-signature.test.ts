import { createHmac } from "node:crypto"

import { describe, expect, it } from "vitest"

import { deriveKey } from "@/server/lib/crypto"
import {
  MAX_SKEW_SECONDS,
  signInternalRequest,
  verifyInternalRequest,
} from "@/server/lib/internal-signature"

const SECRET = "s".repeat(40)
const NOW = Date.UTC(2026, 9, 16, 12, 0, 0)
const BODY = '{"tags":["articles"]}'

describe("internal request signature (ledger: HKDF purpose cron)", () => {
  it("verifies its own signature within the time window", () => {
    const signed = signInternalRequest(BODY, NOW, SECRET)
    expect(signed.timestamp).toBe(String(NOW / 1000))
    expect(signed.signature).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(
      verifyInternalRequest({ body: BODY, ...signed }, NOW + 1_000, SECRET)
    ).toBe(true)
  })

  it("rejects tampering, another secret, stale or future timestamps and junk", () => {
    const signed = signInternalRequest(BODY, NOW, SECRET)
    const verify = (
      req: Partial<{
        body: string
        timestamp: string | null
        signature: string | null
      }>,
      now = NOW,
      secret = SECRET
    ) => verifyInternalRequest({ body: BODY, ...signed, ...req }, now, secret)
    expect(verify({ body: '{"tags":["page:home"]}' })).toBe(false)
    expect(verify({}, NOW, "t".repeat(40))).toBe(false)
    expect(verify({}, NOW + (MAX_SKEW_SECONDS + 1) * 1000)).toBe(false)
    expect(verify({}, NOW - (MAX_SKEW_SECONDS + 1) * 1000)).toBe(false)
    expect(verify({ timestamp: null })).toBe(false)
    expect(verify({ signature: null })).toBe(false)
    expect(verify({ timestamp: "12abc" })).toBe(false)
    expect(verify({ signature: "short" })).toBe(false)
  })

  it("uses the cron key: an HMAC with the preview key does not verify", () => {
    const timestamp = String(NOW / 1000)
    const signature = createHmac("sha256", deriveKey("preview", SECRET))
      .update(`${timestamp}.${BODY}`)
      .digest("base64url")
    expect(
      verifyInternalRequest({ body: BODY, timestamp, signature }, NOW, SECRET)
    ).toBe(false)
  })
})
