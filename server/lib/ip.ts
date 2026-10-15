import "server-only"

/**
 * Client IP per spec §4: first value of X-Forwarded-For (Traefik), fallback
 * X-Real-IP, else null. Values are stored in the audit log, never logged.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded
  return headers.get("x-real-ip")?.trim() || null
}
