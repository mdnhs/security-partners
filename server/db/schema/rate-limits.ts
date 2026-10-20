import "server-only"

import { index, integer, pgTable, text } from "drizzle-orm/pg-core"

import { tsz } from "./_shared"

/**
 * Fixed-window counters for public endpoints (spec §7 "rate limit
 * (DB-backed)"). key = "<bucket>:<HMAC of the client IP>", never a raw IP.
 */
export const publicRateLimits = pgTable(
  "public_rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: tsz("reset_at").notNull(),
  },
  (t) => [index("public_rate_limits_reset_at_idx").on(t.resetAt)]
)
