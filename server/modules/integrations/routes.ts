import "server-only"

import { Hono } from "hono"

import {
  integrationKeyParam,
  integrationVersionQuery,
  saveIntegrationInput,
} from "@/lib/schemas/api/integrations"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Settings ▸ Integrations (spec §5.4, §7). Owner/admin through integration:*. */
export const integrationsRoutes = new Hono<AppEnv>()
  .get("/", can({ integration: ["read"] }), async (c) =>
    c.json(await service.listIntegrations(actorOf(c)), 200)
  )
  .get(
    "/:key",
    can({ integration: ["read"] }),
    zv("param", integrationKeyParam),
    async (c) =>
      c.json(
        await service.getIntegration(actorOf(c), c.req.valid("param").key),
        200
      )
  )
  .put(
    "/:key",
    can({ integration: ["update"] }),
    zv("param", integrationKeyParam),
    zv("json", saveIntegrationInput),
    async (c) =>
      c.json(
        await service.saveIntegration(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete(
    "/:key",
    can({ integration: ["update"] }),
    zv("param", integrationKeyParam),
    zv("query", integrationVersionQuery),
    async (c) =>
      c.json(
        await service.deleteIntegration(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("query").version
        ),
        200
      )
  )
  .post(
    "/:key/test",
    can({ integration: ["test"] }),
    zv("param", integrationKeyParam),
    async (c) =>
      c.json(
        await service.testIntegration(actorOf(c), c.req.valid("param").key),
        200
      )
  )
