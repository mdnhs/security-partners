import { draftMode } from "next/headers"
import { unstable_rethrow } from "next/navigation"
import { connection } from "next/server"

import { chatLauncherProps } from "@/lib/chat/text"
import { getPublishedSettings } from "@/server/modules/settings/queries"

import { ChatLauncherLazy } from "./chat-launcher-lazy"

/**
 * The live chat launcher, site-wide. Renders inside the root layout's
 * <Suspense> beside SiteExtras, so it shares the brand overrides. Off unless
 * the published chat settings say so: an unpublished, invalid or unreadable
 * value, and draft mode (admin previews), all render nothing, so no widget
 * markup or JavaScript reaches the page (the launcher is a lazy chunk).
 */
export async function ChatSlot() {
  await connection()
  if ((await draftMode()).isEnabled) return null
  const chat = await getPublishedSettings("chat").catch((error: unknown) => {
    unstable_rethrow(error)
    return null
  })
  if (!chat?.enabled) return null
  return <ChatLauncherLazy {...chatLauncherProps(chat)} />
}
