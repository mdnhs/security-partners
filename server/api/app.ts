import "server-only"

import { Hono } from "hono"
import { secureHeaders } from "hono/secure-headers"

import { HSTS } from "@/lib/security-headers"
import type { AppEnv } from "@/server/api/context"
import {
  requireSignedIn,
  sessionMiddleware,
} from "@/server/api/middleware/auth"
import { limitAdminBody, limitBody } from "@/server/api/middleware/body-limit"
import { notFoundHandler, onError } from "@/server/api/middleware/error"
import { requestIdMiddleware } from "@/server/api/middleware/request-id"
import { sameOrigin } from "@/server/api/middleware/same-origin"
import { getAuth } from "@/server/auth/auth"
import { aiRoutes } from "@/server/modules/ai/routes"
import { articlesRoutes } from "@/server/modules/articles/routes"
import { auditRoutes } from "@/server/modules/audit/routes"
import {
  categoriesRoutes,
  clientsRoutes,
  groupCompaniesRoutes,
  teamRoutes,
} from "@/server/modules/collections/routes"
import { dashboardRoutes } from "@/server/modules/dashboard/routes"
import { healthRoutes } from "@/server/modules/health/routes"
import { integrationsRoutes } from "@/server/modules/integrations/routes"
import { internalRoutes } from "@/server/modules/internal/routes"
import { leadsRoutes, publicLeadsRoutes } from "@/server/modules/leads/routes"
import { marketingRoutes } from "@/server/modules/marketing/routes"
import { mediaFileRoutes, mediaRoutes } from "@/server/modules/media/routes"
import { publicNewsletterRoutes } from "@/server/modules/newsletter/public-routes"
import { newsletterRoutes } from "@/server/modules/newsletter/routes"
import { pagesRoutes } from "@/server/modules/pages/routes"
import {
  adminPreviewRoutes,
  previewExitRoutes,
} from "@/server/modules/preview/routes"
import { redirectsRoutes } from "@/server/modules/redirects/routes"
import { reorderRoutes } from "@/server/modules/reorder/routes"
import { revisionsRoutes } from "@/server/modules/revisions/routes"
import { searchRoutes } from "@/server/modules/search/routes"
import { seoRoutes } from "@/server/modules/seo/routes"
import { servicesRoutes } from "@/server/modules/services/routes"
import { settingsRoutes } from "@/server/modules/settings/routes"
import { themeRoutes } from "@/server/modules/theme/routes"
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
  .route("/articles", articlesRoutes)
  .route("/revisions", revisionsRoutes)
  .route("/media", mediaRoutes)
  .route("/preview", adminPreviewRoutes)
  .route("/settings", settingsRoutes)
  .route("/services", servicesRoutes)
  .route("/team", teamRoutes)
  .route("/clients", clientsRoutes)
  .route("/group-companies", groupCompaniesRoutes)
  .route("/categories", categoriesRoutes)
  .route("/reorder", reorderRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/integrations", integrationsRoutes)
  .route("/leads", leadsRoutes)
  .route("/redirects", redirectsRoutes)
  .route("/marketing", marketingRoutes)
  .route("/seo", seoRoutes)
  .route("/ai", aiRoutes)
  .route("/appearance", themeRoutes)
  .route("/newsletter", newsletterRoutes)
export type AdminApi = typeof adminRoutes

/** Builds the API. Mount order follows spec §7; Phase 2 adds Better Auth + session middleware. */
export function createApp() {
  const api = new Hono<AppEnv>().basePath("/api")

  // 1. Global
  api.use("*", requestIdMiddleware)
  // Same HSTS as the pages (lib/security-headers.ts).
  api.use("*", secureHeaders({ strictTransportSecurity: HSTS }))
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

  // 3. Public endpoints: 64 KB body; leads add their own DB rate limit
  api.use("/v1/public/*", limitBody("public"))
  api.route("/v1/public/leads", publicLeadsRoutes)
  api.route("/v1/public/newsletter", publicNewsletterRoutes)

  // 4. Admin endpoints: session → signed in → same origin → body limit (1 MB; uploads 20 MB)
  api.use(
    "/v1/admin/*",
    sessionMiddleware,
    requireSignedIn,
    sameOrigin(),
    limitAdminBody
  )
  api.route("/v1/admin", adminRoutes)

  // Leaving draft-mode preview needs no session (cookies are cleared).
  api.route("/v1/preview", previewExitRoutes)

  // Scheduler → cache expiry (HMAC, HKDF "cron"; ledger ruling). Not admin:
  // no session; the signature is the authentication. No CORS: only the
  // server itself calls it.
  api.use("/v1/internal/*", limitBody("public"))
  api.route("/v1/internal", internalRoutes)

  // 5. Health
  api.route("/v1/health", healthRoutes)

  // 6. Media files (disk + R2), public and cacheable (spec §11)
  api.route("/v1/media/file", mediaFileRoutes)

  return api
}

export const app = createApp()
