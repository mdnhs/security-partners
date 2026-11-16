import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { StrictMode, useRef } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import ChatPanel from "@/components/chat/chat-panel"
import { useChat } from "@/components/chat/use-chat"
import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { chatLauncherProps, type ChatWidgetProps } from "@/lib/chat/text"
import {
  type ChatSender,
  type ChatStatus,
  StartChatInput,
  type VisitorView,
} from "@/lib/schemas/api/chat"

import { stubMedia } from "./test-media"

// Port of JW features/chat/chat-panel.test.tsx onto CP's hook, copy props and
// invisible Turnstile.

// Turnstile stand-in: a token at once, and a record of resets.
const turnstile = vi.hoisted(() => ({
  prepare: vi.fn(async () => null),
  getToken: vi.fn(async (): Promise<string | null> => "tok"),
  reset: vi.fn(),
}))
vi.mock("@/components/home/use-turnstile", () => ({
  useTurnstile: () => turnstile,
}))

const BASE = "/api/v1/public/chat"
const PROPS = chatLauncherProps(CHAT_SETTINGS_DEFAULT)
const { copy } = PROPS
const TEAM = PROPS.team
const BOT = PROPS.botName

type M = VisitorView["messages"][number]
const msg = (
  id: number,
  sender: ChatSender,
  senderName: string | null = null,
  body = `body${id}`
): M => ({ id, sender, senderName, body, createdAt: "2026-11-15T10:00:00Z" })
const view = (
  messages: M[],
  extra: Partial<VisitorView> = {}
): VisitorView => ({
  id: "c1",
  status: "open",
  botActive: true,
  needsHuman: false,
  hasEmail: false,
  agentName: null,
  messages,
  lastId: messages.at(-1)?.id ?? 0,
  ...extra,
})

const STATUS: ChatStatus = {
  online: false,
  botActive: true,
  turnstileSiteKey: null,
}
let status: ChatStatus = STATUS
let queue: { status: number; body: unknown }[] = []
let gate: Promise<void> | null = null
let posts: { url: string; body: Record<string, unknown> }[] = []
const onClose = vi.fn()
const onClosed = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  stubMedia(true)
  status = STATUS
  queue = []
  gate = null
  posts = []
  onClose.mockClear()
  onClosed.mockClear()
  turnstile.getToken.mockReset().mockResolvedValue("tok")
  turnstile.reset.mockReset()
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
    if (url === `${BASE}/status`)
      return new Response(JSON.stringify(status), { status: 200 })
    if (init?.method === "POST")
      posts.push({ url, body: JSON.parse(String(init.body)) })
    else if (gate) await gate
    const next = queue.shift() ?? { status: 404, body: {} }
    return new Response(JSON.stringify(next.body), { status: next.status })
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function Harness({
  open = true,
  preset = null,
  props = PROPS,
}: {
  open?: boolean
  preset?: { id: number; text: string } | null
  props?: ChatWidgetProps
}) {
  const chat = useChat({ open })
  const launcherRef = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={launcherRef} type="button" data-testid="launcher" />
      <ChatPanel
        open={open}
        onClose={onClose}
        onClosed={onClosed}
        preset={preset}
        props={props}
        chat={chat}
        launcherRef={launcherRef}
      />
    </>
  )
}

const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
const composer = () =>
  screen.getByRole("textbox", {
    name: copy.messageLabel,
  }) as HTMLTextAreaElement
const type = (text: string) =>
  fireEvent.change(composer(), { target: { value: text } })
const sendButton = () => screen.getByRole("button", { name: copy.send })
const fill = (text: string) =>
  text.replaceAll("{team}", TEAM).replaceAll("{botName}", BOT)

