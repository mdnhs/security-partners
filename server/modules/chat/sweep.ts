import "server-only"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import type { ChatSettings } from "@/lib/schemas/settings/chat"
import { fillChatText } from "@/lib/chat/text"
import { getDb } from "@/server/db/client"
import { writeAudit } from "@/server/lib/audit"
import { retentionCutoff } from "@/server/modules/leads/service"

import * as repo from "./repo"
import { readChatSettings } from "./settings"

// Port of JW server/modules/chat/sweep.ts (JW §6.12): the minute tick of the
// live chat. Every comparison uses the DB clock, in the repo.

/**
 * One transaction: auto-closes chats idle for 24 h (with the "ended" notice),
 * stamps the 5 min no-reply alerts and lists bot-owned chats stalled for 90 s.
 * Emails (`alerted`) and bot runs (`resume`) are the caller's job, after the
 * commit. `settings` are the published chat settings the caller has read.
 * While the bot is off (`botActive: false`) no chat is bot-owned, so a chat
 * it left unanswered is alerted even with a lease still live.
 */
export async function sweepChats(opts: {
  settings: ChatSettings
  botActive: boolean
}): Promise<{ closed: number; alerted: string[]; resume: string[] }> {
  const s = opts.settings
  const ended = fillChatText(s.notices.ended, {
    team: s.teamName,
    botName: s.bot.name,
  })
  return getDb().transaction(async (tx) => {
    // Auto-close first, so a chat that just ended is never alerted or resumed.
    const closed = await repo.closeIdle(tx)
    for (const id of closed) {
      await repo.addMessage(
        {
          conversationId: id,
          sender: "system",
          senderName: null,
          body: ended,
          requireOpen: false,
        },
        tx
      )
    }
    const alerted = await repo.claimNoReplyAlerts(opts.botActive, tx)
    const resume = await repo.stalledBotChats(tx)
    return { closed: closed.length, alerted, resume }
  })
}

/**
 * Retention (C7): deletes chats whose last activity or close is older than
 * chat.retentionMonths. While the setting is unpublished the default applies,
 * since chats may remain from a period when the chat was on. Audits the count
 * only, and only when something was deleted.
 */
export async function purgeExpiredChats(now: Date): Promise<number> {
  const months = ((await readChatSettings()) ?? CHAT_SETTINGS_DEFAULT)
    .retentionMonths
  const cutoff = retentionCutoff(now, months)
  return getDb().transaction(async (tx) => {
    const count = await repo.purgeBefore(cutoff, tx)
    if (count > 0)
      await writeAudit(tx, null, {
        action: "chat.purged",
        entityType: "chat",
        diff: { count },
      })
    return count
  })
}
