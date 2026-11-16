"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import type {
  ChatStatus,
  StartChatInput,
  VisitorMessage,
  VisitorView,
} from "@/lib/schemas/api/chat"

import {
  getConversation,
  getStatus,
  saveEmail as apiSaveEmail,
  sendMessage,
  startChat,
  type ApiResult,
} from "./api"

/** What the panel shows above the composer, as settings copy (Task 9). */
export type ChatNotice = "offline" | "rate" | "ended" | null

/** The conversation state the panel reads (everything but the messages). */
export type ChatViewState = Pick<
  VisitorView,
  "id" | "status" | "botActive" | "needsHuman" | "hasEmail" | "agentName"
>

// Live chat plan C1: 3 s open, 20 s closed (only once a chat exists), and on
// failures 3 → 6 → 12 → 24 → 30 s.
const OPEN_MS = 3000
const CLOSED_MS = 20_000
const BACKOFF_MS = [3000, 6000, 12_000, 24_000, 30_000]

const NO_VIEW: ChatViewState = {
  id: "",
  status: "open",
  botActive: false,
  needsHuman: false,
  hasEmail: false,
  agentName: null,
}

const merge = (prev: VisitorMessage[], incoming: VisitorMessage[]) => {
  if (!incoming.length) return prev
  const byId = new Map(prev.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

// Port of JW features/chat/use-chat.ts. Owns the visitor's conversation:
// cookie-backed restore on mount, polling (paused while hidden, backed off on
// errors), the chat status and the visitor's actions. The panel is
// presentational.
export function useChat({ open }: { open: boolean }) {
  const [messages, setMessages] = useState<VisitorMessage[]>([])
  const [view, setView] = useState<ChatViewState>(NO_VIEW)
  const [exists, setExists] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [offline, setOffline] = useState(false)
  const [notice, setNotice] = useState<ChatNotice>(null)
  const [unread, setUnread] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<ChatStatus | null>(null)

  const lastId = useRef(0)
  const known = useRef(new Set<number>())
  const existsRef = useRef(false)
  const loadedRef = useRef(false)
  const closedRef = useRef(false)
  const openRef = useRef(open)

  // Opening the panel reads everything: adjust during render, not in an
  // effect.
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setUnread(false)
  }
  // openRef follows in the commit, not in a passive effect: a poll landing
  // between the opening render and its effects would otherwise see the panel
  // closed and mark it unread again.
  useLayoutEffect(() => {
    openRef.current = open
  }, [open])
  const firstLoad = useRef(true)
  const engine = useRef({
    poll: async () => {},
    schedule: () => {},
  })

  const apply = useCallback((data: VisitorView) => {
    const fresh = data.messages.filter((m) => !known.current.has(m.id))
    for (const m of data.messages) known.current.add(m.id)
    // Only replies that arrive while the panel is closed are unread; the
    // history restored on page load is not.
    if (
      !firstLoad.current &&
      !openRef.current &&
      fresh.some((m) => m.sender !== "visitor")
    ) {
      setUnread(true)
    }
    firstLoad.current = false
    lastId.current = Math.max(
      lastId.current,
      data.lastId,
      ...data.messages.map((m) => m.id)
    )
    setMessages((prev) => merge(prev, data.messages))
    closedRef.current = data.status === "closed"
    setView({
      id: data.id,
      status: data.status,
      botActive: data.botActive,
      needsHuman: data.needsHuman,
      hasEmail: data.hasEmail,
      agentName: data.agentName,
    })
    existsRef.current = true
    setExists(true)
  }, [])

  const refreshStatus = useCallback(() => {
    void getStatus().then((r) => {
      if (r.ok) setStatus(r.data)
    })
  }, [])

  // Polling engine. Lives in one effect so poll and schedule can call each
  // other; actions reach it through `engine`.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let inflight = false
    let queued = false
    let failures = 0
    let alive = true

    const schedule = () => {
      clearTimeout(timer)
      if (!alive || document.hidden) return
      if (closedRef.current) return
      if (loadedRef.current && !existsRef.current) return
      const delay = failures
        ? BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]
        : openRef.current
          ? OPEN_MS
          : CLOSED_MS
      // Re-check at fire time: the tab may have been hidden since scheduling.
      timer = setTimeout(() => {
        if (!document.hidden) void poll()
      }, delay)
    }

    const poll = async () => {
      // A poll asked for mid-flight (after a send) runs right after it.
      if (inflight) {
        queued = true
        return
      }
      inflight = true
      clearTimeout(timer)
      const result = await getConversation(lastId.current)
      inflight = false
      if (!alive) return
      if (result.ok) {
        failures = 0
        setOffline(false)
        loadedRef.current = true
        setLoaded(true)
        apply(result.data)
      } else if (result.kind === "notfound") {
        failures = 0
        setOffline(false)
        loadedRef.current = true
        setLoaded(true)
        existsRef.current = false
        setExists(false)
      } else {
        failures += 1
        setOffline(result.kind === "network")
      }
      if (queued) {
        queued = false
        void poll()
        return
      }
      schedule()
    }

    const wake = () => {
      if (document.hidden) return
      if (loadedRef.current && !existsRef.current) return
      if (closedRef.current) return
      void poll()
    }

    engine.current = { poll, schedule }
    void poll()
    document.addEventListener("visibilitychange", wake)
    window.addEventListener("online", wake)
    window.addEventListener("focus", wake)
    return () => {
      alive = false
      clearTimeout(timer)
      document.removeEventListener("visibilitychange", wake)
      window.removeEventListener("online", wake)
      window.removeEventListener("focus", wake)
    }
  }, [apply])

  useEffect(() => {
    refreshStatus()
  }, [refreshStatus])

  useEffect(() => {
    if (open) {
      if (existsRef.current && !closedRef.current) void engine.current.poll()
    } else {
      engine.current.schedule()
    }
  }, [open])

  const start = useCallback(
    async (input: StartChatInput): Promise<ApiResult<unknown>> => {
      setSending(true)
      const result = await startChat(input)
      setSending(false)
      if (result.ok) {
        const data = result.data
        // The honeypot answer has no chat in it.
        if ("id" in data) {
          known.current = new Set()
          lastId.current = 0
          firstLoad.current = true
          setMessages([])
          apply(data)
          loadedRef.current = true
          setLoaded(true)
          setNotice(null)
          engine.current.schedule()
        }
      } else if (result.kind === "network") setNotice("offline")
      else if (result.kind === "rate") setNotice("rate")
      return result
    },
    [apply]
  )

  const send = useCallback(async (body: string): Promise<boolean> => {
    setSending(true)
    const result = await sendMessage(body)
    setSending(false)
    if (result.ok) {
      setNotice(null)
      void engine.current.poll()
      return true
    }
    if (result.kind === "network") setNotice("offline")
    else if (result.kind === "rate") setNotice("rate")
    else if (result.kind === "ended") {
      closedRef.current = true
      setView((v) => ({ ...v, status: "closed" }))
      setNotice("ended")
    } else if (result.kind === "notfound") {
      existsRef.current = false
      setExists(false)
    }
    return false
  }, [])

  const saveEmail = useCallback(async (email: string) => {
    const result = await apiSaveEmail(email)
    if (result.ok) setView((v) => ({ ...v, hasEmail: true }))
    return result
  }, [])

  // Ended chat: forget it so the composer starts a new one. The next /start
  // replaces the cookie server-side.
  const startNew = useCallback(() => {
    known.current = new Set()
    lastId.current = 0
    firstLoad.current = true
    existsRef.current = false
    closedRef.current = false
    setMessages([])
    setView(NO_VIEW)
    setExists(false)
    setNotice(null)
  }, [])

  return {
    exists,
    loaded,
    view,
    messages,
    unread,
    offline,
    notice,
    sending,
    status,
    start,
    send,
    saveEmail,
    startNew,
    refreshStatus,
  }
}

export type ChatApi = ReturnType<typeof useChat>
