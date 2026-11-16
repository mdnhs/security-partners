import { act, renderHook } from "@testing-library/react"
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getConversation, sendMessage, startChat } from "@/components/chat/api"
import { useChat } from "@/components/chat/use-chat"
import type { ChatSender, VisitorView } from "@/lib/schemas/api/chat"

const BASE = "/api/v1/public/chat"
const CONVERSATION = `${BASE}/conversation`

const msg = (id: number, sender: ChatSender = "visitor") => ({
  id,
  sender,
  senderName: null,
  body: `m${id}`,
  createdAt: "2026-11-15T10:00:00Z",
})
const view = (
  ids: number[],
  extra: Partial<VisitorView> = {}
): VisitorView => ({
  id: "c1",
  status: "open",
  botActive: true,
  needsHuman: false,
  hasEmail: false,
  agentName: null,
  messages: ids.map((i) => msg(i)),
  lastId: ids.at(-1) ?? 0,
  ...extra,
})

const STATUS = { online: false, botActive: true, turnstileSiteKey: null }

let hidden = false
let responses: (() => Response)[] = []
let urls: string[] = []
let statusCalls = 0
const json =
  (status: number, body: unknown, headers?: Record<string, string>) => () =>
    new Response(JSON.stringify(body), { status, headers })

beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  urls = []
  responses = []
  statusCalls = 0
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  })
  // /status answers on its own so the conversation calls stay countable.
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input)
    if (url === `${BASE}/status`) {
      statusCalls += 1
      return json(200, STATUS)()
    }
    urls.push(url)
    const next = responses.shift()
    if (!next) throw new TypeError("network")
    return next()
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

