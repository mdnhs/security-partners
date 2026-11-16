import "server-only"

import * as bot from "@/server/modules/chat/bot"
import { notifyNoReply } from "@/server/modules/chat/notify"
import { readChatSettings } from "@/server/modules/chat/settings"
import { sweepChats } from "@/server/modules/chat/sweep"

import type { JobDefinition } from "./index"

/** Stalled bot chats answered per run; the rest wait for the next minute. */
const MAX_RESUMES = 5

const errorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error

/**
 * Live chat tick (C6): 24 h auto-close, 5 min no-reply alert, 90 s bot resume.
 * Outside a request there is no after(), so the bot runs are awaited here.
 * A failed resume is logged (error name only) and reported as the run's
 * warning, so a chat that fails every minute shows in jobs.last_error.
 */
export const chatSweepJob: JobDefinition = {
  name: "chat-sweep",
  key: "chat-sweep",
  everyMs: 60_000,
  async run() {
    const settings = await readChatSettings()
    if (!settings?.enabled) return {}
    const botActive = await bot.isActive(settings)
    const { alerted, resume } = await sweepChats({ settings, botActive })
    for (const id of alerted) await notifyNoReply(id)
    if (!botActive) return {}
    const results = await Promise.allSettled(
      resume.slice(0, MAX_RESUMES).map((id) => bot.maybeReply(id))
    )
    let failed = 0
    for (const r of results) {
      if (r.status !== "rejected") continue
      failed += 1
      console.error(`[chat] resume failed (${errorName(r.reason)})`)
    }
    return failed > 0 ? { warning: `${failed} chat resume(s) failed` } : {}
  },
}
