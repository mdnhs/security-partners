import "server-only"

import { Hono } from "hono"

import {
  builderDeleteQuery,
  builderDraftInput,
  builderMetaInput,
  createBuilderPageInput,
} from "@/lib/schemas/api/builder-pages"
import { restoreInput, versionInput } from "@/lib/schemas/api/content"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** /api/v1/admin/builder-pages — pages at /p/<slug> (spec §7.5). */
export const builderPagesRoutes = new Hono<AppEnv>()
  .get("/", can({ page: ["read"] }), async (c) =>
    c.json({ items: await service.listBuilderPages(actorOf(c)) }, 200)
  )
  .post(
    "/",
    can({ page: ["create"] }),
    zv("json", createBuilderPageInput),
    async (c) => {
      const { seed, ...input } = c.req.valid("json")
      return c.json(
        await service.createBuilderPage(actorOf(c), input, seed),
        201
      )
    }
  )
  .get("/:id", can({ page: ["read"] }), zv("param", idParam), async (c) =>
    c.json(
      await service.getBuilderPage(actorOf(c), c.req.valid("param").id),
      200
    )
  )
  .put(
    "/:id/draft",
    can({ page: ["update"] }),
    zv("param", idParam),
    zv("json", builderDraftInput),
    async (c) =>
      c.json(
        await service.saveBuilderDraft(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/publish",
    can({ page: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishBuilderPage(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/restore",
    can({ page: ["update"] }),
    zv("param", idParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreBuilderPage(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .patch(
    "/:id/meta",
    can({ page: ["update"] }),
    zv("param", idParam),
    zv("json", builderMetaInput),
    async (c) =>
      c.json(
        await service.changeBuilderMeta(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ page: ["delete"] }),
    zv("param", idParam),
    zv("query", builderDeleteQuery),
    async (c) => {
      await service.deleteBuilderPage(
        actorOf(c),
        c.req.valid("param").id,
        c.req.valid("query")
      )
      return c.json({ ok: true as const }, 200)
    }
  )
