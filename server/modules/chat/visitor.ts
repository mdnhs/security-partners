import "server-only"

import { createHash, randomBytes } from "node:crypto"

import { HTTPException } from "hono/http-exception"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { fillChatText } from "@/lib/chat/text"
import {
  type ChatSender,
  type ChatStatus,
  type StartChatInput,
  VISITOR_NAME,
  type VisitorView,
} from "@/lib/schemas/api/chat"
import type { TurnstileConfig } from "@/lib/schemas/integrations"
import { defer } from "@/server/lib/defer"
import { AppError } from "@/server/lib/errors"
import {
  CHAT_POLL_RATE_LIMIT,
  CHAT_SEND_CHAT_RATE_LIMIT,
  CHAT_SEND_RATE_LIMIT,
  CHAT_START_SITE_RATE_LIMIT,
  consumeRateLimit,
  type RateLimitResult,
  rateLimitKey,
} from "@/server/lib/rate-limit"
import { verifyTurnstileToken } from "@/server/lib/turnstile"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import * as bot from "./bot"
import * as repo from "./repo"
import { readChatSettings } from "./settings"

// Port of JW server/modules/chat/visitor.ts (live chat plan, Task 3), minus
// the crisis check and visitor names.

type Chat = repo.ChatConversationRow

const ended = () => new AppError("CONFLICT", "This chat has ended")

/** 429 with Retry-After (the error handler keeps the thrower's headers). */
const rateLimited = (message: string, ...results: RateLimitResult[]) =>
  new HTTPException(429, {
    message,
    res: new Response(null, {
      headers: {
        "Retry-After": String(
          Math.max(...results.map((r) => r.retryAfterSeconds))
        ),
      },
    }),
  })

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")
const newToken = () => randomBytes(32).toString("base64url")

const errorName = (err: unknown) =>
  err instanceof Error ? err.name : "unknown error"

// Mirrors server/modules/leads/service.ts: unreadable settings skip the check
// (logged), so real visitors are never locked out by a broken integration.
async function readTurnstile(): Promise<TurnstileConfig | null | "unreadable"> {
  try {
    return await readIntegrationConfig("integrations.turnstile")
  } catch (err) {
    console.error(
      `[chat] Turnstile settings could not be read (${errorName(err)})`
    )
    return "unreadable"
  }
}

async function turnstileSiteKey(): Promise<string | null> {
  const config = await readTurnstile()
  if (config === "unreadable" || !config?.enabled || !config.siteKey)
    return null
  return config.siteKey
}

/** Throws 422 when Turnstile is on and the token fails. */
async function assertHuman(token: string | undefined, ip: string | null) {
  const config = await readTurnstile()
  if (config === "unreadable" || !config?.enabled) return
  if (await verifyTurnstileToken({ secret: config.secretKey, token, ip }))
    return
  throw new AppError("VALIDATION_FAILED", "Spam check failed", {
    fieldErrors: {
      turnstileToken: ["Spam check failed. Reload the page and try again."],
    },
  })
}

export async function status(): Promise<ChatStatus> {
  const settings = await readChatSettings()
  const [online, botActive, siteKey] = await Promise.all([
    repo.staffOnline(),
    bot.isActive(settings),
    turnstileSiteKey(),
  ])
  return { online, botActive, turnstileSiteKey: siteKey }
}

export async function findByToken(
  token: string | undefined
): Promise<Chat | null> {
  if (!token) return null
  return repo.findByTokenHash(hashToken(token))
}

export async function requireChat(token: string | undefined): Promise<Chat> {
  const chat = await findByToken(token)
  if (!chat) throw new AppError("NOT_FOUND", "Chat not found")
  return chat
}

async function botOwns(chat: Chat): Promise<boolean> {
  return (
    chat.status === "open" &&
    chat.aiEnabled &&
    !chat.needsHuman &&
    !chat.assignedTo &&
    (await bot.isActive())
  )
}

