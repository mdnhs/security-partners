/**
 * POST /api/v1/admin/ai/chat answers with one JSON event per line
 * (NDJSON): "start" (the conversation id and the id of the user message
 * being answered), "text" pieces of the answer,
 * then "done" (the saved message id) or "error" (a message for the panel).
 */
export const CHAT_STREAM_CONTENT_TYPE = "application/x-ndjson; charset=utf-8"

export type ChatStreamEvent =
  | {
      type: "start"
      conversationId: string
      /** The saved user message this turn answers (edit needs its id). */
      userMessageId?: string
    }
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  | { type: "done"; messageId: string }

export function encodeChatEvent(event: ChatStreamEvent): string {
  return `${JSON.stringify(event)}\n`
}

/** One line → an event; anything else (blank, broken, unknown) → null. */
export function parseChatEvent(line: string): ChatStreamEvent | null {
  if (!line.trim()) return null
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return null
  }
  if (!value || typeof value !== "object") return null
  const event = value as Record<string, unknown>
  switch (event.type) {
    case "start":
      if (typeof event.conversationId !== "string") return null
      return typeof event.userMessageId === "string"
        ? {
            type: "start",
            conversationId: event.conversationId,
            userMessageId: event.userMessageId,
          }
        : { type: "start", conversationId: event.conversationId }
    case "text":
      return typeof event.text === "string"
        ? { type: "text", text: event.text }
        : null
    case "error":
      return typeof event.message === "string"
        ? { type: "error", message: event.message }
        : null
    case "done":
      return typeof event.messageId === "string"
        ? { type: "done", messageId: event.messageId }
        : null
    default:
      return null
  }
}

/** Events from a response body, in order; chunks may split lines and characters. */
export async function* readChatStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<ChatStreamEvent> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  try {
    for (;;) {
      const { done, value } = await reader.read()
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true })
      let newline = buffer.indexOf("\n")
      while (newline !== -1) {
        const event = parseChatEvent(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
        if (event) yield event
        newline = buffer.indexOf("\n")
      }
      if (done) break
    }
    const last = parseChatEvent(buffer)
    if (last) yield last
  } finally {
    reader.releaseLock()
  }
}