describe("useChat polling", () => {
  it("restores on mount and treats a 404 as no chat, with no further polls", async () => {
    responses = [json(404, { error: { code: "NOT_FOUND" } })]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    expect(urls).toEqual([CONVERSATION])
    expect(result.current.exists).toBe(false)
    expect(result.current.loaded).toBe(true)
    await tick(60_000)
    expect(urls).toHaveLength(1)
  })

  it("reads the status on mount and again on refreshStatus", async () => {
    responses = [json(404, {})]
    const { result } = renderHook(() => useChat({ open: false }))
    await flush()
    expect(statusCalls).toBe(1)
    expect(result.current.status).toEqual(STATUS)
    act(() => result.current.refreshStatus())
    await flush()
    expect(statusCalls).toBe(2)
  })

  it("sends after=<lastId> and merges without duplicates", async () => {
    responses = [json(200, view([1, 2])), json(200, view([2, 3]))]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    expect(result.current.exists).toBe(true)
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2])
    await tick(3000)
    expect(urls[1]).toBe(`${CONVERSATION}?after=2`)
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2, 3])
  })

  it("pauses while hidden and polls at once when visible again", async () => {
    responses = [json(200, view([1])), json(200, view([1]))]
    renderHook(() => useChat({ open: true }))
    await flush()
    hidden = true
    await tick(30_000)
    expect(urls).toHaveLength(1)
    hidden = false
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })
    await flush()
    expect(urls).toHaveLength(2)
  })

  it("polls every 20 s while closed and every 3 s while open", async () => {
    responses = Array.from({ length: 6 }, () => json(200, view([1])))
    const { rerender } = renderHook(({ open }) => useChat({ open }), {
      initialProps: { open: false },
    })
    await flush()
    await tick(19_999)
    expect(urls).toHaveLength(1)
    await tick(1)
    expect(urls).toHaveLength(2)
    rerender({ open: true })
    await flush()
    const n = urls.length
    await tick(2999)
    expect(urls).toHaveLength(n)
    await tick(1)
    expect(urls).toHaveLength(n + 1)
  })

  it("backs off 3, 6, 12, 24, 30 s on network errors and shows offline", async () => {
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    expect(urls).toHaveLength(1)
    expect(result.current.offline).toBe(true)
    for (const [i, gap] of [
      3000, 6000, 12_000, 24_000, 30_000, 30_000,
    ].entries()) {
      await tick(gap - 1)
      expect(urls).toHaveLength(i + 1)
      await tick(1)
      expect(urls).toHaveLength(i + 2)
    }
    responses = [json(200, view([1]))]
    await tick(30_000)
    expect(result.current.offline).toBe(false)
    expect(result.current.exists).toBe(true)
  })

  it("treats a 5xx like a network error", async () => {
    responses = [json(503, {})]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    expect(result.current.offline).toBe(true)
  })

  it("marks unread only for new non-visitor messages while closed", async () => {
    responses = [
      // First load: an old staff reply is not unread.
      json(200, { ...view([]), messages: [msg(1, "staff")], lastId: 1 }),
      json(200, { ...view([]), messages: [msg(2, "visitor")], lastId: 2 }),
      json(200, { ...view([]), messages: [msg(3, "ai")], lastId: 3 }),
    ]
    const { result, rerender } = renderHook(({ open }) => useChat({ open }), {
      initialProps: { open: false },
    })
    await flush()
    expect(result.current.unread).toBe(false)
    await tick(20_000)
    expect(result.current.unread).toBe(false)
    await tick(20_000)
    expect(result.current.unread).toBe(true)
    rerender({ open: true })
    await flush()
    expect(result.current.unread).toBe(false)
  })

  it("does not mark unread while open", async () => {
    responses = [
      json(200, view([1])),
      json(200, { ...view([]), messages: [msg(2, "staff")], lastId: 2 }),
    ]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    await tick(3000)
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2])
    expect(result.current.unread).toBe(false)
  })

  // Task 8 review: unread was cleared during the opening render but openRef
  // only followed in a passive effect, so a poll landing in between marked
  // the open panel unread. Runs outside act so React schedules the render and
  // its effects as separate tasks, the way a browser does.
  it("a poll landing between the opening render and its effects is not unread", async () => {
    const realImmediate = (await import("node:timers")).setImmediate
    const macrotask = () => new Promise<void>((r) => realImmediate(r))
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    let n = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/status")) return json(200, STATUS)()
      n += 1
      if (n === 1) return json(200, view([1]))()
      await gate
      return json(200, {
        ...view([]),
        messages: [msg(2, "staff")],
        lastId: 2,
      })()
    })
    let setOpen!: (open: boolean) => void
    let renders = 0
    const { result } = renderHook(() => {
      const [open, set] = useState(false)
      setOpen = set
      renders++
      return useChat({ open })
    })
    await flush()
    await tick(20_000) // the second poll now waits on the gate
    const actEnv = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    actEnv.IS_REACT_ACT_ENVIRONMENT = false
    try {
      setOpen(true) // a default-lane update: render, then effects later
      // Step one task at a time until the opening render has run: its
      // passive effects come in a later task.
      const before = renders
      for (let i = 0; renders === before && i < 50; i++) await macrotask()
      expect(renders).toBeGreaterThan(before)
      release()
      for (let i = 0; i < 5; i++) await Promise.resolve()
      for (let i = 0; i < 5; i++) await macrotask()
    } finally {
      actEnv.IS_REACT_ACT_ENVIRONMENT = true
    }
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2])
    expect(result.current.unread).toBe(false)
  })

  it("stops polling once the chat is closed", async () => {
    responses = [json(200, view([1], { status: "closed" }))]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    expect(result.current.view.status).toBe("closed")
    await tick(60_000)
    expect(urls).toHaveLength(1)
  })

  it("runs a poll requested while one is in flight right after it", async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    let n = 0
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/status")) return json(200, STATUS)()
      urls.push(url)
      n += 1
      if (n === 1) {
        await gate
        return json(200, view([1]))()
      }
      if (url.endsWith("/messages")) return json(201, { ok: true, id: 2 })()
      return json(200, view([1, 2]))()
    })
    const { result } = renderHook(() => useChat({ open: true }))
    await flush() // the first poll now waits on the gate
    await act(async () => {
      await result.current.send("hello")
    })
    release()
    await flush()
    expect(urls.filter((u) => u.includes("/conversation"))).toHaveLength(2)
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2])
  })
})

