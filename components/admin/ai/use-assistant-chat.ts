"use client"

import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"

import { readChatStream } from "@/lib/ai/chat-stream"
import {
  api,
  ApiError,
  type ApiErrorBody,
  errorMessage,
} from "@/lib/api-client"
import type { ChatContext } from "@/lib/schemas/api/ai"

import { AI_CONVERSATIONS_KEY, fetchConversation } from "./queries"

export type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  /** The reply is still arriving. */
  pending: boolean
}

export type AssistantChat = {
  messages: ChatMessage[]
  conversationId: string | null
  busy: boolean
  error: string | null
  send: (text: string, context: ChatContext | undefined) => Promise<void>
  stop: () => void
  reset: () => void
  open: (id: string) => Promise<void>
}

let localIds = 0
const localId = (prefix: string) => `${prefix}-${++localIds}`

/**
 * The assistant conversation (spec §8.3). Held by the topbar button, which
 * the panel layout keeps mounted, so it survives closing the panel and
 * moving between screens.
 */
export function useAssistantChat(): AssistantChat {
  const queryClient = useQueryClient()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const conversation = useRef<string | null>(null)
  // A reply that finishes after "New chat" or after opening another
  // conversation must not write into the new one.
  const epoch = useRef(0)
  // Past conversations load asynchronously: only the latest request (and
  // only if nothing changed the conversation meanwhile) may switch to it.
  const opening = useRef(0)

  // Stopping aborts the fetch: the server then cancels the provider call
  // and saves no assistant message (readChatStream alone never cancels).
  const stop = useCallback(() => {
    controller.current?.abort()
    controller.current = null
  }, [])
  // Signing out / leaving the admin unmounts the button: stop the answer.
  useEffect(() => stop, [stop])

  const switchTo = useCallback(
    (id: string | null, next: ChatMessage[]) => {
      stop()
      epoch.current += 1
      opening.current += 1
      conversation.current = id
      setConversationId(id)
      setMessages(next)
      setError(null)
      setBusy(false)
    },
    [stop]
  )

  const reset = useCallback(() => switchTo(null, []), [switchTo])

  const open = useCallback(
    async (id: string) => {
      const mine = ++opening.current
      try {
        const loaded = await fetchConversation(id)
        if (opening.current !== mine) return
        switchTo(
          id,
          loaded.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            pending: false,
          }))
        )
      } catch (err) {
        if (opening.current === mine) setError(errorMessage(err))
      }
    },
    [switchTo]
  )

  const send = useCallback(
    async (text: string, context: ChatContext | undefined) => {
      const message = text.trim()
      if (!message || controller.current) return
      const mine = epoch.current
      opening.current += 1
      const abort = new AbortController()
      controller.current = abort
      const replyId = localId("reply")
      const patchReply = (patch: (m: ChatMessage) => ChatMessage | null) =>
        setMessages((all) =>
          all.flatMap((m) => {
            if (m.id !== replyId) return [m]
            const next = patch(m)
            return next ? [next] : []
          })
        )
      setError(null)
      setBusy(true)
      setMessages((all) => [
        ...all,
        { id: localId("user"), role: "user", content: message, pending: false },
        { id: replyId, role: "assistant", content: "", pending: true },
      ])
      try {
        const res = await api.ai.chat.$post(
          {
            json: {
              conversationId: conversation.current ?? undefined,
              message,
              context,
            },
          },
          { init: { signal: abort.signal } }
        )
        if (!res.ok) {
          let body: Partial<ApiErrorBody> | null = null
          try {
            body = (await res.json()) as Partial<ApiErrorBody>
          } catch {
            body = null
          }
          throw new ApiError(res.status, body)
        }
        if (!res.body) throw new Error("The answer was empty")
        for await (const event of readChatStream(res.body)) {
          if (epoch.current !== mine) return
          if (event.type === "start") {
            conversation.current = event.conversationId
            setConversationId(event.conversationId)
          } else if (event.type === "text") {
            patchReply((m) => ({ ...m, content: m.content + event.text }))
          } else if (event.type === "error") {
            setError(event.message)
          } else {
            patchReply((m) => ({ ...m, pending: false }))
          }
        }
      } catch (err) {
        if (!abort.signal.aborted && epoch.current === mine)
          setError(errorMessage(err))
      } finally {
        if (epoch.current === mine) {
          // What arrived stays (stopped or failed mid-way); an empty reply goes.
          patchReply((m) =>
            m.content.trim() ? { ...m, pending: false } : null
          )
          setBusy(false)
          void queryClient.invalidateQueries({ queryKey: AI_CONVERSATIONS_KEY })
        }
        if (controller.current === abort) controller.current = null
      }
    },
    [queryClient]
  )

  return { messages, conversationId, busy, error, send, stop, reset, open }
}
