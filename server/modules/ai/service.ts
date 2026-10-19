import "server-only"

import { isStepCount, type ModelMessage, streamText } from "ai"

import { baseUrlProblem, normaliseBaseUrl } from "@/lib/ai/base-url"
import { type ChatStreamEvent, encodeChatEvent } from "@/lib/ai/chat-stream"
import { hasPermission } from "@/lib/auth/permissions"
import { SITE_LOCALE, SITE_TIME_ZONE } from "@/lib/format"
import type {
  AiConversationDto,
  AiConversationSummary,
  AiMessageDto,
  AiStatusDto,
  ChatInput,
  ConversationsQuery,
  ListModelsInput,
} from "@/lib/schemas/api/ai"
import type { Paginated } from "@/lib/schemas/api/list"
import {
  type AiConfig,
  type AiProvider,
  allowLocalAiHttp,
} from "@/lib/schemas/integrations"
import { getDb } from "@/server/db/client"
import type { Actor } from "@/server/lib/actor"
import {
  aiAuthHeaders,
  aiFetchFor,
  aiModelsUrl,
} from "@/server/lib/ai-endpoints"
import { isAiTargetBlocked } from "@/server/lib/ai-target"
import {
  AppError,
  forbidden,
  isTimeoutError,
  notFound,
} from "@/server/lib/errors"
import { consumeRateLimit } from "@/server/lib/rate-limit"
import { readIntegrationConfig } from "@/server/modules/integrations/service"

import { readPublishedSettings } from "@/server/modules/settings/service"

import {
  buildSystemPrompt,
  contextMessage,
  conversationContext,
  conversationTitle,
} from "./prompt"
import { aiErrorMessage, createLanguageModel, logAiError } from "./providers"
import { screenContextFor } from "./screen-context"
import {
  type ConversationRow,
  deleteConversationRow,
  dropLastReply,
  findConversation,
  findUserName,
  insertConversation,
  insertMessage,
  listConversationRows,
  listMessageRows,
  type MessageRow,
  recentMessageRows,
  replaceFrom,
  touchConversation,
} from "./repo"
import { buildTools } from "./tools"

/** Messages of a conversation sent to the model with each new one. */
export const AI_HISTORY_LIMIT = 20
/**
 * Per user: at most `max` messages in `windowMs`. Counted in the shared
 * rate-limit table (not ai_messages), so deleting conversations does not
 * reset it.
 */
export const AI_RATE_LIMIT = { max: 30, windowMs: 10 * 60 * 1000 } as const
/** Provider call limits: whole answer, and silence between chunks. */
export const AI_TIMEOUT = { totalMs: 120_000, chunkMs: 30_000 } as const

/** Model calls per chat turn (tool calls plus the answer), spec §6.3. */
export const AI_MAX_STEPS = 5

/** Stands in for an answer that used enquiry details no longer shared. */
export const WITHHELD_QUESTION =
  "[This earlier message may hold enquiry details that are no longer shared with the assistant. It is left out.]"
export const WITHHELD_ANSWER =
  "[This earlier answer used enquiry details that are no longer shared with the assistant. It is left out.]"

