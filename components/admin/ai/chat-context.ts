import { suggestionText } from "@/lib/ai/suggestion"
import {
  AI_MAX_FIELD_CHARS,
  AI_MAX_RECORD_CHARS,
  type ChatContext,
} from "@/lib/schemas/api/ai"

import type {
  AssistantField,
  AssistantScreen,
  ScreenInfo,
} from "./assistant-context"

/**
 * What "Insert" would put into the field, or why it cannot. A single-line
 * field gets the whole reply on one line (line breaks and the spaces
 * around them become one space, so nothing is dropped silently); a reply
 * longer than the field allows is refused (the user copies it instead).
 */
export function insertText(
  reply: string,
  field: Pick<AssistantField, "multiline" | "maxLength">
): { ok: true; text: string } | { ok: false; length: number; max: number } {
  let text = suggestionText(reply)
  if (!field.multiline) text = text.replace(/\s*\n\s*/g, " ").trim()
  if (field.maxLength !== null && text.length > field.maxLength)
    return { ok: false, length: text.length, max: field.maxLength }
  return { ok: true, text }
}

/**
 * The context sent with one message (spec §8.3): the screen, the focused
 * field's current value and the record. A record too large to send is
 * left out rather than failing the message.
 */
export function chatContextFrom(
  screen: AssistantScreen | null,
  field: AssistantField | null
): ChatContext | undefined {
  if (!screen) return undefined
  const context: ChatContext = { screen: screen.title.slice(0, 120) }
  if (screen.entityType) context.entityType = screen.entityType
  if (screen.entityId) context.entityId = screen.entityId
  if (field)
    context.field = {
      path: field.path,
      label: field.label.slice(0, 120),
      value: field.read().slice(0, AI_MAX_FIELD_CHARS),
      maxLength: field.maxLength,
    }
  if (screen.record !== undefined) {
    const size = JSON.stringify(screen.record)?.length ?? 0
    if (size <= AI_MAX_RECORD_CHARS) context.record = screen.record
  }
  return context
}

/** Suggestions shown in an empty conversation; they fill the message box. */
export function starterPrompts(
  screen: ScreenInfo | null,
  fieldLabel: string | null
): string[] {
  const prompts: string[] = []
  if (fieldLabel)
    prompts.push(
      `Rewrite “${fieldLabel}” to be clearer and shorter.`,
      `Suggest three alternatives for “${fieldLabel}”.`
    )
  if (screen?.entityType === "lead")
    prompts.push("Summarise this lead and suggest a next step.")
  else if (screen)
    prompts.push(`Suggest an SEO title and description for “${screen.title}”.`)
  if (prompts.length === 0)
    prompts.push(
      "Draft a short introduction to our security services.",
      "Suggest an SEO title and description for the home page."
    )
  return prompts
}
