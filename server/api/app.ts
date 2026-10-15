import "server-only"

import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import type { AppEnv } from "@/server/api/context"
import { limitBody } from "@/server/api/middleware/body-limit"
import { notFoundHandler, onError } from "@/server/api/middleware/error"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { healthRoutes } from "@/server/modules/health/routes"

/**
 * Admin API routes, chained so `hc<AdminApi>` sees every route type.
 * Later phases add `.route("/<resource>", <resource>Routes)` here.
 */
export const adminRoutes = new Hono<AppEnv>()
export type AdminApi = typeof adminRoutes

/** Builds the API. Mount order follows spec §7; Phase 2 adds Better Auth + session middleware. */
export function createApp() {
  const api = new Hono<AppEnv>().basePath("/api")

  // 1. Global
  api.use("*", requestIdMiddleware)
  api.use("*", secureHeaders())
  api.use("*", async (c, next) => {
    c.set("actor", null)
    await next()
    c.header("X-Robots-Tag", "noindex")
  })
  api.onError(onError)
  api.notFound(notFoundHandler)

  // 3. Public endpoints (rate limit added in Phase 7)
  api.use("/v1/public/*", limitBody("public"))

  // 4. Admin endpoints (session + signedIn inserted before sameOrigin in Phase 2)
  api.use("/v1/admin/*", sameOrigin(), limitBody("admin"))
  api.route("/v1/admin", adminRoutes)

  // 5. Health
  api.route("/v1/health", healthRoutes)

  return api
}

export const app = createApp()
