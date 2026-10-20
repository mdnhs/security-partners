import "server-only"

import { cookies, draftMode, headers } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

import { hasPermission, type PermissionRequest } from "@/lib/auth/permissions"
import { REQUEST_PATH_HEADER } from "@/lib/request-path"
import { getSessionContext } from "@/server/auth/session"

import { canPreview } from "./service"
import { PREVIEW_COOKIE, verifyPreviewToken } from "./token"

/**
 * True only for a verified previewer: draft mode is on, the request carries
 * an unexpired preview cookie issued to the signed-in user, and that user
 * still has read permission on a previewable entity (demotion ends preview
 * on the next request). Deduped per request.
 */
export const isPreviewing: () => Promise<boolean> = cache(async () => {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return false
  const claim = verifyPreviewToken((await cookies()).get(PREVIEW_COOKIE)?.value)
  if (!claim) return false
  const session = await getSessionContext()
  return (
    !!session &&
    session.actor.userId === claim.userId &&
    canPreview(session.actor.roles)
  )
})

/**
 * A verified previewer (isPreviewing) who also holds `req`. Preview is
 * entered per entity (`/admin/preview` checks that entity's read), but the
 * draft cookie covers the whole site: a public route that shows drafts of
 * one kind asks for that kind's permission here (D5.3 review minor 1).
 */
export async function previewerCan(req: PermissionRequest): Promise<boolean> {
  if (!(await isPreviewing())) return false
  const session = await getSessionContext()
  return !!session && hasPermission(session.actor.roles, req)
}

/**
 * Public pages call this before reading data. Draft mode without a verified
 * previewer (isPreviewing) is switched off (exit route) before any draft
 * content renders. Outside draft mode it costs one cookie-free check.
 * The exit route returns to `?to` (the page, from proxy.ts): a document
 * request redirects over HTTP (blocking metadata), so no Referer names it.
 */
export async function assertPreviewAccess(): Promise<void> {
  const { isEnabled } = await draftMode()
  if (!isEnabled || (await isPreviewing())) return
  const to = (await headers()).get(REQUEST_PATH_HEADER)
  redirect(
    to
      ? `/api/v1/preview/exit?to=${encodeURIComponent(to)}`
      : "/api/v1/preview/exit"
  )
}
