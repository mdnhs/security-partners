import "server-only"

import { Hono } from "hono"

import { mediaListQuery } from "@/lib/schemas/api/media"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Read-only in Phase 4 (picker). Phase 6 adds upload, update, delete, usages. */
export const mediaRoutes = new Hono<AppEnv>()
  .get("/", can({ media: ["read"] }), zv("query", mediaListQuery), async (c) =>
    c.json(await service.listMedia(actorOf(c), c.req.valid("query")), 200)
  )
  .get("/:id", can({ media: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getMediaItem(actorOf(c), c.req.valid("param").id), 200)
  )
