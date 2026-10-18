import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { growthKeyParam } from "@/lib/schemas/api/marketing"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// The permission depends on :key (custom code is owner-only), so the
// service authorises every call (lib/admin/growth-settings.ts).
export const marketingRoutes = new Hono<AppEnv>()
  .get("/:key", zv("param", growthKeyParam), async (c) =>
    c.json(
      await service.getGrowthSettings(actorOf(c), c.req.valid("param").key),
      200
    )
  )
  .put(
    "/:key/draft",
    zv("param", growthKeyParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveGrowthSettingsDraft(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/publish",
    zv("param", growthKeyParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishGrowthSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/restore",
    zv("param", growthKeyParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreGrowthSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
