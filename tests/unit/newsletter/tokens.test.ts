import { createHash, createHmac, hkdfSync } from "node:crypto"

import { describe, expect, it } from "vitest"

import { hkdfKey } from "@/lib/crypto/hkdf"
import {
  confirmTokenHash,
  formatUnsubscribeToken,
} from "@/lib/newsletter/tokens"

const SECRET = "x".repeat(32)
const ID = "0190f3a2-1111-7000-8000-000000000001"

describe("newsletter token helpers (shared by the service and the e2e)", () => {
  it("hkdfKey: HKDF-SHA256(secret, salt sp/v1, info purpose), 32 bytes", () => {
    expect(hkdfKey(SECRET, "newsletter")).toEqual(
      Buffer.from(hkdfSync("sha256", SECRET, "sp/v1", "newsletter", 32))
    )
  })

  it("unsubscribe token: <id>.<HMAC('unsubscribe:'+id) base64url[:32]>", () => {
    const key = hkdfKey(SECRET, "newsletter")
    const mac = createHmac("sha256", key)
      .update(`unsubscribe:${ID}`)
      .digest("base64url")
    expect(formatUnsubscribeToken(key, ID)).toBe(`${ID}.${mac.slice(0, 32)}`)
  })

  it("confirm token hash: sha256 hex (only the hash is stored)", () => {
    expect(confirmTokenHash("abc")).toBe(
      createHash("sha256").update("abc").digest("hex")
    )
  })
})
