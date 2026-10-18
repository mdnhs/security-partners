import "server-only"

import { Hono } from "hono"

import { leadSubmission } from "@/lib/schemas/api/leads"
import type { AppEnv } from "@/server/api/context"
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
