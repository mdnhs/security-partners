import "server-only"

import { Hono } from "hono"

import {
  preferredAddressInput,
  seoEntryParam,
  seoUpdateInput,
} from "@/lib/schemas/api/seo"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import { getPreferredAddress, savePreferredAddress } from "./preferred-address"
import * as service from "./service"

export const seoRoutes = new Hono<AppEnv>()
  .get("/health", can({ seo: ["read"] }), async (c) =>
    c.json(await service.getSeoHealth(actorOf(c)), 200)
  )
  .get("/overview", can({ seo: ["read"] }), async (c) =>
    c.json(await service.getSeoOverview(actorOf(c)), 200)
  )
  .get("/preferred-address", can({ seo: ["read"] }), async (c) =>
    c.json(await getPreferredAddress(actorOf(c)), 200)
  )
  .put(
    "/preferred-address",
    can({ seo: ["update"] }),
    zv("json", preferredAddressInput),
    async (c) =>
      c.json(
        await savePreferredAddress(
          actorOf(c),
          c.req.valid("json").preferredHost
        ),
        200
      )
  )
  .put(
    "/entries/:kind/:id",
    can({ seo: ["update"] }),
    zv("param", seoEntryParam),
    zv("json", seoUpdateInput),
    async (c) => {
      const { kind, id } = c.req.valid("param")
      return c.json(
        await service.updateSeo(actorOf(c), kind, id, c.req.valid("json")),
        200
      )
    }
  )
