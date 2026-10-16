import "server-only"

import { cookies, draftMode } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionContext } from "@/server/auth/session"

import { PREVIEW_COOKIE, verifyPreviewToken } from "./token"

/**
 * Public pages call this before reading data. In draft mode the request
 * must carry a valid preview cookie issued to the signed-in user;
 * otherwise draft mode is switched off (exit route) before any draft
 * content renders. Outside draft mode it costs one cookie-free check.
 */
export async function assertPreviewAccess(): Promise<void> {
  const { isEnabled } = await draftMode()
  if (!isEnabled) return
  const claim = verifyPreviewToken((await cookies()).get(PREVIEW_COOKIE)?.value)
  const session = claim ? await getSessionContext() : null
  if (!claim || !session || session.actor.userId !== claim.userId)
    redirect("/api/v1/preview/exit")
}
