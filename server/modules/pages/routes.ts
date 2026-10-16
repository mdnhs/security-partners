import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  pageKeyParam,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

export const pagesRoutes = new Hono<AppEnv>()
  .get("/", can({ page: ["read"] }), async (c) =>
    c.json(await service.listPages(actorOf(c)), 200)
  )
  .get("/:key", can({ page: ["read"] }), zv("param", pageKeyParam), async (c) =>
    c.json(await service.getPage(actorOf(c), c.req.valid("param").key), 200)
  )
  .put(
    "/:key/draft",
    can({ page: ["update"] }),
    zv("param", pageKeyParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.savePageDraft(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/publish",
    can({ page: ["publish"] }),
    zv("param", pageKeyParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishPage(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/restore",
    can({ page: ["update"] }),
    zv("param", pageKeyParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restorePage(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