describe("ChatPanel", () => {
  it("first message starts the chat and shows it", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    render(<Harness />)
    await flush()
    // No start form: the welcome, the consent line and the composer.
    expect(screen.getByText(copy.welcome)).toBeTruthy()
    expect(screen.queryByRole("checkbox")).toBeNull()
    expect(
      screen.getByText(fill(copy.consentBot), { exact: false })
    ).toBeTruthy()
    const policy = screen.getByRole("link", { name: copy.privacyLabel })
    expect(policy.getAttribute("href")).toBe(copy.privacyHref)
    expect(policy.getAttribute("target")).toBe("_blank")
    type("Hi there")
    fireEvent.click(sendButton())
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0]!.url).toBe(`${BASE}/start`)
    expect(posts[0]!.body).toEqual({
      message: "Hi there",
      sourcePath: "/",
      website: "",
      turnstileToken: "tok",
    })
    expect(screen.getByText("body1")).toBeTruthy()
    expect(composer().value).toBe("")
  })

  it("caps a long page path at 200 characters so the start is not rejected", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    const long = `/${"a".repeat(300)}`
    window.history.pushState({}, "", long)
    try {
      render(<Harness />)
      await flush()
      type("Hi there")
      fireEvent.click(sendButton())
      await flush()
    } finally {
      window.history.pushState({}, "", "/")
    }
    const sent = String(posts[0]!.body.sourcePath)
    expect(sent).toBe(long.slice(0, 200))
    expect(sent.startsWith("/")).toBe(true)
    expect(StartChatInput.safeParse(posts[0]!.body).success).toBe(true)
  })

  it("Enter sends, Shift+Enter does not", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai")]) },
      { status: 201, body: { ok: true, id: 2 } },
    ]
    render(<Harness />)
    await flush()
    type("More")
    fireEvent.keyDown(composer(), { key: "Enter", shiftKey: true })
    fireEvent.keyDown(composer(), { key: "Enter", isComposing: true })
    await flush()
    expect(posts).toHaveLength(0)
    expect(composer().maxLength).toBe(2000)
    fireEvent.keyDown(composer(), { key: "Enter" })
    await flush()
    expect(posts).toEqual([{ url: `${BASE}/messages`, body: { body: "More" } }])
  })

  it("a preset is sent straight away and starts the chat", async () => {
    queue = [
      { status: 404, body: {} },
      {
        status: 201,
        body: view([msg(1, "visitor", null, "Can I get a quote?")]),
      },
    ]
    render(<Harness preset={{ id: 1, text: "Can I get a quote?" }} />)
    await flush()
    await flush()
    expect(posts).toHaveLength(1)
    expect(posts[0]!.url).toBe(`${BASE}/start`)
    expect(posts[0]!.body.message).toBe("Can I get a quote?")
    expect(screen.getByText("Can I get a quote?")).toBeTruthy()
    expect(composer().value).toBe("")
  })

  it("a preset in an open chat goes as a message", async () => {
    queue = [{ status: 200, body: view([msg(1, "ai")]) }]
    const { rerender } = render(<Harness />)
    await flush()
    queue = [{ status: 201, body: { ok: true, id: 2 } }]
    rerender(<Harness preset={{ id: 1, text: "Are you insured?" }} />)
    await flush()
    await flush()
    expect(posts).toEqual([
      { url: `${BASE}/messages`, body: { body: "Are you insured?" } },
    ])
  })

  it("sends a preset once when the panel mounts under StrictMode", async () => {
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    render(
      <StrictMode>
        <Harness preset={{ id: 1, text: "Are you insured?" }} />
      </StrictMode>
    )
    await flush()
    await flush()
    expect(posts).toHaveLength(1)
  })

  it("status shows statusBot with the team name while the bot answers", async () => {
    queue = [{ status: 200, body: view([msg(1, "ai")]) }]
    render(<Harness />)
    await flush()
    expect(screen.getByText(`${BOT} (AI) · ${TEAM} can join`)).toBeTruthy()
    // AI replies carry the AI caption.
    expect(screen.getByText(`${BOT} · AI`)).toBeTruthy()
  })

  it("status names the agent, then online, then offline, and reconnecting first", async () => {
    queue = [
      {
        status: 200,
        body: view([msg(1, "staff", "Sam")], {
          agentName: "Sam",
          botActive: false,
        }),
      },
    ]
    const first = render(<Harness />)
    await flush()
    expect(screen.getByText("Chatting with Sam")).toBeTruthy()
    // A network failure on the next poll says reconnecting.
    queue = []
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline"))
    await tick(3000)
    expect(screen.getByText(copy.statusReconnecting)).toBeTruthy()
    first.unmount()

    status = { ...STATUS, botActive: false, online: true }
    const second = render(<Harness />)
    await flush()
    expect(screen.getByText(copy.statusOnline)).toBeTruthy()
    // Without the bot the consent line names only the team.
    expect(
      screen.getByText(fill(copy.consentTeam), { exact: false })
    ).toBeTruthy()
    second.unmount()

    status = { ...STATUS, botActive: false }
    render(<Harness />)
    await flush()
    expect(screen.getByText(copy.statusOffline)).toBeTruthy()
  })

  it("No thanks hides the email ask for this chat, also after a reload", async () => {
    window.localStorage.clear()
    status = { ...STATUS, botActive: false }
    const asks = () => screen.queryByRole("button", { name: copy.emailSave })
    queue = [{ status: 200, body: view([msg(1, "ai")], { botActive: false }) }]
    const first = render(<Harness />)
    await flush()
    expect(asks()).not.toBeNull()
    fireEvent.click(screen.getByRole("button", { name: copy.emailDismiss }))
    expect(asks()).toBeNull()
    expect(document.activeElement).toBe(composer())
    first.unmount()
    queue = [{ status: 200, body: view([msg(1, "ai")], { botActive: false }) }]
    render(<Harness />)
    await flush()
    expect(asks()).toBeNull()
    window.localStorage.clear()
  })

  it("the email ask appears only when nobody can answer", async () => {
    const asks = () => screen.queryByRole("button", { name: copy.emailSave })
    const cases: [Partial<VisitorView>, Partial<ChatStatus>, boolean][] = [
      [{ botActive: false }, {}, true],
      [{ botActive: false }, { online: true }, false],
      [{ botActive: true }, {}, false],
      [{ botActive: false, agentName: "Sam" }, {}, false],
      [{ botActive: false, hasEmail: true }, {}, false],
      [{ botActive: false, status: "closed" }, {}, false],
    ]
    for (const [extra, statusExtra, shown] of cases) {
      status = { ...STATUS, ...statusExtra }
      queue = [{ status: 200, body: view([msg(1, "ai")], extra) }]
      const r = render(<Harness />)
      await flush()
      expect(Boolean(asks()), JSON.stringify(extra)).toBe(shown)
      if (shown) {
        expect(screen.getByLabelText(fill(copy.offlineNote))).toBeTruthy()
        // A bad email shows the settings error in the star colour.
        queue = [{ status: 422, body: { error: { fieldErrors: {} } } }]
        fireEvent.change(screen.getByLabelText(fill(copy.offlineNote)), {
          target: { value: "a@b.ie" },
        })
        fireEvent.click(asks()!)
        await flush()
        expect(screen.getByText(copy.emailError).className).toContain(
          "text-star"
        )
      }
      r.unmount()
    }
    // Before there is a chat there is nothing to attach an email to.
    status = { ...STATUS, botActive: false }
    render(<Harness />)
    await flush()
    expect(asks()).toBeNull()
  })

  it("staff link is tappable, visitor text is not", async () => {
    queue = [
      {
        status: 200,
        body: view(
          [
            msg(1, "visitor", null, "My number is 087 123 4567"),
            msg(2, "staff", "Sam", "Call 087 123 4567 or use /contact"),
            msg(3, "system", null, "Sam joined 087 123 4567"),
          ],
          { agentName: "Sam", botActive: false }
        ),
      },
    ]
    const { container } = render(<Harness />)
    await flush()
    const staff = container.querySelector('[data-sender="staff"]')!
    expect(
      [...staff.querySelectorAll("a")].map((a) => a.getAttribute("href"))
    ).toEqual(["tel:+353871234567", "/contact"])
    expect(staff.textContent).toContain("Sam")
    expect(
      container.querySelector('[data-sender="visitor"]')!.querySelector("a")
    ).toBeNull()
    expect(
      container.querySelector('[data-sender="system"]')!.querySelector("a")
    ).toBeNull()
  })

  // Tokens are single-use: the widget that solved the first start must be
  // reset before the next chat asks it for another token.
  it("resets Turnstile after a successful start, before the next chat's token", async () => {
    const calls: string[] = []
    turnstile.getToken.mockImplementation(async () => {
      calls.push("getToken")
      return "tok"
    })
    turnstile.reset.mockImplementation(() => calls.push("reset"))
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
      { status: 409, body: { error: { code: "CONFLICT" } } },
      { status: 201, body: view([msg(5, "visitor")], { id: "c2" }) },
    ]
    render(<Harness />)
    await flush()
    type("First")
    fireEvent.click(sendButton())
    await flush()
    type("Again")
    fireEvent.click(sendButton())
    await flush()
    fireEvent.click(screen.getByRole("button", { name: copy.startNew }))
    await flush()
    type("Second chat")
    fireEvent.click(sendButton())
    await flush()
    expect(posts.map((p) => p.url)).toEqual([
      `${BASE}/start`,
      `${BASE}/messages`,
      `${BASE}/start`,
    ])
    expect(calls).toEqual(["getToken", "reset", "getToken", "reset"])
    expect(screen.getByText("body5")).toBeTruthy()
  })

  it("ended chat shows Start a new chat and focuses it", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai")]) },
      { status: 409, body: { error: { code: "CONFLICT" } } },
    ]
    render(<Harness />)
    await flush()
    type("hello")
    fireEvent.click(sendButton())
    await flush()
    expect(screen.getByRole("alert").textContent).toBe(copy.noticeEnded)
    const again = screen.getByRole("button", { name: copy.startNew })
    expect(document.activeElement).toBe(again)
    expect(again.className).toContain("bg-brand")
    expect(screen.queryByRole("textbox")).toBeNull()
    fireEvent.click(again)
    await flush()
    expect(document.activeElement).toBe(composer())
  })

  it("Escape closes and the live region announces only new non-visitor messages", async () => {
    queue = [
      { status: 200, body: view([msg(1, "ai")]) },
      {
        status: 200,
        body: view([msg(2, "visitor"), msg(3, "staff", "Sam")], {
          botActive: false,
          agentName: "Sam",
        }),
      },
    ]
    const { container } = render(<Harness />)
    await flush()
    const live = container.querySelector('[aria-live="polite"]')!
    // The history restored on open is not news.
    expect(live.textContent).toBe("")
    await tick(3000)
    expect(live.textContent).toContain("body3")
    expect(live.textContent).not.toContain("body2")
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("is a labelled modal that traps Tab and returns focus to the launcher", async () => {
    const { rerender } = render(<Harness />)
    await flush()
    const dialog = screen.getByRole("dialog")
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    const title = document.getElementById(
      dialog.getAttribute("aria-labelledby")!
    )
    expect(title?.textContent).toBe(copy.title)
    expect(title?.className).toBe("font-heading text-xl leading-6 font-bold")
    const focusables = [
      ...dialog.querySelectorAll<HTMLElement>(
        "button:not([disabled]), textarea, a[href]"
      ),
    ]
    const first = focusables[0]!
    const last = focusables.at(-1)!
    last.focus()
    fireEvent.keyDown(last, { key: "Tab" })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
    rerender(<Harness open={false} />)
    expect(document.activeElement).toBe(screen.getByTestId("launcher"))
  })

  it("queues the first message for the cookie lookup, showing connecting", async () => {
    let release!: () => void
    gate = new Promise<void>((r) => (release = r))
    queue = [
      { status: 404, body: {} },
      { status: 201, body: view([msg(1, "visitor")]) },
    ]
    render(<Harness />)
    await flush()
    type("Hello")
    fireEvent.click(sendButton())
    await flush()
    expect(posts).toHaveLength(0)
    expect(screen.getByRole("status").textContent).toBe(copy.connecting)
    release()
    await flush()
    await flush()
    expect(posts.map((p) => p.url)).toEqual([`${BASE}/start`])
    expect(screen.getByText("body1")).toBeTruthy()
  })

  it("a failed start resets Turnstile and shows the settings error", async () => {
    queue = [
      { status: 404, body: {} },
      {
        status: 422,
        body: { error: { fieldErrors: { turnstileToken: ["x"] } } },
      },
      { status: 422, body: { error: { fieldErrors: { message: ["x"] } } } },
      { status: 429, body: {} },
    ]
    render(<Harness />)
    await flush()
    type("Hello")
    fireEvent.click(sendButton())
    await flush()
    expect(turnstile.reset).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("alert").textContent).toBe(copy.errorStart)
    expect(screen.getByRole("alert").className).toContain("text-star")
    fireEvent.click(sendButton())
    await flush()
    expect(screen.getByRole("alert").textContent).toBe(copy.errorTooLong)
    fireEvent.click(sendButton())
    await flush()
    expect(screen.getByRole("alert").textContent).toBe(copy.noticeRate)
    expect(composer().value).toBe("Hello")
  })

  it("shows the typing bubble after the visitor's message, for at most 30 s", async () => {
    queue = [{ status: 200, body: view([msg(1, "ai"), msg(2, "visitor")]) }]
    render(<Harness />)
    await flush()
    expect(screen.getByRole("status").textContent).toBe(fill(copy.typing))
    for (let i = 0; i < 12; i++)
      queue.push({ status: 200, body: view([], { lastId: 2 }) })
    await tick(30_000)
    expect(screen.queryByText(fill(copy.typing))).toBeNull()
  })

  it("no hard-coded text: every visible string equals a default copy value", async () => {
    const x = (s: string) => `X-${s}`
    const prefixed: ChatWidgetProps = {
      ...PROPS,
      team: x(TEAM),
      botName: x(BOT),
      copy: Object.fromEntries(
        Object.entries(copy).map(([k, v]) => [k, x(v)])
      ) as ChatWidgetProps["copy"],
    }
    const unprefixed = (root: HTMLElement) => {
      const bad: string[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = n.textContent?.trim()
        if (text && !text.startsWith("X-")) bad.push(text)
      }
      for (const el of root.querySelectorAll("*"))
        for (const attr of ["aria-label", "placeholder", "title", "alt"]) {
          const v = el.getAttribute(attr)
          if (v && !v.startsWith("X-")) bad.push(`${attr}=${v}`)
        }
      return bad
    }
    const states: { queue: typeof queue; status?: Partial<ChatStatus> }[] = [
      // Before the first message: welcome, bot status, consent, composer.
      { queue: [{ status: 404, body: {} }] },
      // A chat nobody can answer: team status, email ask, typing is off.
      {
        queue: [
          {
            status: 200,
            body: view(
              [
                msg(1, "visitor", null, "X-hi"),
                msg(2, "ai", null, "X-reply"),
                msg(3, "system", null, "X-note"),
              ],
              { botActive: false }
            ),
          },
        ],
        status: { botActive: false },
      },
      // The bot is answering: AI caption and the typing bubble.
      {
        queue: [
          {
            status: 200,
            body: view([
              msg(1, "ai", null, "X-reply"),
              msg(2, "visitor", null, "X-hi"),
            ]),
          },
        ],
      },
      // An ended chat: the notice and Start a new chat.
      {
        queue: [
          {
            status: 200,
            body: view([msg(1, "ai", null, "X-reply")], { status: "closed" }),
          },
        ],
      },
    ]
    for (const state of states) {
      queue = state.queue
      status = { ...STATUS, ...state.status }
      const r = render(<Harness props={prefixed} />)
      await flush()
      expect(unprefixed(screen.getByRole("dialog"))).toEqual([])
      r.unmount()
    }
  })
})

