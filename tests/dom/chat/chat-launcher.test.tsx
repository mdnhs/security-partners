import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect, useState, type ComponentType } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import type { ChatSender, VisitorView } from "@/lib/schemas/api/chat"
import { chatLauncherProps } from "@/lib/chat/text"

import { stubMedia } from "./test-media"

// Port of JW features/chat/chat-launcher.test.tsx and chat-widget.test.tsx
// onto CP's settings copy. The panel is a stand-in unless a test asks for
// the real one (`panel.real`).

const panel = vi.hoisted(() => ({ real: false, loaded: vi.fn() }))

// next/dynamic stand-in: runs the loader when the component first renders.
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: ComponentType<never> }>) =>
    function Dynamic(props: Record<string, unknown>) {
      const [C, setC] = useState<ComponentType<Record<string, unknown>> | null>(
        null
      )
      useEffect(() => {
        void loader().then((m) =>
          setC(() => m.default as ComponentType<Record<string, unknown>>)
        )
      }, [])
      return C ? <C {...props} /> : null
    },
}))
vi.mock("@/components/chat/chat-panel", async (importActual) => {
  panel.loaded()
  const actual =
    await importActual<typeof import("@/components/chat/chat-panel")>()
  function Stub({
    open,
    preset,
    onClose,
    onClosed,
  }: {
    open: boolean
    preset: { text: string } | null
    onClose(): void
    onClosed(): void
  }) {
    useEffect(() => {
      if (!open) onClosed()
    }, [open, onClosed])
    return (
      <div role="dialog" aria-label="panel">
        <p data-testid="preset">{preset?.text ?? ""}</p>
        <button type="button" onClick={onClose}>
          stub-close
        </button>
      </div>
    )
  }
  function Panel(props: Parameters<typeof actual.ChatPanel>[0]) {
    return panel.real ? <actual.ChatPanel {...props} /> : <Stub {...props} />
  }
  return { ...actual, ChatPanel: Panel, default: Panel }
})
vi.mock("@/components/home/use-turnstile", () => ({
  useTurnstile: () => ({
    prepare: async () => null,
    getToken: async () => "tok",
    reset: () => {},
  }),
}))

import { ChatLauncher } from "@/components/chat/chat-launcher"

const PROPS = chatLauncherProps(CHAT_SETTINGS_DEFAULT)
const { copy, hint: HINT } = PROPS
const BASE = "/api/v1/public/chat"

const msg = (id: number, sender: ChatSender) => ({
  id,
  sender,
  senderName: null,
  body: `m${id}`,
  createdAt: "2026-11-15T10:00:00Z",
})
const view = (messages: ReturnType<typeof msg>[]): VisitorView => ({
  id: "c1",
  status: "open",
  botActive: true,
  needsHuman: false,
  hasEmail: false,
  agentName: null,
  messages,
  lastId: messages.at(-1)?.id ?? 0,
})

let online = false
let conversations: { status: number; body: unknown }[] = []
beforeEach(() => {
  stubMedia(true)
  online = false
  conversations = []
  panel.real = false
  panel.loaded.mockClear()
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input)
    if (url === `${BASE}/status`)
      return new Response(
        JSON.stringify({ online, botActive: true, turnstileSiteKey: null }),
        { status: 200 }
      )
    const next = conversations.shift() ?? { status: 404, body: {} }
    return new Response(JSON.stringify(next.body), { status: next.status })
  })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.documentElement.style.removeProperty("--sticky-cta-h")
})

const settle = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {})
}
const launcher = () =>
  screen.getByRole("button", {
    name: new RegExp(`^(${copy.launcherOpen}|${copy.close})`),
  })
const hint = () => screen.queryByRole("group", { name: copy.hintGroup })
const closeStub = () => fireEvent.click(screen.getByText("stub-close"))

