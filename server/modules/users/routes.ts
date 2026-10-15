import "server-only"

import { type Context, Hono } from "hono"

import { idParam } from "@/lib/schemas/api/params"
import {
  banUserInput,
  inviteUserInput,
  setRolesInput,
  updateUserInput,
  userListQuery,
} from "@/lib/schemas/api/users"
import type { AppEnv } from "@/server/api/context"
import { actorOf, can } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"

import * as service from "./service"

/** Copies Better Auth's Set-Cookie headers (impersonation) onto the response. */
function forwardCookies(c: Context<AppEnv>, headers: Headers) {
  for (const cookie of headers.getSetCookie())
    c.header("Set-Cookie", cookie, { append: true })
}

export const usersRoutes = new Hono<AppEnv>()
  .get("/", can({ user: ["read"] }), zv("query", userListQuery), async (c) =>
    c.json(await service.listUsers(actorOf(c), c.req.valid("query")), 200)
  )
  .post(
    "/invite",
    can({ user: ["invite"] }),
    zv("json", inviteUserInput),
    async (c) =>
      c.json(await service.inviteUser(actorOf(c), c.req.valid("json")), 201)
  )
  // Any signed-in session that is an impersonation may end it.
  .post("/stop-impersonating", async (c) => {
    const { headers } = await service.stopImpersonation(
      actorOf(c),
      c.req.raw.headers
    )
    forwardCookies(c, headers)
    return c.json({ ok: true as const }, 200)
  })
  .get("/:id", can({ user: ["read"] }), zv("param", idParam), async (c) =>
    c.json(await service.getUser(actorOf(c), c.req.valid("param").id), 200)
  )
  .patch(
    "/:id",
    can({ user: ["update"] }),
    zv("param", idParam),
    zv("json", updateUserInput),
    async (c) =>
      c.json(
        await service.updateUser(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .put(
    "/:id/roles",
    can({ user: ["update"] }),
    zv("param", idParam),
    zv("json", setRolesInput),
    async (c) =>
      c.json(
        await service.setRoles(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .post(
    "/:id/ban",
    can({ user: ["ban"] }),
    zv("param", idParam),
    zv("json", banUserInput),
    async (c) =>
      c.json(
        await service.banUser(
          actorOf(c),
          c.req.valid("param").id,
          c.req.valid("json")
        ),
        200
      )
  )
  .delete("/:id/ban", can({ user: ["ban"] }), zv("param", idParam), async (c) =>
    c.json(await service.unbanUser(actorOf(c), c.req.valid("param").id), 200)
  )
  .get(
    "/:id/sessions",
    can({ user: ["read"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        {
          items: await service.listSessions(
            actorOf(c),
            c.req.valid("param").id
          ),
        },
        200
      )
  )
  .delete(
    "/:id/sessions",
    can({ user: ["revokeSessions"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.revokeSessions(actorOf(c), c.req.valid("param").id),
        200
      )
  )
  .post(
    "/:id/password-link",
    can({ user: ["update"] }),
    zv("param", idParam),
    async (c) =>
      c.json(
        await service.createPasswordLink(actorOf(c), c.req.valid("param").id),
        200
      )
  )
  .post(
    "/:id/impersonate",
    can({ user: ["impersonate"] }),
    zv("param", idParam),
    async (c) => {
      const { headers, ...result } = await service.startImpersonation(
        actorOf(c),
        c.req.valid("param").id,
        c.req.raw.headers
      )
      forwardCookies(c, headers)
      return c.json(result, 200)
    }
  )
