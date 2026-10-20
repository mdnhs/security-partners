import "server-only"

import { createMiddleware } from "hono/factory"

import type { AppEnv } from "@/server/api/context"
import { clientIp } from "@/server/lib/ip"
import { consumeRateLimit, rateLimitKey } from "@/server/lib/rate-limit"

import { errorEnvelope } from "./error"

/** DB-backed fixed window per client IP; over the limit → 429 + Retry-After. */
export const rateLimit = (opts: {
  bucket: string
  max: number
  windowMs: number
}) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const result = await consumeRateLimit(
      rateLimitKey(opts.bucket, clientIp(c.req.raw.headers)),
      opts
    )
    if (!result.allowed)
      return c.json(
        errorEnvelope(c, "RATE_LIMITED", "Too many requests. Try again later."),
        429,
        { "Retry-After": String(result.retryAfterSeconds) }
      )
    await next()
  })