describe("ChatLauncher", () => {
  it("renders nothing before mount, then a button labelled copy.launcherOpen", async () => {
    expect(renderToString(<ChatLauncher {...PROPS} />)).toBe("")
    render(<ChatLauncher {...PROPS} />)
    await settle()
    const button = screen.getByRole("button", { name: copy.launcherOpen })
    expect(button).toHaveAttribute("aria-expanded", "false")
    expect(button).toHaveAttribute("aria-haspopup", "dialog")
    expect(button).toHaveClass("bg-brand-green", "size-14")
  })

  it("bottom style uses --sticky-cta-h", async () => {
    render(<ChatLauncher {...PROPS} />)
    await settle()
    const style = launcher().parentElement!.getAttribute("style")
    expect(style).toContain("var(--sticky-cta-h, 0px)")
    expect(style).toContain("safe-area-inset-bottom")
  })

  it("loads the panel only on the first open, and toggles it closed", async () => {
    render(<ChatLauncher {...PROPS} />)
    await settle()
    expect(panel.loaded).not.toHaveBeenCalled()
    fireEvent.click(launcher())
    await settle()
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(panel.loaded).toHaveBeenCalledTimes(1)
    expect(launcher()).toHaveAttribute("aria-expanded", "true")
    expect(launcher()).toHaveAttribute("aria-label", copy.close)
    fireEvent.click(launcher())
    await settle()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("a preset opens the panel and hands it the preset", async () => {
    render(<ChatLauncher {...PROPS} />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: HINT.title }))
    const preset = HINT.presets[1]!
    fireEvent.click(screen.getByRole("button", { name: preset.label }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByTestId("preset").textContent).toBe(preset.message)
  })

  it("the launcher reopens the panel without the last preset", async () => {
    render(<ChatLauncher {...PROPS} />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: HINT.title }))
    const preset = HINT.presets[1]!
    fireEvent.click(screen.getByRole("button", { name: preset.label }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    closeStub()
    await settle()
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(launcher())
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(screen.getByTestId("preset").textContent).toBe("")
  })

  it("shows the online dot when the team is online", async () => {
    online = true
    render(<ChatLauncher {...PROPS} />)
    await settle()
    expect(hint()!.querySelector("[data-online-dot]")).not.toBeNull()
    expect(launcher().querySelector(".bg-emerald-500")).not.toBeNull()
  })

  it("opening hides the hint; closing brings it back without replaying the entrance", async () => {
    stubMedia(false)
    render(<ChatLauncher {...PROPS} />)
    await settle()
    const rise = () => hint()!.querySelector<HTMLElement>("[data-hint-rise]")!
    // The entrance starts below the mask, then finishes and clears.
    expect(rise().style.transform).toContain("translate")
    await waitFor(() => expect(rise().style.transform).toBe(""), {
      timeout: 4000,
    })
    fireEvent.click(launcher())
    await settle()
    expect(hint()).toBeNull()
    closeStub()
    await settle()
    expect(hint()).not.toBeNull()
    expect(rise().style.transform).toBe("")
  })

  it("dismissing the hint lasts for this mount only", async () => {
    const first = render(<ChatLauncher {...PROPS} />)
    await settle()
    fireEvent.click(screen.getByRole("button", { name: copy.hintDismiss }))
    await settle()
    expect(hint()).toBeNull()
    fireEvent.click(launcher())
    await settle()
    closeStub()
    await settle()
    expect(hint()).toBeNull()
    first.unmount()
    render(<ChatLauncher {...PROPS} />)
    await settle()
    expect(hint()).not.toBeNull()
  })

  it("focus returns to the launcher on close", async () => {
    panel.real = true
    render(<ChatLauncher {...PROPS} />)
    await settle()
    const button = launcher()
    fireEvent.click(button)
    await settle()
    const dialog = await screen.findByRole("dialog")
    expect(button).not.toHaveFocus()
    fireEvent.keyDown(dialog, { key: "Escape" })
    await settle()
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(button).toHaveFocus()
  })

  it("unread dot and label when a reply arrives while closed", async () => {
    vi.useFakeTimers()
    conversations = [
      { status: 200, body: view([msg(1, "visitor")]) },
      { status: 200, body: view([msg(2, "staff")]) },
    ]
    render(<ChatLauncher {...PROPS} />)
    await settle()
    expect(launcher()).toHaveAttribute("aria-label", copy.launcherOpen)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    const button = screen.getByRole("button", {
      name: copy.launcherOpenUnread,
    })
    expect(button.querySelector(".bg-star")).not.toBeNull()
  })
})
