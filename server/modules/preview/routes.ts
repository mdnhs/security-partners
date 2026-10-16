import "server-only"

import { Hono } from "hono"
import { deleteCookie, setCookie } from "hono/cookie"
import { draftMode } from "next/headers"

import { previewQuery } from "@/lib/schemas/api/preview"
import type { AppEnv } from "@/server/api/context"
import { actorOf } from "@/server/api/middleware/auth"
import { zv } from "@/server/api/validate"
import { getEnv } from "@/server/env"
import { forbidden } from "@/server/lib/errors"

import { previewPath, safeReturnPath } from "./service"
import {
  PREVIEW_COOKIE,
  PREVIEW_TTL_SECONDS,
  previewCookieOptions,
  signPreviewToken,
} from "./token"

/**
 * The preview link is opened from the admin (same-origin) or typed/pasted
 * (none). A cross-site navigation must not switch on draft mode.
 */
const OPENED_BY = new Set(["same-origin", "none"])

/**
 * GET /api/v1/admin/preview?entity&id — signed-in only (admin chain):
 * turns on Next draft mode, sets the signed preview cookie and redirects
 * to the public URL, which then renders drafts for this user only.
 */
export const adminPreviewRoutes = new Hono<AppEnv>().get(
  "/",
  zv("query", previewQuery),
  async (c) => {
    if (!OPENED_BY.has(c.req.header("sec-fetch-site") ?? "")) throw forbidden()
    const actor = actorOf(c)
    const { entity, id } = c.req.valid("query")
    const path = await previewPath(actor, entity, id)
    ;(await draftMode()).enable()
    setCookie(c, PREVIEW_COOKIE, signPreviewToken(actor.userId), {
      ...previewCookieOptions(),
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
    ...previewCookieOptions(),
    expires: new Date(0),
  })
  const origin = new URL(getEnv().BETTER_AUTH_URL).origin
  return c.redirect(safeReturnPath(c.req.header("referer"), origin), 302)
})
