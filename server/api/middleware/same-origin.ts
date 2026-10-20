import "server-only"

import { createMiddleware } from "hono/factory"

import type { AppEnv } from "@/server/api/context"
import { getEnv } from "@/server/env"
import { AppError } from "@/server/lib/errors"

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

const defaultAllowedOrigins = () => [new URL(getEnv().BETTER_AUTH_URL).origin]

/**
 * CSRF guard for cookie-authenticated admin routes: unsafe methods must carry
 * an Origin equal to the app origin (BETTER_AUTH_URL). Without an Origin header,
 * Sec-Fetch-Site must be "same-origin". Anything else → 403 FORBIDDEN.
 */
export const sameOrigin = (
  allowedOrigins: () => string[] = defaultAllowedOrigins
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (SAFE_METHODS.has(c.req.method)) return next()
    const origin = c.req.header("origin")
    const ok = origin
      ? allowedOrigins().includes(origin)
      : c.req.header("sec-fetch-site") === "same-origin"
    if (!ok) throw new AppError("FORBIDDEN", "Cross-origin request rejected")
    return next()
  })
