import { z } from "zod"

import { AI_BASE_URL_MAX } from "@/lib/ai/base-url"
import { AI_PROVIDERS } from "@/lib/schemas/integrations/ai"

import { listQuery } from "./list"

/** One message from the user, in characters. */
export const AI_MAX_MESSAGE_CHARS = 4000
/** The focused field's current value sent with a message. */
export const AI_MAX_FIELD_CHARS = 10_000
/** The record on screen, as compact JSON. */
export const AI_MAX_RECORD_CHARS = 30_000

const jsonLength = (value: unknown) =>
  value === undefined ? 0 : (JSON.stringify(value)?.length ?? 0)

/** The text field the user last focused (spec §8.3 "the open field"). */
export const chatField = z.object({
  path: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[A-Za-z0-9_.]+$/, "Invalid field path"),
  label: z.string().trim().min(1).max(120),
  value: z.string().max(AI_MAX_FIELD_CHARS),
  maxLength: z.number().int().positive().nullable(),
})
export type ChatField = z.output<typeof chatField>

/**
 * What the assistant sees of the current screen: read-only data sent with
 * one message. The record and the field value are never stored.
 */
export const chatContext = z.object({
  screen: z.string().trim().min(1).max(120),
  entityType: z
    .string()
    .max(40)
    .regex(/^[a-z][a-z-]*$/, "Invalid entity type")
    .optional(),
  entityId: z.string().min(1).max(120).optional(),
  field: chatField.optional(),
  record: z
    .unknown()
    .refine((value) => jsonLength(value) <= AI_MAX_RECORD_CHARS, {
      message: `The screen data is too large (over ${AI_MAX_RECORD_CHARS} characters)`,
    })
    .optional(),
})
export type ChatContext = z.output<typeof chatContext>

/**
 * POST /ai/chat. No conversationId = a new conversation. Two variations
 * (MK parity C9): `regenerate` answers the last question again (no
 * message), and `editMessageId` replaces one of the user's own messages
 * and everything after it.
 */
export const chatInput = z
  .object({
    conversationId: z.uuid().optional(),
    message: z
      .string()
      .trim()
      .min(1, "Write a message")
      .max(AI_MAX_MESSAGE_CHARS, `At most ${AI_MAX_MESSAGE_CHARS} characters`)
      .optional(),
    regenerate: z.literal(true).optional(),
    editMessageId: z.uuid().optional(),
    context: chatContext.optional(),
  })
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message })
    if (value.regenerate) {
      if (!value.conversationId)
        issue("conversationId", "Choose a conversation to regenerate")
      if (value.message !== undefined)
        issue("message", "Regenerate takes no message")
      if (value.editMessageId)
        issue("editMessageId", "Edit or regenerate, not both")
      return
    }
    if (value.message === undefined) issue("message", "Write a message")
    if (value.editMessageId && !value.conversationId)
      issue("conversationId", "Choose a conversation to edit")
  })
export type ChatInput = z.output<typeof chatInput>

/** GET /ai/conversations (newest first). */
export const conversationsQuery = listQuery.pick({ page: true, pageSize: true })
export type ConversationsQuery = z.output<typeof conversationsQuery>

/** GET /ai/status: whether this user sees the assistant. */
export type AiStatusDto = {
  available: boolean
  /** May change the AI settings (integration:update): shown the set-up entry points. */
  canManage: boolean
  /**
   * Why it is unavailable (null when available): turned off, not set up
   * (or its saved key cannot be read), or not for this user's roles.
   */
  reason: "off" | "unconfigured" | "not-allowed" | null
  /** The configured model, only when available. */
  model: string | null
  /** Viewing the admin as someone else: conversations can be read, not sent. */
  readOnly: boolean
}

/** POST /ai/models: the models the saved key can use at this provider. */
export const listModelsInput = z.object({
  provider: z.enum(AI_PROVIDERS, { error: "Choose a provider" }),
  baseUrl: z.string().max(AI_BASE_URL_MAX).default(""),
})
export type ListModelsInput = z.output<typeof listModelsInput>

export type AiConversationSummary = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export type AiMessageDto = {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: string
}

export type AiConversationDto = AiConversationSummary & {
  messages: AiMessageDto[]
}
