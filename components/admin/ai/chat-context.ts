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
