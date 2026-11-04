import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import {
  legalMetaInput,
  legalOrderInput,
  newLegalPageInput,
} from "@/lib/schemas/api/legal-pages"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** /api/v1/admin/legal-pages — legal pages served at /<slug>. */
export const legalPagesRoutes = new Hono<AppEnv>()
  .get("/", can({ page: ["read"] }), async (c) =>
    c.json({ items: await service.listLegalPages(actorOf(c)) }, 200)
  )
  .post(
    "/",
    can({ page: ["create"] }),
    zv("json", newLegalPageInput),
    async (c) =>
      c.json(
        await service.createLegalPage(actorOf(c), c.req.valid("json")),
        201
      )
  )
  // Before "/:id": "order" is not an id.
  .put(
    "/order",
    can({ page: ["update"] }),
    zv("json", legalOrderInput),
    async (c) =>
      c.json(
        {
          items: await service.reorderLegalPages(
            actorOf(c),
            c.req.valid("json")
          ),
        },
        200
      )
  )
  .get("/:id", can({ page: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getLegalPage(actorOf(c), c.req.valid("param").id), 200)
  )
  .put(
    "/:id/draft",
    can({ page: ["update"] }),
    zv("param", idParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveLegalDraft(
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
        await service.publishLegalPage(
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
        await service.restoreLegalPage(
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
    zv("json", legalMetaInput),
    async (c) =>
      c.json(
        await service.changeLegalMeta(
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
    async (c) => {
      await service.deleteLegalPage(actorOf(c), c.req.valid("param").id)
      return c.json({ ok: true as const }, 200)
    }
  )
