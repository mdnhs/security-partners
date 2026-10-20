import "server-only"

import { Hono } from "hono"

import {
  leadExportQuery,
  leadListQuery,
  leadNoteInput,
  leadSubmission,
  updateLeadInput,
} from "@/lib/schemas/api/leads"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { rateLimit } from "@/server/api/middleware/rate-limit"
import { zv } from "@/server/api/validate"
import { clientIp } from "@/server/lib/ip"
import { LEAD_RATE_LIMIT } from "@/server/lib/rate-limit"

import * as service from "./service"

/** /api/v1/public/leads — no session; 64 KB body limit is mounted in app.ts. */
export const publicLeadsRoutes = new Hono<AppEnv>()
  .get("/config", async (c) => {
    c.header("Cache-Control", "no-store")
    return c.json(await service.publicFormConfig(), 200)
  })
  .post(
    "/",
    // Before validation: every attempt from an IP counts.
    rateLimit(LEAD_RATE_LIMIT),
    zv("json", leadSubmission),
    async (c) => {
      await service.submitLead(c.req.valid("json"), {
        ip: clientIp(c.req.raw.headers),
      })
      return c.json({ ok: true as const }, 200)
    }
  )

/** /api/v1/admin/leads — static paths before /:id. */
export const leadsRoutes = new Hono<AppEnv>()
  .get("/", can({ lead: ["read"] }), zv("query", leadListQuery), async (c) =>
    c.json(await service.listLeads(actorOf(c), c.req.valid("query")), 200)
  )
  .get(
    "/export.csv",
    can({ lead: ["export"] }),
    zv("query", leadExportQuery),
    async (c) => {
      const { csv, filename } = await service.exportLeads(
        actorOf(c),
        c.req.valid("query")
      )
      return c.body(csv, 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      })
    }
  )
  .get("/assignees", can({ lead: ["read"] }), async (c) =>
    c.json(await service.listAssignees(actorOf(c)), 200)
  )
  .get("/badge", can({ lead: ["read"] }), async (c) =>
    c.json(await service.leadBadge(actorOf(c)), 200)
  )
  .get("/:id", can({ lead: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getLead(actorOf(c), c.req.valid("param").id), 200)
  )
  .patch(
    "/:id",
    can({ lead: ["update"] }),
    zv("param", idParam),
    zv("json", updateLeadInput),
    async (c) =>
      c.json(
        await service.updateLead(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/events",
    can({ lead: ["update"] }),
    zv("param", idParam),
    zv("json", leadNoteInput),
    async (c) =>
      c.json(
        await service.addLeadNote(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        201
      )
  )
  .delete("/:id", can({ lead: ["delete"] }), zv("param", idParam), async (c) =>
    c.json(await service.deleteLead(actorOf(c), c.req.valid("param").id), 200)
  )
