import "server-only"

import { Hono } from "hono"

import { isoDate } from "@/lib/format"
import {
  subscriberExportQuery,
  subscriberListQuery,
} from "@/lib/schemas/api/newsletter"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** /api/v1/admin/newsletter — permission before validation; static paths before /:id. */
export const newsletterRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ newsletter: ["read"] }),
    zv("query", subscriberListQuery),
    async (c) =>
      c.json(
        await service.listSubscribers(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .get(
    "/export.csv",
    can({ newsletter: ["export"] }),
    zv("query", subscriberExportQuery),
    async (c) => {
      const csv = await service.exportSubscribers(
        actorOf(c),
        c.req.valid("query").status
      )
      return c.body(csv, 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="subscribers-${isoDate(new Date())}.csv"`,
        "Cache-Control": "no-store",
      })
    }
  )
  .delete(
    "/:id",
    can({ newsletter: ["delete"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.deleteSubscriber(actorOf(c), c.req.valid("param").id),
        200
      )
  )
