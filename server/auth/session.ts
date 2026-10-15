import "server-only"

import { getSessionCookie } from "better-auth/cookies"
import { headers } from "next/headers"
import { forbidden, redirect } from "next/navigation"

import {
  hasPermission,
  parseRoles,
  type PermissionRequest,
} from "@/lib/auth/permissions"
import type { Actor } from "@/server/lib/actor"
import { clientIp } from "@/server/lib/ip"

import { getAuth } from "./auth"

export type SessionUser = {
  id: string
  name: string
  email: string
  title: string | null
  twoFactorEnabled: boolean
}

export type SessionContext = {
  actor: Actor
  user: SessionUser
  session: { id: string; expiresAt: Date; impersonatedBy: string | null }
}

const isBanned = (user: {
  banned?: boolean | null
  banExpires?: Date | null
}) =>
  !!user.banned && !(user.banExpires && user.banExpires.getTime() < Date.now())

/**
 * Resolves the signed-in user from request headers with a fresh database read
 * (cookie cache bypassed), so bans, role changes and revoked sessions apply on
 * the next request. No session cookie → null without touching the database.
 */
export async function sessionFromHeaders(
  requestHeaders: Headers
): Promise<SessionContext | null> {
  if (!getSessionCookie(requestHeaders, { cookiePrefix: "sp" })) return null
  const result = await getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true },
  })
  if (!result || isBanned(result.user)) return null
  const { user, session } = result
  return {
    actor: {
      userId: user.id,
      roles: parseRoles(user.role),
      ip: clientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
      impersonatorId: session.impersonatedBy ?? null,
    },
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      title: user.title ?? null,
      twoFactorEnabled: !!user.twoFactorEnabled,
    },
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
      impersonatedBy: session.impersonatedBy ?? null,
    },
  }
}

/** Server Components / Server Functions: the current session, read fresh. */
export async function getSessionContext(): Promise<SessionContext | null> {
  return sessionFromHeaders(await headers())
}

/** Fresh session, bypasses the cookie cache. */
export async function getActor(): Promise<Actor | null> {
  return (await getSessionContext())?.actor ?? null
}

/** Redirects to /admin/sign-in when nobody is signed in. */
export async function requireSession(): Promise<SessionContext> {
  const context = await getSessionContext()
  if (!context) redirect("/admin/sign-in")
  return context
}

/** Redirects to /admin/sign-in when nobody is signed in. */
export async function requireActor(): Promise<Actor> {
  return (await requireSession()).actor
}

/** Renders the 403 page (app/(admin)/admin/forbidden.tsx) unless the actor holds `req`. */
export async function requirePermission(
  req: PermissionRequest
): Promise<Actor> {
  const actor = await requireActor()
  if (!hasPermission(actor.roles, req)) forbidden()
  return actor
}
