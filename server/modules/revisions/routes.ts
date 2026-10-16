import "server-only"

import { Hono } from "hono"

import { revisionListParam, revisionParam } from "@/lib/schemas/api/content"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// Read permission depends on :entity, so the service authorises.
// Restoring is done by the owning module (POST /pages/:key/restore, …).
export const revisionsRoutes = new Hono<AppEnv>()
  .get("/:entity/:id", zv("param", revisionListParam), async (c) => {
    const { entity, id } = c.req.valid("param")
    return c.json(await service.listRevisions(actorOf(c), entity, id), 200)
  })
  .get("/:entity/:id/:revisionId", zv("param", revisionParam), async (c) => {
    const { entity, id, revisionId } = c.req.valid("param")
    return c.json(
      await service.getRevision(actorOf(c), entity, id, revisionId),
      200
    )
  })
