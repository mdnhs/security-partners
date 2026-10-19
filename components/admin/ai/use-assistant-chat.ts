"use client"

import { useQueryClient } from "@tanstack/react-query"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

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
  /** Not (yet) known to the server by this id: cannot be edited. */
  local?: true
}

/** How the last answer ended, for the panel's screen-reader summary. */
export type ChatOutcome = "answered" | "stopped" | "failed" | null

export type AssistantChat = {
  messages: ChatMessage[]
  conversationId: string | null
  busy: boolean
  error: string | null
  outcome: ChatOutcome
  send: (text: string, context: ChatContext | undefined) => Promise<void>
  /** Asks again for the last answer: POST {conversationId, regenerate:true}. */
  regenerate: (context?: ChatContext) => Promise<void>
  /**
   * Replaces one of the user's messages and everything after it:
   * POST {conversationId, message, editMessageId}.
   */
  edit: (
    messageId: string,
    text: string,
    context?: ChatContext
  ) => Promise<void>
  stop: () => void
  reset: () => void
  open: (id: string) => Promise<void>
}

type TurnBody = {
  conversationId?: string
  message?: string
  regenerate?: true
  editMessageId?: string
  context?: ChatContext
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
  const [outcome, setOutcome] = useState<ChatOutcome>(null)
  const controller = useRef<AbortController | null>(null)
  const conversation = useRef<string | null>(null)
  // The messages as last rendered: regenerate and edit start from them.
  const current = useRef<ChatMessage[]>([])
  useLayoutEffect(() => {
    current.current = messages
  }, [messages])
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
      setOutcome(null)
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

  /**
   * One turn. `next` is the conversation shown while it runs (without the
   * reply); `userId` is the local id of the new user message, if any.
   * Restoring puts the conversation back as it was: edit when the request
   * is refused (the server changed nothing), regenerate whenever no new
   * answer was saved (refused, failed or stopped: the server keeps the old
   * answer until a new one is saved, C9 review M2).
   */
  const run = useCallback(
    async (
      json: TurnBody,
      next: ChatMessage[],
      userId: string | null,
      restore: "never" | "on-refusal" | "unless-answered"
    ) => {
      const restoreOnRefusal = restore !== "never"
      if (controller.current) return
      const before = current.current
      const mine = epoch.current
      opening.current += 1
      const abort = new AbortController()
      controller.current = abort
      let replyId = localId("reply")
      let answered = false
      const patch = (
        id: string,
        change: (m: ChatMessage) => ChatMessage | null
      ) =>
        setMessages((all) =>
          all.flatMap((m) => {
            if (m.id !== id) return [m]
            const changed = change(m)
            return changed ? [changed] : []
          })
        )
      setError(null)
      setOutcome(null)
      setBusy(true)
      setMessages([
        ...next,
        {
          id: replyId,
          role: "assistant",
          content: "",
          pending: true,
          local: true,
        },
      ])
      try {
        const res = await api.ai.chat.$post(
          { json },
          { init: { signal: abort.signal } }
        )
        if (!res.ok) {
          let body: Partial<ApiErrorBody> | null = null
          try {
            body = (await res.json()) as Partial<ApiErrorBody>
          } catch {
            body = null
          }
          if (restoreOnRefusal && epoch.current === mine) setMessages(before)
          throw new ApiError(res.status, body)
        }
        if (!res.body) throw new Error("The answer was empty")
        for await (const event of readChatStream(res.body)) {
          if (epoch.current !== mine) return
          if (event.type === "start") {
            conversation.current = event.conversationId
            setConversationId(event.conversationId)
            const saved = event.userMessageId
            if (userId && saved)
              patch(userId, (m) => ({ ...m, id: saved, local: undefined }))
          } else if (event.type === "text") {
            patch(replyId, (m) => ({ ...m, content: m.content + event.text }))
          } else if (event.type === "error") {
            setError(event.message)
          } else {
            const saved = event.messageId
            patch(replyId, (m) => ({
              ...m,
              id: saved,
              pending: false,
              local: undefined,
            }))
            replyId = saved
            answered = true
          }
        }
      } catch (err) {
        if (!abort.signal.aborted && epoch.current === mine)
          setError(errorMessage(err))
      } finally {
        if (epoch.current === mine) {
          if (restore === "unless-answered" && !answered) setMessages(before)
          // What arrived stays (stopped or failed mid-way); an empty reply goes.
          else
            patch(replyId, (m) =>
              m.content.trim() ? { ...m, pending: false } : null
            )
          setBusy(false)
          setOutcome(
            answered ? "answered" : abort.signal.aborted ? "stopped" : "failed"
          )
          void queryClient.invalidateQueries({ queryKey: AI_CONVERSATIONS_KEY })
        }
        if (controller.current === abort) controller.current = null
      }
    },
    [queryClient]
  )

  const send = useCallback(
    async (text: string, context: ChatContext | undefined) => {
      const message = text.trim()
      if (!message || controller.current) return
      const userId = localId("user")
      await run(
        { conversationId: conversation.current ?? undefined, message, context },
        [
          ...current.current,
          {
            id: userId,
            role: "user",
            content: message,
            pending: false,
            local: true,
          },
        ],
        userId,
        "never"
      )
    },
    [run]
  )

  const regenerate = useCallback(
    async (context?: ChatContext) => {
      const id = conversation.current
      if (!id || controller.current) return
      const all = current.current
      // The last reply is hidden while the new one streams; it comes back
      // if no new answer is saved (the server keeps it until then).
      const next = all.at(-1)?.role === "assistant" ? all.slice(0, -1) : all
      await run(
        { conversationId: id, regenerate: true, context },
        next,
        null,
        "unless-answered"
      )
    },
    [run]
  )

  const edit = useCallback(
    async (messageId: string, text: string, context?: ChatContext) => {
      const message = text.trim()
      const id = conversation.current
      if (!message || !id || controller.current) return
      const all = current.current
      const at = all.findIndex((m) => m.id === messageId && m.role === "user")
      if (at === -1 || all[at]!.local) return
      const userId = localId("user")
      await run(
        { conversationId: id, message, editMessageId: messageId, context },
        [
          ...all.slice(0, at),
          {
            id: userId,
            role: "user",
            content: message,
            pending: false,
            local: true,
          },
        ],
        userId,
        "on-refusal"
      )
    },
    [run]
  )

  return {
    messages,
    conversationId,
    busy,
    error,
    outcome,
    send,
    regenerate,
    edit,
    stop,
    reset,
    open,
  }
}
