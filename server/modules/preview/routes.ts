import "server-only"

import { Hono } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"
import { draftMode } from "next/headers"

import { previewQuery } from "@/lib/schemas/api/preview"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"
import { getEnv } from "@/server/env"

import { previewPath, safeReturnPath } from "./service"
import { PREVIEW_COOKIE, PREVIEW_TTL_SECONDS, signPreviewToken } from "./token"

const secure = () => getEnv().BETTER_AUTH_URL.startsWith("https:")

/**
 * GET /api/v1/admin/preview?entity&id — signed-in only (admin chain):
 * turns on Next draft mode, sets the signed preview cookie and redirects
 * to the public URL, which then renders drafts for this user only.
 */
export const adminPreviewRoutes = new Hono<AppEnv>().get(
  "/",
  zv("query", previewQuery),
  async (c) => {
    const actor = actorOf(c)
    const { entity, id } = c.req.valid("query")
    const path = await previewPath(actor, entity, id)
    ;(await draftMode()).enable()
    setCookie(c, PREVIEW_COOKIE, signPreviewToken(actor.userId), {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: secure(),
      maxAge: PREVIEW_TTL_SECONDS,
    })
    return c.redirect(path, 302)
  }
)

/**
 * GET /api/v1/preview/exit — leaves draft mode (no session needed) and
 * returns to the page the preview bar was on.
 */
export const previewExitRoutes = new Hono<AppEnv>().get("/exit", async (c) => {
  ;(await draftMode()).disable()
  // Next re-serializes Set-Cookie when it appends the draft-mode cookie and
  // drops `Max-Age=0`; an epoch `Expires` survives, so the cookie is cleared.
  deleteCookie(c, PREVIEW_COOKIE, {
    path: "/",
    secure: secure(),
    expires: new Date(0),
  })
  const origin = new URL(getEnv().BETTER_AUTH_URL).origin
  return c.redirect(safeReturnPath(c.req.header("referer"), origin), 302)
})