describe("useChat actions", () => {
  it("start shows the new chat and polls it", async () => {
    responses = [json(404, {}), json(201, view([1])), json(200, view([1, 2]))]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.start({ message: "hi" })
    })
    expect(outcome).toMatchObject({ ok: true })
    expect(result.current.exists).toBe(true)
    expect(result.current.messages.map((m) => m.id)).toEqual([1])
    await tick(3000)
    expect(result.current.messages.map((m) => m.id)).toEqual([1, 2])
  })

  it("start through the honeypot answer creates no chat", async () => {
    responses = [json(404, {}), json(201, { ok: true })]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    await act(async () => {
      await result.current.start({ message: "hi" })
    })
    expect(result.current.exists).toBe(false)
  })

  it("flags sending while a message is on its way", async () => {
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    responses = [json(200, view([1]))]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/messages")) {
        await gate
        return json(201, { ok: true, id: 2 })()
      }
      return json(200, view([1, 2]))()
    })
    let sent!: Promise<boolean>
    act(() => {
      sent = result.current.send("hello")
    })
    expect(result.current.sending).toBe(true)
    release()
    await act(async () => {
      expect(await sent).toBe(true)
    })
    expect(result.current.sending).toBe(false)
  })

  it("maps send failures to notices, never to server text", async () => {
    responses = [
      json(200, view([1])),
      json(429, { error: { message: "Too many" } }, { "Retry-After": "30" }),
    ]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    await act(async () => {
      expect(await result.current.send("a")).toBe(false)
    })
    expect(result.current.notice).toBe("rate")

    responses = [json(409, { error: { message: "This chat has ended" } })]
    await act(async () => {
      expect(await result.current.send("b")).toBe(false)
    })
    expect(result.current.notice).toBe("ended")
    expect(result.current.view.status).toBe("closed")
  })

  it("a network failure on send shows the offline notice", async () => {
    responses = [json(200, view([1]))]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    await act(async () => {
      expect(await result.current.send("a")).toBe(false)
    })
    expect(result.current.notice).toBe("offline")
  })

  it("saveEmail marks the email as saved", async () => {
    responses = [json(200, view([1])), json(200, { ok: true })]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    await act(async () => {
      await result.current.saveEmail("a@b.ie")
    })
    expect(result.current.view.hasEmail).toBe(true)
  })

  it("startNew forgets the ended chat", async () => {
    responses = [json(200, view([1], { status: "closed" }))]
    const { result } = renderHook(() => useChat({ open: true }))
    await flush()
    act(() => result.current.startNew())
    expect(result.current.exists).toBe(false)
    expect(result.current.messages).toEqual([])
    expect(result.current.view.status).toBe("open")
  })
})

describe("chat api", () => {
  const answer = (res: () => Response) => {
    responses = [res]
  }

  it("maps statuses to failure kinds", async () => {
    answer(json(404, {}))
    expect(await getConversation(0)).toEqual({ ok: false, kind: "notfound" })
    answer(json(409, { error: { message: "This chat has ended" } }))
    expect(await sendMessage("x")).toEqual({ ok: false, kind: "ended" })
    answer(json(429, {}))
    expect(await sendMessage("x")).toEqual({ ok: false, kind: "rate" })
    answer(json(500, {}))
    expect(await getConversation(0)).toEqual({ ok: false, kind: "network" })
    expect(await getConversation(0)).toEqual({ ok: false, kind: "network" })
    answer(json(403, {}))
    expect(await getConversation(0)).toEqual({ ok: false, kind: "other" })
  })

  it("reads fieldErrors from the CP error envelope on 400 and 422", async () => {
    const fieldErrors = { turnstileToken: ["Spam check failed"] }
    answer(json(422, { error: { code: "VALIDATION_FAILED", fieldErrors } }))
    expect(await startChat({ message: "hi" })).toEqual({
      ok: false,
      kind: "invalid",
      fieldErrors,
    })
    answer(json(400, { error: { code: "VALIDATION_FAILED" } }))
    expect(await startChat({ message: "hi" })).toEqual({
      ok: false,
      kind: "invalid",
      fieldErrors: {},
    })
  })

  // Task 8 review: a hung request must not stall polling. Every call gets a
  // 10 s timeout signal, and an abort reads as a network failure.
  it("gives every request a 10 s timeout and maps the abort to network", async () => {
    const controller = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal)
    vi.mocked(fetch).mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "TimeoutError"))
          )
        })
    )
    const pending = getConversation(0)
    expect(timeout).toHaveBeenCalledWith(10_000)
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[1]?.signal).toBe(
      controller.signal
    )
    controller.abort()
    expect(await pending).toEqual({ ok: false, kind: "network" })
  })

  it("posts JSON to the public endpoint", async () => {
    answer(json(201, { ok: true, id: 3 }))
    expect(await sendMessage("hello")).toEqual({
      ok: true,
      data: { ok: true, id: 3 },
    })
    const [url, init] = vi.mocked(fetch).mock.calls.at(-1)!
    expect(url).toBe(`${BASE}/messages`)
    expect(init).toMatchObject({
      method: "POST",
      body: JSON.stringify({ body: "hello" }),
      credentials: "same-origin",
      cache: "no-store",
    })
  })
})
