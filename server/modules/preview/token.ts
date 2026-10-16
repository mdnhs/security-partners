import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

import { deriveKey } from "@/server/lib/crypto"

/** Signed, short-lived proof that a signed-in admin opened a preview (spec §5.6). */
export const PREVIEW_COOKIE = "sp.preview"
export const PREVIEW_TTL_SECONDS = 60 * 60

const mac = (payload: string, secret?: string) =>
  createHmac("sha256", deriveKey("preview", secret))
    .update(payload)
    .digest("base64url")

/** "<userId>.<expires epoch s>.<HMAC-SHA256 base64url>" (HKDF purpose "preview"). */
export function signPreviewToken(
  userId: string,
  now = Date.now(),
  secret?: string
): string {
  const expires = Math.floor(now / 1000) + PREVIEW_TTL_SECONDS
  const payload = `${userId}.${expires}`
  return `${payload}.${mac(payload, secret)}`
}

/** The user the token was issued to, or null if malformed, forged or expired. */
export function verifyPreviewToken(
  token: string | undefined | null,
  now = Date.now(),
  secret?: string
): { userId: string } | null {
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [userId, expiresRaw, signature] = parts
  const expires = Number(expiresRaw)
  if (!userId || !Number.isInteger(expires)) return null
  const expected = Buffer.from(mac(`${userId}.${expiresRaw}`, secret))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given))
    return null
  if (expires * 1000 <= now) return null
  return { userId }
}
