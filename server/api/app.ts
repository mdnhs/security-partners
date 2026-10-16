import "server-only"

import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import type { AppEnv } from "@/server/api/context"
import {
  requireSignedIn,
  sessionMiddleware,
} from "@/server/api/middleware/auth"
import { limitBody } from "@/server/api/middleware/body-limit"
import { notFoundHandler, onError } from "@/server/api/middleware/error"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { getAuth } from "@/server/auth/auth"
import { auditRoutes } from "@/server/modules/audit/routes"
import { healthRoutes } from "@/server/modules/health/routes"
import { pagesRoutes } from "@/server/modules/pages/routes"
import { revisionsRoutes } from "@/server/modules/revisions/routes"
import { searchRoutes } from "@/server/modules/search/routes"
import { usersRoutes } from "@/server/modules/users/routes"

/**
 * Admin API routes, chained so `hc<AdminApi>` sees every route type.
 * Later phases add `.route("/<resource>", <resource>Routes)` here.
 */
export const adminRoutes = new Hono<AppEnv>()
  .route("/audit", auditRoutes)
  .route("/users", usersRoutes)
  .route("/search", searchRoutes)
  .route("/pages", pagesRoutes)
  .route("/revisions", revisionsRoutes)
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

  // 2. Better Auth (sign-in, sign-out, password reset, two-factor)
  api.on(["GET", "POST"], "/auth/*", limitBody("public"), (c) =>
    getAuth().handler(c.req.raw)
  )

  // 3. Public endpoints (rate limit added in Phase 7)
  api.use("/v1/public/*", limitBody("public"))

  // 4. Admin endpoints: session → signed in → same origin → 1 MB body
  api.use(
    "/v1/admin/*",
    sessionMiddleware,
    requireSignedIn,
    sameOrigin(),
    limitBody("admin")
  )
  api.route("/v1/admin", adminRoutes)

  // 5. Health
  api.route("/v1/health", healthRoutes)

  return api
}

export const app = createApp()
