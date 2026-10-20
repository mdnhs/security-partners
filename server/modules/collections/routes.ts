import "server-only"

import { Hono } from "hono"
import { z } from "zod"

import {
  type CollectionName,
  collectionListQuery,
} from "@/lib/schemas/api/collections"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** CRUD for one small collection (/team, /clients, /group-companies, /categories). */
export function collectionRoutes<C extends CollectionName>(name: C) {
  return new Hono<AppEnv>()
    .get(
      "/",
      can({ collection: ["read"] }),
      zv("query", collectionListQuery),
      async (c) =>
        c.json(
          await service.listCollection(actorOf(c), name, c.req.valid("query")),
          200
        )
    )
    .post(
      "/",
      can({ collection: ["create"] }),
      zv("json", z.unknown()),
      async (c) =>
        c.json(
          await service.createCollectionItem(
            actorOf(c),
            name,
            c.req.valid("json")
          ),
          201
        )
    )
    .get(
      "/:id",
      can({ collection: ["read"] }),
      zv("param", idParam),
      async (c) =>
        c.json(
          await service.getCollectionItem(
            actorOf(c),
            name,
            c.req.valid("param").id
          ),
          200
        )
    )
    .put(
      "/:id",
      can({ collection: ["update"] }),
      zv("param", idParam),
      zv("json", z.unknown()),
      async (c) =>
        c.json(
          await service.updateCollectionItem(
            actorOf(c),
            name,
            c.req.valid("param").id,
            c.req.valid("json")
          ),
          200
        )
    )
    .delete(
      "/:id",
      can({ collection: ["delete"] }),
      zv("param", idParam),
      async (c) =>
        c.json(
          await service.deleteCollectionItem(
            actorOf(c),
            name,
            c.req.valid("param").id
          ),
          200
        )
    )
}

export const teamRoutes = collectionRoutes("team")
export const clientsRoutes = collectionRoutes("clients")
export const groupCompaniesRoutes = collectionRoutes("group-companies")
export const categoriesRoutes = collectionRoutes("categories")
