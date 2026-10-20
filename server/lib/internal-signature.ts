import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { deriveKey } from "./crypto"

// Server-to-itself requests (scheduler → /api/v1/internal/*): HMAC-SHA256
// with the HKDF "cron" key over "<unix seconds>.<raw body>" (ledger ruling).

export const TIMESTAMP_HEADER = "x-sp-timestamp"
export const SIGNATURE_HEADER = "x-sp-signature"
/** Accepted clock skew, and how long a captured request could be replayed. */
export const MAX_SKEW_SECONDS = 300

const mac = (timestamp: string, body: string, secret?: string) =>
  createHmac("sha256", deriveKey("cron", secret))
    .update(`${timestamp}.${body}`)
    .digest("base64url")

export function signInternalRequest(
  body: string,
  now = Date.now(),
  secret?: string
): { timestamp: string; signature: string } {
  const timestamp = String(Math.floor(now / 1000))
  return { timestamp, signature: mac(timestamp, body, secret) }
}

export function verifyInternalRequest(
  req: {
    body: string
    timestamp: string | null | undefined
    signature: string | null | undefined
  },
  now = Date.now(),
  secret?: string
): boolean {
  const { body, timestamp, signature } = req
  if (!timestamp || !signature || !/^\d{1,12}$/.test(timestamp)) return false
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > MAX_SKEW_SECONDS)
    return false
  const expected = Buffer.from(mac(timestamp, body, secret))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
