import "server-only"

import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

import type { AppEnv } from "@/server/api/context"
import { clientIp } from "@/server/lib/ip"
import {
  consumeRateLimit,
  rateLimitKey,
  refundRateLimit,
} from "@/server/lib/rate-limit"

import { errorEnvelope } from "./error"

/**
 * DB-backed fixed window per client IP; over the limit → 429 + Retry-After.
 * `refund`: after the handler, an attempt it says should not count (a
 * replay, a fixable validation error) is given back.
 */
export const rateLimit = (opts: {
  bucket: string
  max: number
  windowMs: number
  refund?: (c: Context<AppEnv>) => boolean
}) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const key = rateLimitKey(opts.bucket, clientIp(c.req.raw.headers))
    const result = await consumeRateLimit(key, opts)
    if (!result.allowed)
      return c.json(
        errorEnvelope(c, "RATE_LIMITED", "Too many requests. Try again later."),
        429,
        { "Retry-After": String(result.retryAfterSeconds) }
      )
    await next()
    if (opts.refund?.(c)) await refundRateLimit(key)
  })
