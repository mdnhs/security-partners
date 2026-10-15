import "server-only"

import type { Context } from "hono"
import { createMiddleware } from "hono/factory"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import type { AppEnv } from "@/server/api/context"
import { sessionFromHeaders } from "@/server/auth/session"
import type { Actor } from "@/server/lib/actor"
import { AppError, forbidden } from "@/server/lib/errors"

const unauthenticated = () =>
  new AppError("UNAUTHENTICATED", "Sign in to continue")

/** Resolves the actor from the session cookie (fresh DB read) into c.var.actor. */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const context = await sessionFromHeaders(c.req.raw.headers)
  c.set("actor", context?.actor ?? null)
  await next()
})

/** 401 UNAUTHENTICATED unless a session resolved. */
export const requireSignedIn = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("actor")) throw unauthenticated()
  await next()
})

/** 401 without a session, 403 unless the actor's roles grant every action in `req`. */
export const can = (req: PermissionRequest) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const actor = c.get("actor")
    if (!actor) throw unauthenticated()
    if (!hasPermission(actor.roles, req)) throw forbidden()
    await next()
  })

/** The signed-in actor inside a handler behind requireSignedIn/can. */
export function actorOf(c: Context<AppEnv>): Actor {
  const actor = c.get("actor")
  if (!actor) throw unauthenticated()
  return actor
}
