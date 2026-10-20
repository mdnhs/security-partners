import "server-only"

import { Hono } from "hono"

import {
  articleListQuery,
  articleMetaInput,
  articleVersionQuery,
  createArticleInput,
  scheduleInput,
} from "@/lib/schemas/api/articles"
import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// Ownership (authors: own, unpublished) is checked by the service; `can`
// only needs the role grant. "/options" is registered before "/:id".
export const articlesRoutes = new Hono<AppEnv>()
  .get(
    "/",
    can({ article: ["read"] }),
    zv("query", articleListQuery),
    async (c) =>
      c.json(
        await service.listArticlesAdmin(actorOf(c), c.req.valid("query")),
        200
      )
  )
  .get("/options", can({ article: ["read"] }), async (c) =>
    c.json(await service.getArticleOptions(actorOf(c)), 200)
  )
  .post(
    "/",
    can({ article: ["create"] }),
    zv("json", createArticleInput),
    async (c) =>
      c.json(await service.createArticle(actorOf(c), c.req.valid("json")), 201)
  )
  .get("/:id", can({ article: ["read"] }), zv("param", idParam), async (c) =>
    c.json(
      await service.getArticleAdmin(actorOf(c), c.req.valid("param").id),
      200
    )
  )
  .put(
    "/:id/draft",
    can({ article: ["update"] }),
    zv("param", idParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveArticleDraft(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/restore",
    can({ article: ["update"] }),
    zv("param", idParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .patch(
    "/:id/meta",
    can({ article: ["update"] }),
    zv("param", idParam),
    zv("json", articleMetaInput),
    async (c) =>
      c.json(
        await service.changeArticleMeta(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/submit",
    can({ article: ["submit"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.submitArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/publish",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/schedule",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", scheduleInput),
    async (c) =>
      c.json(
        await service.scheduleArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/unschedule",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.unscheduleArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/unpublish",
    can({ article: ["publish"] }),
    zv("param", idParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.unpublishArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:id",
    can({ article: ["delete"] }),
    zv("param", idParam),
    zv("query", articleVersionQuery),
    async (c) =>
      c.json(
        await service.deleteArticle(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("query")
        ),
        200
      )
  )
