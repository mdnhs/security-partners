import "server-only"

import { lte, sql } from "drizzle-orm"

import type { DbOrTx } from "@/server/db/client"
import { publicRateLimits } from "@/server/db/schema"

/**
 * One atomic upsert: a new key or an expired window starts at 1 with a new
 * reset time, otherwise the count goes up and the reset time stays.
 */
export async function hitRateLimit(
  db: DbOrTx,
  key: string,
  now: Date,
  windowMs: number
): Promise<{ count: number; resetAt: Date }> {
  const at = sql`${now.toISOString()}::timestamptz`
  const [row] = await db
    .insert(publicRateLimits)
    .values({ key, count: 1, resetAt: new Date(now.getTime() + windowMs) })
    .onConflictDoUpdate({
      target: publicRateLimits.key,
      set: {
        count: sql`case when ${publicRateLimits.resetAt} <= ${at} then 1 else ${publicRateLimits.count} + 1 end`,
        resetAt: sql`case when ${publicRateLimits.resetAt} <= ${at} then excluded.reset_at else ${publicRateLimits.resetAt} end`,
      },
    })
    .returning({
      count: publicRateLimits.count,
      resetAt: publicRateLimits.resetAt,
    })
  return row
}

export async function deleteExpiredRateLimits(
  db: DbOrTx,
  now: Date
): Promise<number> {
  const rows = await db
    .delete(publicRateLimits)
    .where(lte(publicRateLimits.resetAt, now))
    .returning({ key: publicRateLimits.key })
  return rows.length
}
