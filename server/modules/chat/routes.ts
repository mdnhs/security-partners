import "server-only"

import { Hono } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"

import { hasPermission } from "@/lib/auth/permissions"
import { EmailInput, SendInput } from "@/lib/schemas/api/chat"
import { idParam } from "@/lib/schemas/api/params"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { notViewingAs } from "@/server/api/middleware/view-as"
import { zv } from "@/server/api/validate"

import * as staff from "./staff"

// /api/v1/admin/chat — the live chat inbox (port of JW routes.ts, live chat
// plan Task 6).

const listQuery = z.object({
  status: z.enum(["open", "closed"]).default("open"),
  cursor: z.string().max(100).optional(),
})
const detailQuery = z.object({
  after: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
})
const assignInput = z.object({ userId: z.uuid().nullable() })
const readInput = z.object({
  upTo: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
})

// Staff who can reply count as online while they use the inbox. The unread
// count is polled by the admin shell from background tabs, so it does not
// count, and neither does anyone viewing the admin as someone else.
const presence = createMiddleware<AppEnv>(async (c, next) => {
  const actor = c.get("actor")
  const background = c.req.method === "GET" && c.req.path.endsWith("/unread")
  if (
    actor &&
    !background &&
    !actor.impersonatorId &&
    hasPermission(actor.roles, { chat: ["reply"] })
  ) {
    await staff.markPresent(actor.userId)
  }
  await next()
})

const readOnly = (what: string) =>
  notViewingAs(`You can't ${what} while viewing as someone`)

// Static paths before /:id.
export const chatRoutes = new Hono<AppEnv>()
  .use(presence)
  .get("/", can({ chat: ["read"] }), zv("query", listQuery), async (c) =>
    c.json(await staff.list(c.req.valid("query")), 200)
  )
  .get("/unread", can({ chat: ["read"] }), async (c) =>
    c.json(await staff.unread(), 200)
  )
  .get(
    "/export",
    can({ chat: ["manage"] }),
    zv("query", EmailInput),
    async (c) => {
      const { filename, data } = await staff.exportForEmail(
        actorOf(c),
        c.req.valid("query").email
      )
      return c.json(data, 200, {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      })
    }
  )
  .post(
    "/erase",
    can({ chat: ["manage"] }),
    readOnly("erase chats"),
    zv("json", EmailInput),
    async (c) =>
      c.json(
        await staff.eraseForEmail(actorOf(c), c.req.valid("json").email),
        200
      )
  )
  .get(
    "/:id",
    can({ chat: ["read"] }),
    zv("param", idParam),
    zv("query", detailQuery),
    async (c) =>
      c.json(
        await staff.detail(c.req.valid("param").id, c.req.valid("query").after),
        200
      )
  )
  .post(
    "/:id/messages",
    can({ chat: ["reply"] }),
    readOnly("reply to chats"),
    zv("param", idParam),
    zv("json", SendInput),
    async (c) =>
      c.json(
        await staff.reply(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json").body
        ),
        201
      )
  )
  .post(
    "/:id/takeover",
    can({ chat: ["reply"] }),
    readOnly("take over chats"),
    zv("param", idParam),
    async (c) =>
      c.json(await staff.takeover(actorOf(c), c.req.valid("param").id), 200)
  )
  .post(
    "/:id/handback",
    can({ chat: ["reply"] }),
    readOnly("hand chats back"),
    zv("param", idParam),
    async (c) =>
      c.json(await staff.handback(actorOf(c), c.req.valid("param").id), 200)
  )
  .post(
    "/:id/assign",
    can({ chat: ["manage"] }),
    readOnly("assign chats"),
    zv("param", idParam),
    zv("json", assignInput),
    async (c) =>
      c.json(
        await staff.assign(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json").userId
        ),
        200
      )
  )
  .post(
    "/:id/read",
    can({ chat: ["read"] }),
    readOnly("mark chats as read"),
    zv("param", idParam),
    zv("json", readInput),
    async (c) =>
      c.json(
        await staff.read(c.req.valid("param").id, c.req.valid("json").upTo),
        200
      )
  )
  .post(
    "/:id/close",
    can({ chat: ["reply"] }),
    readOnly("close chats"),
    zv("param", idParam),
    async (c) =>
      c.json(await staff.close(actorOf(c), c.req.valid("param").id), 200)
  )
  .delete(
    "/:id",
    can({ chat: ["manage"] }),
    readOnly("delete chats"),
    zv("param", idParam),
    async (c) =>
      c.json(await staff.remove(actorOf(c), c.req.valid("param").id), 200)
  )