export async function view(chat: Chat, afterId = 0): Promise<VisitorView> {
  const [rows, botActive, agentName] = await Promise.all([
    repo.messagesAfter(chat.id, afterId),
    botOwns(chat),
    chat.assignedTo ? repo.assigneeName(chat.assignedTo) : null,
  ])
  return {
    id: chat.id,
    status: chat.status as VisitorView["status"],
    botActive,
    needsHuman: chat.needsHuman,
    hasEmail: Boolean(chat.visitorEmail),
    agentName,
    messages: rows.map((m) => ({
      id: m.id,
      sender: m.sender as ChatSender,
      senderName: m.senderName,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
    lastId: rows.at(-1)?.id ?? afterId,
  }
}

export async function pollLimit(ip: string | null) {
  const r = await consumeRateLimit(
    rateLimitKey(CHAT_POLL_RATE_LIMIT.bucket, ip),
    CHAT_POLL_RATE_LIMIT
  )
  if (!r.allowed) throw rateLimited("Too many requests. Try again later.", r)
}

/**
 * A new chat: Turnstile, site-wide limit, then the conversation. Turnstile
 * goes first so failed checks cannot spend the site-wide quota (the per-IP
 * limit already caps Turnstile calls).
 */
export async function start(input: StartChatInput, ip: string | null) {
  await assertHuman(input.turnstileToken, ip)
  const site = await consumeRateLimit(
    "chat:start:site",
    CHAT_START_SITE_RATE_LIMIT
  )
  if (!site.allowed)
    throw rateLimited("Too many chats right now. Try again later.", site)
  const token = newToken()
  const { chat } = await repo.createConversation({
    tokenHash: hashToken(token),
    visitorName: VISITOR_NAME,
    sourcePath: input.sourcePath ?? null,
    firstMessage: input.message,
  })
  const v = await view(chat)
  if (v.botActive) defer(() => bot.maybeReply(chat.id), "chat-bot")
  return { token, view: v }
}

export async function send(chat: Chat, body: string, ip: string | null) {
  if (chat.status !== "open") throw ended()
  const byIp = await consumeRateLimit(
    rateLimitKey(CHAT_SEND_RATE_LIMIT.bucket, ip),
    CHAT_SEND_RATE_LIMIT
  )
  const byChat = await consumeRateLimit(
    `chat:send:chat:${chat.id}`,
    CHAT_SEND_CHAT_RATE_LIMIT
  )
  const denied = [byIp, byChat].filter((r) => !r.allowed)
  if (denied.length > 0)
    throw rateLimited("Too many messages. Try again later.", ...denied)
  const row = await repo.addMessage({
    conversationId: chat.id,
    sender: "visitor",
    senderName: chat.visitorName,
    body,
  })
  const fresh = await repo.findById(chat.id)
  if (!row) {
    // A guard refused: the chat closed meanwhile, or hit the message cap.
    if (!fresh || fresh.status !== "open") throw ended()
    throw new AppError(
      "RATE_LIMITED",
      "This chat has reached its message limit"
    )
  }
  if (fresh && (await botOwns(fresh)))
    defer(() => bot.maybeReply(chat.id), "chat-bot")
  return row
}

export async function saveEmail(chat: Chat, email: string) {
  if (!(await repo.setVisitorEmail(chat.id, email))) throw ended()
}

export async function end(chat: Chat) {
  if (chat.status !== "open") return
  // close() is transition-only: only the request that closed it adds the notice.
  if (!(await repo.close(chat.id))) return
  const settings = (await readChatSettings()) ?? CHAT_SETTINGS_DEFAULT
  await repo.addMessage({
    conversationId: chat.id,
    sender: "system",
    senderName: null,
    body: fillChatText(settings.notices.ended, {
      team: settings.teamName,
      botName: settings.bot.name,
    }),
    requireOpen: false,
  })
}
