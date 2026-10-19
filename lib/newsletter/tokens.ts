import { createHash, createHmac } from "node:crypto"

/**
 * Newsletter token formats, pure so the service and the e2e share one
 * definition (the e2e cannot import server-only code). Server code passes
 * deriveKey("newsletter"); the e2e passes hkdfKey(secret, "newsletter").
 */
export const UNSUBSCRIBE_MAC_LENGTH = 32

/** HMAC-SHA256 with the newsletter key; `kind` separates the uses of the key. */
export function newsletterMac(
  key: Buffer,
  kind: "unsubscribe" | "email",
  value: string
): string {
  return createHmac("sha256", key)
    .update(`${kind}:${value}`)
    .digest("base64url")
}

/** `<id>.<HMAC("unsubscribe:" + id) base64url[:32]>`, never expires. */
export function formatUnsubscribeToken(key: Buffer, id: string): string {
  return `${id}.${newsletterMac(key, "unsubscribe", id).slice(0, UNSUBSCRIBE_MAC_LENGTH)}`
}

/** Only this sha256 (hex) of a confirm token is stored. */
export function confirmTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}
