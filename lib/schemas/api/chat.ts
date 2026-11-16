import { z } from "zod"

// Port of JW lib/chat/schema.ts (live chat plan, Task 3): no name or consent
// fields — the widget asks for neither, and the server stores VISITOR_NAME.

export const CHAT_PUBLIC_ENDPOINT = "/api/v1/public/chat"

const s = (min: number, max: number) => z.string().trim().min(min).max(max)
const Email = z.string().trim().toLowerCase().max(254).pipe(z.email())

export const CHAT_SENDERS = ["visitor", "staff", "ai", "system"] as const
export type ChatSender = (typeof CHAT_SENDERS)[number]

/** The widget asks for no name; the server stores this instead. */
export const VISITOR_NAME = "Visitor"

/** The widget trims the page path to this before sending it. */
export const SOURCE_PATH_MAX = 200

export const StartChatInput = z.object({
  message: s(1, 2000),
  sourcePath: z.string().max(SOURCE_PATH_MAX).startsWith("/").optional(),
  turnstileToken: z.string().max(4096).optional(),
  website: z.string().optional(),
})
export type StartChatInput = z.infer<typeof StartChatInput>

export const SendInput = z.object({ body: s(1, 2000) })
export type SendInput = z.infer<typeof SendInput>

export const EmailInput = z.object({ email: Email })
export type EmailInput = z.infer<typeof EmailInput>

export type VisitorMessage = {
  id: number
  sender: ChatSender
  senderName: string | null
  body: string
  createdAt: string
}

export type VisitorView = {
  id: string
  status: "open" | "closed"
  botActive: boolean
  needsHuman: boolean
  hasEmail: boolean
  agentName: string | null
  messages: VisitorMessage[]
  lastId: number
}

/** GET /status. The copy reaches the widget as props, not through here. */
export type ChatStatus = {
  online: boolean
  botActive: boolean
  turnstileSiteKey: string | null
}