describe("ChatPanel motion", () => {
  it("with reduced motion the panel is visible at once and closes at once", async () => {
    const { rerender } = render(<Harness />)
    await flush()
    const dialog = screen.getByRole("dialog")
    expect(dialog.style.opacity).toBe("")
    expect(dialog.style.transform).toBe("")
    rerender(<Harness open={false} />)
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(dialog.hasAttribute("inert")).toBe(true)
  })

  it("without reduced motion the panel animates in from hidden", () => {
    stubMedia(false)
    render(<Harness />)
    expect(screen.getByRole("dialog").style.opacity).toBe("0")
  })

  it("plays the open animation to the end under StrictMode", async () => {
    vi.useRealTimers()
    stubMedia(false)
    render(
      <StrictMode>
        <Harness />
      </StrictMode>
    )
    const dialog = screen.getByRole("dialog")
    await waitFor(() => expect(dialog.style.opacity).toBe("1"), {
      timeout: 2000,
    })
    expect(dialog.style.transform).not.toContain("0.72")
  })

  it("uses the glass card classes with the sticky CTA offset", async () => {
    render(<Harness />)
    await flush()
    const dialog = screen.getByRole("dialog")
    expect(dialog.className).toBe(
      "fixed inset-0 z-80 flex h-svh w-full flex-col overflow-hidden bg-brand-navy/72 text-white shadow-[0_24px_60px_-18px_rgb(0_0_0/0.6)] backdrop-blur-xl backdrop-saturate-150 outline-none sm:inset-auto sm:right-6 sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.75rem+var(--sticky-cta-h,0px))] sm:h-[min(560px,calc(100svh-7rem))] sm:w-95 sm:rounded-3xl"
    )
    expect(composer().hasAttribute("data-lenis-prevent")).toBe(true)
    expect(
      dialog
        .querySelector('[role="log"]')!
        .parentElement!.hasAttribute("data-lenis-prevent")
    ).toBe(true)
  })
})
