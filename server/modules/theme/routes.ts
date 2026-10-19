import "server-only"

import { Hono } from "hono"

import {
  themeDraftInput,
  themeResetInput,
  themeRestoreInput,
  themeVersionInput,
} from "@/lib/schemas/api/theme"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

// can() → zv() → service; the service re-checks the permission.
// History: GET /api/v1/admin/revisions/settings/theme.
export const themeRoutes = new Hono<AppEnv>()
  .get("/", can({ appearance: ["read"] }), async (c) =>
    c.json(await service.getTheme(actorOf(c)), 200)
  )
  .put(
    "/draft",
    can({ appearance: ["update"] }),
    zv("json", themeDraftInput),
    async (c) =>
      c.json(await service.saveThemeDraft(actorOf(c), c.req.valid("json")), 200)
  )
  .post(
    "/publish",
    can({ appearance: ["publish"] }),
    zv("json", themeVersionInput),
    async (c) =>
      c.json(await service.publishTheme(actorOf(c), c.req.valid("json")), 200)
  )
  .post(
    "/discard",
    can({ appearance: ["update"] }),
    zv("json", themeVersionInput),
    async (c) =>
      c.json(
        await service.discardThemeDraft(actorOf(c), c.req.valid("json")),
        200
      )
  )
  .post(
    "/reset",
    can({ appearance: ["update"] }),
    zv("json", themeResetInput),
    async (c) =>
      c.json(
        await service.resetThemeDraft(actorOf(c), c.req.valid("json")),
        200
      )
  )
  .post(
    "/restore",
    can({ appearance: ["update"] }),
    zv("json", themeRestoreInput),
    async (c) =>
      c.json(await service.restoreTheme(actorOf(c), c.req.valid("json")), 200)
  )
