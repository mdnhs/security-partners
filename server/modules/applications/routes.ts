import "server-only"

import { Hono } from "hono"

import {
  applicationFileParam,
  applicationListQuery,
  updateApplicationInput,
} from "@/lib/schemas/api/applications"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { rateLimit } from "@/server/api/middleware/rate-limit"
import { zv } from "@/server/api/validate"
import { clientIp } from "@/server/lib/ip"
import { CAREERS_RATE_LIMIT } from "@/server/lib/rate-limit"

import * as service from "./service"

/** /api/v1/public/careers/applications — multipart; body limit chosen in app.ts. */
export const publicApplicationsRoutes = new Hono<AppEnv>().post(
  "/",
  // Before parsing: every attempt from an IP counts.
  rateLimit(CAREERS_RATE_LIMIT),
  async (c) => {
    const form = await c.req.parseBody()
    return c.json(
      await service.submitApplication(form, {
        ip: clientIp(c.req.raw.headers),
      }),
      201
    )
  }
)

/** RFC 6266 filename: an ASCII fallback plus the UTF-8 name. */
const disposition = (name: string) =>
  `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`

/** /api/v1/admin/applications — static paths before /:id. */
export const applicationsRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ application: ["read"] }),
    zv("query", applicationListQuery),
    async (c) =>
      c.json(
        await service.listApplications(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .get("/badge", can({ application: ["read"] }), async (c) =>
    c.json(await service.applicationBadge(actorOf(c)), 200)
  )
  .get(
    "/:id/files/:kind",
    can({ application: ["read"] }),
    zv("param", applicationFileParam),
    async (c) => {
      const { id, kind } = c.req.valid("param")
      const file = await service.applicationFile(actorOf(c), id, kind)
      return c.body(file.body, 200, {
        "Content-Type": file.mime,
        "Content-Length": String(file.size),
        "Content-Disposition": disposition(file.name),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      })
    }
  )
  .get(
    "/:id",
    can({ application: ["read"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.getApplication(actorOf(c), c.req.valid("param").id),
        200
      )
  )
  .patch(
    "/:id",
    can({ application: ["update"] }),
    zv("param", idParam),
    zv("json", updateApplicationInput),
    async (c) =>
      c.json(
        await service.updateApplication(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ application: ["delete"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.deleteApplication(actorOf(c), c.req.valid("param").id),
        200
      )
  )
