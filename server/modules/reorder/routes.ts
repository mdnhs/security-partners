import "server-only"

import { Hono } from "hono"

import { reorderInput, reorderParam } from "@/lib/schemas/api/collections"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import { reorder } from "./service"

// Permission depends on :collection (service:update or collection:update): checked in the service.
export const reorderRoutes = new Hono<AppEnv>().put(
  "/:collection",
  zv("param", reorderParam),
  zv("json", reorderInput),
  async (c) =>
    c.json(
      await reorder(
        actorOf(c),
        c.req.valid("param").collection,
        c.req.valid("json").ids
      ),
      200
    )
)