/** "Monday 20 October 2026" in Irish time, for the instructions. */
const todayInDublin = new Intl.DateTimeFormat(SITE_LOCALE, {
  timeZone: SITE_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

export const aiRateLimitKey = (userId: string) => `ai:chat:${userId}`
/** "List models" per user (it spends a provider call with the saved key). */
export const AI_MODELS_RATE_LIMIT = { max: 10, windowMs: 60_000 } as const
const AI_MODELS_TIMEOUT_MS = 10_000
/** At most this many model IDs are returned. */
const AI_MODELS_MAX = 500

const turnedOff = () =>
  new AppError("NOT_FOUND", "The AI assistant is turned off")

/** Logged once until the settings read cleanly again (status runs on every admin page). */
let unreadableLogged = false

type AiState =
  | { kind: "unconfigured" | "off"; config: null }
  | { kind: "on"; config: AiConfig }

/**
 * The saved settings and whether they turn the assistant on. Unreadable
 * settings (saved secrets that no longer decrypt) count as not set up until
 * the key is entered again.
 */
async function readAiState(): Promise<AiState> {
  let config: AiConfig | null
  try {
    config = await readIntegrationConfig("integrations.ai")
  } catch (error) {
    if (error instanceof AppError) {
      if (!unreadableLogged) {
        unreadableLogged = true
        console.error("[ai] settings unreadable")
      }
      return { kind: "unconfigured", config: null }
    }
    throw error
  }
  unreadableLogged = false
  if (!config) return { kind: "unconfigured", config: null }
  if (!config.enabled) return { kind: "off", config: null }
  if (!config.model || !config.apiKey)
    return { kind: "unconfigured", config: null }
  return { kind: "on", config }
}

/** The saved settings when the assistant is on; null when off or unreadable. */
async function activeConfig(): Promise<AiConfig | null> {
  return (await readAiState()).config
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

/**
 * Whether this user sees the assistant (spec §8.3), and for managers
 * (integration:update) why not, so the shell can point them to set-up.
 */
export async function getAiStatus(actor: Actor): Promise<AiStatusDto> {
  const canManage = hasPermission(actor.roles, { integration: ["update"] })
  const unavailable = (reason: NonNullable<AiStatusDto["reason"]>) => ({
    available: false,
    canManage,
    reason,
    model: null,
    readOnly: false,
  })
  if (!hasPermission(actor.roles, { ai: ["use"] }))
    return unavailable("not-allowed")
  const state = await readAiState()
  if (state.kind !== "on") return unavailable(state.kind)
  if (!inAllowList(actor, state.config)) return unavailable("not-allowed")
  return {
    available: true,
    canManage,
    reason: null,
    model: state.config.model,
    readOnly: actor.impersonatorId !== null,
  }
}

const invalid = (message: string, field?: string) =>
  new AppError(
    "VALIDATION_FAILED",
    message,
    field ? { fieldErrors: { [field]: [message] } } : undefined
  )

const MODEL_ID = /^[A-Za-z0-9._:/-]{1,100}$/

/** Model IDs from a provider's list response; anything else is ignored. */
function modelIdsOf(provider: AiProvider, body: unknown): string[] {
  const record = (body ?? {}) as Record<string, unknown>
  const ids: string[] = []
  if (provider === "google") {
    const models = Array.isArray(record.models) ? record.models : []
    for (const model of models as Record<string, unknown>[]) {
      const methods = model?.supportedGenerationMethods
      if (Array.isArray(methods) && !methods.includes("generateContent"))
        continue
      if (typeof model?.name === "string")
        ids.push(model.name.replace(/^models\//, ""))
    }
  } else {
    const data = Array.isArray(record.data) ? record.data : []
    for (const model of data as Record<string, unknown>[])
      if (typeof model?.id === "string") ids.push(model.id)
  }
  return [...new Set(ids.filter((id) => MODEL_ID.test(id)))]
    .sort()
    .slice(0, AI_MODELS_MAX)
}

const listQueryFor = (provider: AiProvider) =>
  provider === "anthropic"
    ? "?limit=1000"
    : provider === "google"
      ? "?pageSize=1000"
      : ""

/**
 * "List models": asks the provider which models the saved key can use. The
 * key is sent only to the saved provider and base URL (a changed target
 * must be saved with its own key first). Provider errors are masked.
 */
export async function listModels(
  actor: Actor,
  input: ListModelsInput
): Promise<{ models: string[] }> {
  if (!hasPermission(actor.roles, { integration: ["update"] }))
    throw forbidden()
  const limit = await consumeRateLimit(
    `ai:models:${actor.userId}`,
    AI_MODELS_RATE_LIMIT
  )
  if (!limit.allowed)
    throw new AppError(
      "RATE_LIMITED",
      "You have listed the models a lot. Wait a minute, then try again."
    )
  const compatible = input.provider === "openai-compatible"
  const baseUrl = compatible ? normaliseBaseUrl(input.baseUrl) : ""
  if (compatible) {
    const problem = baseUrlProblem(baseUrl, {
      allowLocalHttp: allowLocalAiHttp(),
    })
    if (problem) throw invalid(problem, "baseUrl")
  }
  let config: AiConfig | null
  try {
    config = await readIntegrationConfig("integrations.ai")
  } catch (error) {
    // A key that no longer decrypts, or stored values that no longer
    // validate (e.g. a development-only base URL read in production).
    if (error instanceof AppError)
      throw invalid(
        "The saved settings can't be used. Check them, enter the API key again and save."
      )
    throw error
  }
  if (!config?.apiKey) throw invalid("Save an API key first.", "apiKey")
  if (config.provider !== input.provider || config.baseUrl !== baseUrl)
    throw invalid(
      "Save the new provider with its API key first, then list its models.",
      "apiKey"
    )
  let res: Response
  try {
    // A user-set base URL goes through the SSRF guard (server/lib/ai-target).
    res = await aiFetchFor(config.provider)(
      `${aiModelsUrl(config.provider, config.baseUrl)}${listQueryFor(config.provider)}`,
      {
        headers: aiAuthHeaders(config.provider, config.apiKey),
        redirect: "error",
        signal: AbortSignal.timeout(AI_MODELS_TIMEOUT_MS),
      }
    )
  } catch (error) {
    if (isAiTargetBlocked(error))
      throw invalid(
        "This address is not allowed (private, local or metadata address)",
        "baseUrl"
      )
    throw invalid(
      isTimeoutError(error)
        ? "The provider did not respond in time."
        : "Could not reach the provider."
    )
  }
  if (res.status === 401 || res.status === 403)
    throw invalid("The API key was rejected.", "apiKey")
  if (!res.ok) throw invalid(`The provider answered ${res.status}.`)
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw invalid("The provider sent an unexpected answer.")
  }
  return { models: modelIdsOf(config.provider, body) }
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
  const sharing = config.shareEnquiryDetails.enabled
  // A lead screen's record is rebuilt here, never taken from the browser.
  const screenContext = await screenContextFor(actor, config, input.context)
  const { conversationId, userMessageId, history, replacing } =
    await getDb().transaction(async (tx) => {
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
      // Ownership first: another user's conversation reads as missing.
      if (id) {
        if (!(await findConversation(tx, id, actor.userId)))
          throw notFound("Conversation")
        await touchConversation(tx, id)
      }
      if (input.regenerate) {
        // Answer the last question again. Its current reply stays until a
        // new one is saved (C9 review M2): see `replacing` below.
      } else if (input.editMessageId) {
        const replaced = await replaceFrom(
          tx,
          id!,
          input.editMessageId,
          input.message!
        )
        if (replaced === "missing") throw notFound("Message")
        if (replaced === "not-user")
          throw invalid("Only your own messages can be edited", "editMessageId")
      } else {
        if (!id) {
          const created = await insertConversation(tx, {
            userId: actor.userId,
            title: conversationTitle(input.message!),
            context: conversationContext(input.context),
          })
          id = created.id
        }
        await insertMessage(tx, {
          conversationId: id,
          role: "user",
          content: input.message!,
        })
      }
      const history = await recentMessageRows(tx, id!, AI_HISTORY_LIMIT)
      // Regenerate: the model does not see the reply it replaces (a
      // stopped or failed turn has none).
      const replacing =
        input.regenerate === true && history.at(-1)?.role === "assistant"
      if (replacing) history.pop()
      const question = history.at(-1)
      if (question?.role !== "user")
        throw new AppError("CONFLICT", "There is no question to answer yet.")
      return {
        conversationId: id!,
        userMessageId: question.id,
        history,
        replacing,
      }
    })
  // The model must see a user message first.
  while (history[0]?.role === "assistant") history.shift()

  // Messages that may hold enquiry details stay out of the model's history
  // once the owner has turned sharing off (C8 review M8, C9 review I1):
  // answers that used them, and every message from before the flag
  // existed (migration 0012). While sharing is on, a new answer built on
  // them carries the same mark.
  const historyShared = history.some((row) => row.enquiryDetails)
  const messages = history.map((row): ModelMessage => {
    if (sharing || !row.enquiryDetails) return modelMessage(row)
    return row.role === "user"
      ? { role: "user", content: WITHHELD_QUESTION }
      : { role: "assistant", content: WITHHELD_ANSWER }
  })
  // The screen goes in a user-role message right before the question, never
  // in the (static) instructions.
  const screen = contextMessage(screenContext.context)
  if (screen) messages.splice(-1, 0, { role: "user", content: screen })

  // Stopped by the request (client gone) or by the stream being cancelled.
  const cancelled = new AbortController()
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, cancelled.signal])
    : cancelled.signal

  // Read-only tools, offered by the user's roles and run as the user.
  const tools = buildTools({ actor, config })
  const [userName, site] = await Promise.all([
    findUserName(getDb(), actor.userId),
    readPublishedSettings("site"),
  ])
  const instructions = buildSystemPrompt({
    siteName: site?.name ?? "Security Partners",
    firstName: (userName ?? "").trim().split(/\s+/)[0] ?? "",
    roles: actor.roles,
    today: todayInDublin.format(new Date()),
    toolNames: Object.keys(tools),
    extra: config.extraInstructions,
  })

  const result = streamText({
    model: createLanguageModel(config),
    instructions,
    messages,
    tools,
    // At most 5 model calls per turn (tool calls and the answer).
    stopWhen: isStepCount(AI_MAX_STEPS),
    // The last step must answer in words, not call another tool.
    prepareStep: ({ stepNumber }) =>
      stepNumber >= AI_MAX_STEPS - 1 ? { toolChoice: "none" } : undefined,
    maxOutputTokens: config.maxOutputTokens,
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
      send({ type: "start", conversationId, userMessageId })
      let answer = ""
      let failed = false
      // Enquiry details reached the model in this turn (switch on only).
      let enquiryDetails =
        sharing && (screenContext.enquiryDetails || historyShared)
      try {
        for await (const part of result.stream) {
          if (part.type === "text-delta") {
            answer += part.text
            send({ type: "text", text: part.text })
          } else if (
            part.type === "tool-call" &&
            part.toolName === "getEnquiryStats"
          ) {
            if (sharing) enquiryDetails = true
          } else if (part.type === "error") {
            failed = true
            logAiError(part.error)
            send({ type: "error", message: aiErrorMessage(part.error) })
            break
          }
        }
        if (!failed && !signal.aborted) {
          if (answer.trim()) {
            const saved = await getDb().transaction(async (tx) => {
              // Regenerate: the old reply goes only now, with the new one.
              if (replacing) await dropLastReply(tx, conversationId)
              return insertMessage(tx, {
                conversationId,
                role: "assistant",
                content: answer,
                enquiryDetails,
              })
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
