import "server-only"

import { Hono } from "hono"

import { idParam } from "@/lib/schemas/api/params"
import {
  redirectInput,
  redirectListQuery,
  redirectPatch,
} from "@/lib/schemas/api/redirects"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

export const redirectsRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ redirect: ["read"] }),
    zv("query", redirectListQuery),
    async (c) =>
      c.json(
        await service.listRedirectsAdmin(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .post(
    "/",
    can({ redirect: ["create"] }),
    zv("json", redirectInput),
    async (c) =>
      c.json(await service.createRedirect(actorOf(c), c.req.valid("json")), 201)
  )
  .patch(
    "/:id",
    can({ redirect: ["update"] }),
    zv("param", idParam),
    zv("json", redirectPatch),
    async (c) =>
      c.json(
        await service.updateRedirect(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ redirect: ["delete"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.deleteRedirect(actorOf(c), c.req.valid("param").id),
        200
      )
  )
