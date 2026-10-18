import "server-only"

import { type ModelMessage, streamText } from "ai"

import { type ChatStreamEvent, encodeChatEvent } from "@/lib/ai/chat-stream"
import { hasPermission } from "@/lib/auth/permissions"
import type {
  AiConversationDto,
  AiConversationSummary,
  AiMessageDto,
  AiStatusDto,
  ChatInput,
  ConversationsQuery,
} from "@/lib/schemas/api/ai"
import type { Paginated } from "@/lib/schemas/api/list"
import type { AiConfig } from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import { AppError, forbidden, notFound } from "@/server/lib/errors"
import { consumeRateLimit } from "@/server/lib/rate-limit"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import {
  ASSISTANT_RULES,
  contextMessage,
  conversationContext,
  conversationTitle,
} from "./prompt"
import { aiErrorMessage, createLanguageModel, logAiError } from "./providers"
import {
  type ConversationRow,
  deleteConversationRow,
  findConversation,
  insertConversation,
  insertMessage,
  listConversationRows,
  listMessageRows,
  type MessageRow,
  recentMessageRows,
  touchConversation,
} from "./repo"

/** Messages of a conversation sent to the model with each new one. */
export const AI_HISTORY_LIMIT = 20
export const AI_MAX_OUTPUT_TOKENS = 1500
/**
 * Per user: at most `max` messages in `windowMs`. Counted in the shared
 * rate-limit table (not ai_messages), so deleting conversations does not
 * reset it.
 */
export const AI_RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 } as const
/** Provider call limits: whole answer, and silence between chunks. */
export const AI_TIMEOUT = { totalMs: 120_000, chunkMs: 30_000 } as const

export const aiRateLimitKey = (userId: string) => `ai:chat:${userId}`

const OFF = { available: false, model: null, readOnly: false } as const

const turnedOff = () =>
  new AppError("NOT_FOUND", "The AI assistant is turned off")

/** Logged once until the settings read cleanly again (status runs on every admin page). */
let unreadableLogged = false

/** The saved settings when the assistant is on; null when off or unreadable. */
async function activeConfig(): Promise<AiConfig | null> {
  let config: AiConfig | null
  try {
    config = await readIntegrationConfig("integrations.ai")
  } catch (error) {
    // Saved secrets that no longer decrypt: off until re-entered.
    if (error instanceof AppError) {
      if (!unreadableLogged) {
        unreadableLogged = true
        console.error("[ai] settings unreadable")
      }
      return null
    }
    throw error
  }
  unreadableLogged = false
  if (!config?.enabled || !config.model || !config.apiKey) return null
  return config
}

const inAllowList = (actor: Actor, config: AiConfig) =>
  actor.roles.some((role) => config.allowedRoles.includes(role))

/** ai:use first (403), then on (404), then the role allow-list (403). */
async function requireAssistant(actor: Actor): Promise<AiConfig> {
  if (!hasPermission(actor.roles, { ai: ["use"] })) throw forbidden()
  const config = await activeConfig()
  if (!config) throw turnedOff()
  if (!inAllowList(actor, config)) throw forbidden()
  return config
}

function assertNotImpersonating(actor: Actor) {
  if (actor.impersonatorId)
    throw new AppError(
      "FORBIDDEN",
      "The assistant is read-only while you view the admin as someone else"
    )
}

