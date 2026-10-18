import "server-only"

import { createHmac } from "node:crypto"

import { deriveKey } from "@/server/lib/crypto"

/**
 * Client IP per spec §4: first value of X-Forwarded-For (Traefik), fallback
 * X-Real-IP, else null. Values are stored in the audit log, never logged.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  return headers.get("x-real-ip")?.trim() || null
}

/** Spec §13: lead IPs are stored (and rate-limited) as HMAC-SHA256 with the "lead-ip" key. */
export function hashIp(ip: string, secret?: string): string {
  return createHmac("sha256", deriveKey("lead-ip", secret))
    .update(ip)
    .digest("base64url")
}
