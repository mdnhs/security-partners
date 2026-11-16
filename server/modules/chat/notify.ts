import "server-only"

import { createElement } from "react"

import { ChatAlert } from "@/emails/chat-alert"
import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { getEnv } from "@/server/env"
import { mailer } from "@/server/lib/mailer"
import { readPublishedSettings } from "@/server/modules/settings/service"

import * as repo from "./repo"
import { readChatSettings } from "./settings"

/** The bot's system notices; each is stored at most once per chat. */
export type ChatNoticeKind = "handoff" | "limit" | "failed"

const WHY: Record<ChatNoticeKind, string> = {
  handoff: "The assistant asked for a person to take over.",
  limit: "The assistant reached its reply limit for this chat.",
  failed: "The assistant was unavailable for this chat.",
}

/** The quoted visitor message is cut to this many characters. */
const QUOTE_MAX = 500

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error

// Never throws: an alert is best effort and its caller has already stored
// the chat's state. Logs name the error only, never addresses or text.
async function send(id: string, subject: string, reason: string) {
  try {
    const [chat, chatSettings, leads] = await Promise.all([
      repo.findById(id),
      readChatSettings(),
      readPublishedSettings("leads"),
    ])
    if (!chat) return
    const to = leads?.recipients ?? []
    if (to.length === 0) {
      console.info("[chat] alert not sent: no recipients in Settings ▸ Leads")
      return
    }
    const { includeMessage } = (chatSettings ?? CHAT_SETTINGS_DEFAULT).alerts
    let message: string | null = null
    if (includeMessage) {
      const last = (await repo.recentMessages(id))
        .filter((m) => m.sender === "visitor")
        .at(-1)
      if (last) message = last.body.slice(0, QUOTE_MAX)
    }
    await mailer.send({
      to,
      subject,
      template: "chat-alert",
      react: createElement(ChatAlert, {
        reason,
        message,
        href: new URL(
          `/admin/chat?c=${id}`,
          getEnv().BETTER_AUTH_URL
        ).toString(),
      }),
    })
  } catch (error) {
    console.error(`[chat] alert email failed (${errorName(error)})`)
  }
}

/**
 * Once per episode: the conditional UPDATE decides who sends. The alert is
 * stamped before sending, so a transient SMTP failure loses it; the no-reply
 * sweep is the backstop. A real handback clears the stamp.
 */
export async function notifyNeedsHuman(id: string, reason: ChatNoticeKind) {
  try {
    if (!(await repo.claimNeedsHumanAlert(id))) return
  } catch (error) {
    console.error(`[chat] alert guard failed (${errorName(error)})`)
    return
  }
  await send(id, "A visitor on the chat needs a person", WHY[reason])
}

/** The no-reply sweep owns its own once-only guard. */
export async function notifyNoReply(id: string) {
  await send(
    id,
    "A chat visitor is waiting for a reply",
    "A visitor has been waiting for a reply."
  )
}
