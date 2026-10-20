import "server-only"

import { type DbOrTx, getDb } from "@/server/db/client"
import { hashIp } from "@/server/lib/ip"
import { hitRateLimit } from "@/server/modules/rate-limit/repo"

export type RateLimitResult = {
  allowed: boolean
  count: number
  retryAfterSeconds: number
}

/** Spec §9: 5 enquiries per 10 minutes per IP. */
export const LEAD_RATE_LIMIT = {
  bucket: "leads",
  max: 5,
  windowMs: 10 * 60_000,
} as const

export function rateLimitKey(bucket: string, ip: string | null): string {
  return `${bucket}:${ip ? hashIp(ip) : "unknown"}`
}

export async function consumeRateLimit(
  key: string,
  opts: { max: number; windowMs: number; now?: Date },
  db: DbOrTx = getDb()
): Promise<RateLimitResult> {
  const now = opts.now ?? new Date()
  const { count, resetAt } = await hitRateLimit(db, key, now, opts.windowMs)
  return {
    allowed: count <= opts.max,
    count,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((resetAt.getTime() - now.getTime()) / 1000)
    ),
  }
}