const summaryOf = (row: ConversationRow): AiConversationSummary => ({
  id: row.id,
  title: row.title,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const messageOf = (row: MessageRow): AiMessageDto => ({
  id: row.id,
  role: row.role,
  content: row.content,
  createdAt: row.createdAt.toISOString(),
})

const modelMessage = (row: MessageRow): ModelMessage =>
  row.role === "user"
    ? { role: "user", content: row.content }
    : { role: "assistant", content: row.content }

/** Whether this user sees the assistant (spec §8.3: off and hidden until configured). */
export async function getAiStatus(actor: Actor): Promise<AiStatusDto> {
  if (!hasPermission(actor.roles, { ai: ["use"] })) return OFF
  const config = await activeConfig()
  if (!config || !inAllowList(actor, config)) return OFF
  return {
    available: true,
    model: config.model,
    readOnly: actor.impersonatorId !== null,
  }
}

/**
 * One turn: stores the user's message, asks the model with the screen
 * context and the recent history, and streams NDJSON events. The answer
 * is stored only when it completed. The assistant never writes content:
 * the user applies suggestions in the form.
 */
export async function chat(
  actor: Actor,
  input: ChatInput,
  opts: { signal?: AbortSignal } = {}
): Promise<{ conversationId: string; stream: ReadableStream<Uint8Array> }> {
  const config = await requireAssistant(actor)
  assertNotImpersonating(actor)
  const { conversationId, history } = await getDb().transaction(async (tx) => {
    // Atomic upsert: its row lock serialises a burst until this commits; a
    // rejected or failed request rolls its count back.
    const limit = await consumeRateLimit(
      aiRateLimitKey(actor.userId),
      AI_RATE_LIMIT,
      tx
    )
    if (!limit.allowed)
      throw new AppError(
        "RATE_LIMITED",
        "You have sent a lot of messages. Wait a few minutes, then try again."
      )
    let id = input.conversationId
    if (id) {
      if (!(await findConversation(tx, id, actor.userId)))
        throw notFound("Conversation")
      await touchConversation(tx, id)
    } else {
      const created = await insertConversation(tx, {
        userId: actor.userId,
        title: conversationTitle(input.message),
        context: conversationContext(input.context),
      })
      id = created.id
    }
    await insertMessage(tx, {
      conversationId: id,
      role: "user",
      content: input.message,
    })
    return {
      conversationId: id,
      history: await recentMessageRows(tx, id, AI_HISTORY_LIMIT),
    }
  })
  // The model must see a user message first.
  while (history[0]?.role === "assistant") history.shift()

  const messages = history.map(modelMessage)
  // The screen goes in a user-role message right before the question, never
  // in the (static) instructions.
  const screen = contextMessage(input.context)
  if (screen) messages.splice(-1, 0, { role: "user", content: screen })

  // Stopped by the request (client gone) or by the stream being cancelled.
  const cancelled = new AbortController()
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, cancelled.signal])
    : cancelled.signal

  const result = streamText({
    model: createLanguageModel(config),
    instructions: ASSISTANT_RULES,
    messages,
    maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
    maxRetries: 1,
    timeout: AI_TIMEOUT,
    abortSignal: signal,
    // Failures are read from the stream below (no default console dump).
    onError: () => {},
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled.abort()
    },
    async start(controller) {
      let open = true
      const send = (event: ChatStreamEvent) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(encodeChatEvent(event)))
        } catch {
          open = false // the client went away
        }
      }
      send({ type: "start", conversationId })
      let answer = ""
      let failed = false
      try {
        for await (const part of result.stream) {
          if (part.type === "text-delta") {
            answer += part.text
            send({ type: "text", text: part.text })
          } else if (part.type === "error") {
            failed = true
            logAiError(part.error)
            send({ type: "error", message: aiErrorMessage(part.error) })
            break
          }
        }
        if (!failed && !signal.aborted) {
          if (answer.trim()) {
            const saved = await insertMessage(getDb(), {
              conversationId,
              role: "assistant",
              content: answer,
            })
            send({ type: "done", messageId: saved.id })
          } else {
            send({
              type: "error",
              message:
                "The assistant gave no answer. Try rewording your message.",
            })
          }
        }
      } catch (error) {
        if (!signal.aborted) {
          logAiError(error)
          send({ type: "error", message: aiErrorMessage(error) })
        }
      } finally {
        if (open) {
          open = false
          try {
            controller.close()
          } catch {
            // already closed by a cancelled request
          }
        }
      }
    },
  })
  return { conversationId, stream }
}

export async function listConversations(
  actor: Actor,
  query: ConversationsQuery
): Promise<Paginated<AiConversationSummary>> {
  await requireAssistant(actor)
  const { rows, total } = await listConversationRows(getDb(), actor.userId, {
    page: query.page,
    pageSize: query.pageSize,
  })
  return {
    items: rows.map(summaryOf),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getConversation(
  actor: Actor,
  id: string
): Promise<AiConversationDto> {
  await requireAssistant(actor)
  const db = getDb()
  const row = await findConversation(db, id, actor.userId)
  if (!row) throw notFound("Conversation")
  return {
    ...summaryOf(row),
    messages: (await listMessageRows(db, id)).map(messageOf),
  }
}

export async function deleteConversation(
  actor: Actor,
  id: string
): Promise<{ ok: true }> {
  await requireAssistant(actor)
  assertNotImpersonating(actor)
  if (!(await deleteConversationRow(getDb(), id, actor.userId)))
    throw notFound("Conversation")
  return { ok: true }
}
