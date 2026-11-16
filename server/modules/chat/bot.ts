import "server-only"

import { generateText } from "ai"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { CHAT_QUOTE_HREF, fillChatText } from "@/lib/chat/text"
import type { ChatSettings } from "@/lib/schemas/settings/chat"
import {
  CHAT_BOT_SITE_RATE_LIMIT,
  consumeRateLimit,
} from "@/server/lib/rate-limit"
import { createLanguageModel, logAiError } from "@/server/modules/ai/providers"
import { activeAiConfig } from "@/server/modules/ai/service"
import { readPublishedSettings } from "@/server/modules/settings/service"

import { buildKnowledge } from "./knowledge"
import { type ChatNoticeKind, notifyNeedsHuman } from "./notify"
import {
  buildSystemPrompt,
  MODEL_HISTORY,
  todayIn,
  toModelMessages,
} from "./prompt"
import * as repo from "./repo"
import { readChatSettings } from "./settings"

// The AI assistant of the live chat (port of JW bot.ts, JW §6.6, without the
// crisis step). One run at a time per chat, through the lease; each run
// answers up to MAX_ROUNDS visitor turns, so messages sent while the model
// was generating are answered in the same run instead of being dropped.

type BotOutcome = "replied" | "skipped" | "handoff" | "failed"
// The bot never hands a chat over on its own: it answers every message
// until staff take the chat over in the admin. Only the reply cap and the
// site-wide limit hand over; a failed answer tells the team but leaves the
// chat with the bot, so the next message is tried again.
type Result = { outcome: BotOutcome; handled: number }
type Row = repo.ChatMessageRow

const MAX_ROUNDS = 3
const MAX_ATTEMPTS = 3
/** One provider call (both steps), Global Constraints. */
const GENERATION_MS = 25_000
/** Three rounds of up to 25 s each, plus database and knowledge time: 90 s. */
const LEASE_MS = MAX_ROUNDS * GENERATION_MS + 15_000
const MAX_OUTPUT_TOKENS = 300

const SITE_KEY = "chat:bot:site"

/**
 * Whether the AI assistant answers chats right now: the chat and its bot are
 * on and the AI integration is on with a model and key. The AI's
 * allowedRoles are about staff and do not apply. Reads the chat settings
 * when none are passed; returns before the integration read when off.
 */
export async function isActive(
  settings?: ChatSettings | null
): Promise<boolean> {
  const chat = settings === undefined ? await readChatSettings() : settings
  if (!chat?.enabled || !chat.bot.enabled) return false
  return (await activeAiConfig()) !== null
}

const botOwns = (c: repo.ChatConversationRow) =>
  c.status === "open" && c.aiEnabled && !c.needsHuman && !c.assignedTo

/**
 * Tells the team: stores the reason's notice (once per chat) and alerts the
 * team (once per episode). Except for "failed", it also flags the chat for
 * a person, which stops the bot until staff hand it back.
 */
export async function handOff(id: string, reason: ChatNoticeKind) {
  const settings = (await readChatSettings()) ?? CHAT_SETTINGS_DEFAULT
  const stored = await repo.addMessage({
    conversationId: id,
    sender: "system",
    senderName: null,
    body: fillChatText(settings.notices[reason], { team: settings.teamName }),
    noticeKind: reason,
  })
  // A refused notice on a closed chat means: no flag, no alert.
  if (!stored && (await repo.findById(id))?.status !== "open") return
  if (reason !== "failed") await repo.flagNeedsHuman(id)
  await notifyNeedsHuman(id, reason)
}

/** Answers the chat's unanswered visitor messages when the bot owns it. */
export async function maybeReply(conversationId: string): Promise<void> {
  if (!(await isActive())) return
  let handled = 0
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const lease = await repo.claimLease(conversationId, LEASE_MS)
    if (!lease) return
    let r: Result
    try {
      r = await run(conversationId, handled)
    } finally {
      await repo.releaseLease(conversationId, lease)
    }
    if (r.outcome !== "replied") return
    handled = r.handled
    // A visitor message may have landed after the last read and before the
    // release: its own deferred run saw the lease held and skipped.
    const newest = (await repo.recentMessages(conversationId, MODEL_HISTORY))
      .filter((m) => m.sender === "visitor")
      .at(-1)
    if (!newest || newest.id <= handled) return
  }
}

/** One leased run: up to MAX_ROUNDS replies. The caller holds the lease. */
async function run(id: string, since: number): Promise<Result> {
  let handled = since
  let replied = false
  const done = (outcome: BotOutcome): Result => ({ outcome, handled })
  const stop = () => done(replied ? "replied" : "skipped")
  const handOffWith = async (reason: ChatNoticeKind) => {
    await handOff(id, reason)
    return done(reason === "failed" ? "failed" : "handoff")
  }

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const chat = await repo.findById(id)
    if (!chat || !botOwns(chat)) return stop()
    // Switched off since the run started: leave the chat to the team.
    const settings = await readChatSettings()
    if (!settings?.enabled || !settings.bot.enabled) return stop()
    const config = await activeAiConfig()
    if (!config) return stop()

    const handledBefore = handled
    const seen: Row[] = await repo.recentMessages(id, MODEL_HISTORY)
    const newest = seen.filter((m) => m.sender === "visitor").at(-1)
    if (!newest) return stop()
    // The first round answers only an unanswered visitor turn. Later rounds
    // answer visitor turns newer than the last one handled: our own reply
    // sits after any message that arrived while we generated.
    if (round === 0 && since === 0) {
      if (seen.at(-1)?.sender !== "visitor") return stop()
    } else if (newest.id <= handled) return stop()

    if (chat.aiReplyCount >= settings.bot.maxAiReplies) {
      handled = newest.id
      return handOffWith("limit")
    }
    const site = await consumeRateLimit(SITE_KEY, CHAT_BOT_SITE_RATE_LIMIT)
    if (!site.allowed) {
      handled = newest.id
      return handOffWith("limit")
    }
    handled = newest.id

    let text = ""
    try {
      const [siteSettings, knowledge] = await Promise.all([
        readPublishedSettings("site"),
        buildKnowledge(),
      ])
      const result = await generateText({
        model: createLanguageModel(config),
        system: buildSystemPrompt({
          botName: settings.bot.name,
          siteName: siteSettings?.name ?? "",
          team: settings.teamName,
          quoteHref: CHAT_QUOTE_HREF,
          extra: settings.bot.extraInstructions,
          today: todayIn(siteSettings?.timezone ?? ""),
          knowledge,
        }),
        messages: toModelMessages(
          seen,
          round === 0 && since === 0 ? 0 : handledBefore
        ),
        maxOutputTokens: Math.min(
          MAX_OUTPUT_TOKENS,
          config.maxOutputTokens ?? MAX_OUTPUT_TOKENS
        ),
        abortSignal: AbortSignal.timeout(GENERATION_MS),
      })
      text = result.text.trim()
    } catch (error) {
      logAiError(error)
      return handOffWith("failed")
    }

    if (!text) {
      console.error("[chat] bot failed: EmptyReply")
      return handOffWith("failed")
    }

    // Refused when staff took the chat over while the model generated.
    const stored = await repo.addMessage({
      conversationId: id,
      sender: "ai",
      senderName: settings.bot.name,
      body: text,
      requireBotOwns: true,
    })
    if (!stored) return stop()
    replied = true
  }
  return done("replied")
}
