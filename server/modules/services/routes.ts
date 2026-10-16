import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { idParam } from "@/lib/schemas/api/params"
import {
  createServiceInput,
  serviceListQuery,
  serviceSlugInput,
  serviceVersionQuery,
} from "@/lib/schemas/api/services"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

export const servicesRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ service: ["read"] }),
    zv("query", serviceListQuery),
    async (c) =>
      c.json(
        await service.listServicesAdmin(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .post(
    "/",
    can({ service: ["create"] }),
    zv("json", createServiceInput),
    async (c) =>
      c.json(await service.createService(actorOf(c), c.req.valid("json")), 201)
  )
  .get("/:id", can({ service: ["read"] }), zv("param", idParam), async (c) =>
    c.json(
      await service.getServiceAdmin(actorOf(c), c.req.valid("param").id),
      200
    )
  )
  .put(
    "/:id/draft",
    can({ service: ["update"] }),
    zv("param", idParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveServiceDraft(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/publish",
    can({ service: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishService(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/restore",
    can({ service: ["update"] }),
    zv("param", idParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreService(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .patch(
    "/:id/slug",
    can({ service: ["update"] }),
    zv("param", idParam),
    zv("json", serviceSlugInput),
    async (c) =>
      c.json(
        await service.changeServiceSlug(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ service: ["delete"] }),
    zv("param", idParam),
    zv("query", serviceVersionQuery),
    async (c) =>
      c.json(
        await service.deleteService(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("query")
        ),
        200
      )
  )
