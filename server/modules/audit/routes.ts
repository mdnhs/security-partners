import "server-only"

import { Hono } from "hono"

import { auditListQuery } from "@/lib/schemas/api/audit"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import { listAuditLog } from "./service"

export const auditRoutes = new Hono<AppEnv>().get(
  "/",
  can({ audit: ["read"] }),
  zv("query", auditListQuery),
  async (c) => c.json(await listAuditLog(actorOf(c), c.req.valid("query")), 200)
)
