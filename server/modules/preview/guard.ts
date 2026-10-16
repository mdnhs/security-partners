import "server-only"

import { cookies, draftMode } from "next/headers"
import { redirect } from "next/navigation"
import { cache } from "react"

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
 * Public pages call this before reading data. Draft mode without a verified
 * previewer (isPreviewing) is switched off (exit route) before any draft
 * content renders. Outside draft mode it costs one cookie-free check.
 */
export async function assertPreviewAccess(): Promise<void> {
  const { isEnabled } = await draftMode()
  if (isEnabled && !(await isPreviewing())) redirect("/api/v1/preview/exit")
}
