import "server-only"

import { Hono } from "hono"

import { optionsParam, searchQuery } from "@/lib/schemas/api/search"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Any signed-in user may search; results are filtered by permission in the service. */
export const searchRoutes = new Hono<AppEnv>()
  .get("/", zv("query", searchQuery), async (c) =>
    c.json(await service.search(actorOf(c), c.req.valid("query").q), 200)
  )
  .get("/options/:collection", zv("param", optionsParam), async (c) =>
    c.json(
      await service.options(actorOf(c), c.req.valid("param").collection),
      200
    )
  )
