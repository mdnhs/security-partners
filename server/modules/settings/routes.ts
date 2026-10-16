import "server-only"

import { Hono } from "hono"

import {
  draftInput,
  restoreInput,
  versionInput,
} from "@/lib/schemas/api/content"
import { settingsKeyParam } from "@/lib/schemas/api/settings"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// can() checks the settings resource; the service adds the per-key group
// permission (e.g. leads needs lead:update) and rejects keys edited elsewhere.
export const settingsRoutes = new Hono<AppEnv>()
  .get("/", can({ settings: ["read"] }), async (c) =>
    c.json(await service.listSettings(actorOf(c)), 200)
  )
  .get(
    "/:key",
    can({ settings: ["read"] }),
    zv("param", settingsKeyParam),
    async (c) =>
      c.json(
        await service.getSettingsEntry(actorOf(c), c.req.valid("param").key),
        200
      )
  )
  .put(
    "/:key/draft",
    can({ settings: ["update"] }),
    zv("param", settingsKeyParam),
    zv("json", draftInput),
    async (c) =>
      c.json(
        await service.saveSettingsDraft(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/publish",
    can({ settings: ["update"] }),
    zv("param", settingsKeyParam),
    zv("json", versionInput),
    async (c) =>
      c.json(
        await service.publishSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:key/restore",
    can({ settings: ["update"] }),
    zv("param", settingsKeyParam),
    zv("json", restoreInput),
    async (c) =>
      c.json(
        await service.restoreSettings(
          actorOf(c),
          c.req.valid("param").key,
          c.req.valid("json")
        ),
        200
      )
  )
