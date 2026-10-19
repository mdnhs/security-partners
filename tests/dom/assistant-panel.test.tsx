import { QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("sonner", () => ({ toast }))

import { AssistantButton } from "@/components/admin/ai/assistant-button"
import {
  AssistantProvider,
  useAssistantScreen,
} from "@/components/admin/ai/assistant-context"
import { AI_STATUS_KEY } from "@/components/admin/ai/queries"
import { makeQueryClient } from "@/components/admin/providers"
import type { AiStatusDto } from "@/lib/schemas/api/ai"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  })
const ndjson = (...events: unknown[]) =>
  new Response(events.map((e) => `${JSON.stringify(e)}\n`).join(""), {
    status: 200,
    headers: { "content-type": "application/x-ndjson" },
  })
const reply = (text: string, conversationId = "c1") =>
  ndjson(
    { type: "start", conversationId },
    { type: "text", text },
    { type: "done", messageId: `m-${text.length}` }
  )

const ON: AiStatusDto = {
  available: true,
  canManage: false,
  reason: null,
  model: "claude-sonnet-5-5",
  readOnly: false,
}

type Call = { method: string; path: string; body: unknown }
let calls: Call[]
let routes: Record<string, (init?: RequestInit) => Response | Promise<Response>>

beforeEach(() => {
  calls = []
  toast.success.mockClear()
  routes = {
    "POST /api/v1/admin/ai/chat": () =>
      ndjson(
        { type: "start", conversationId: "c1" },
        { type: "text", text: "Hello " },
        { type: "text", text: "world" },
        { type: "done", messageId: "m2" }
      ),
    "GET /api/v1/admin/ai/conversations": () =>
      json({ items: [], page: 1, pageSize: 20, total: 0 }),
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      calls.push({
        method,
        path: url.pathname,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      })
      const route = routes[`${method} ${url.pathname}`]
      return route
        ? route(init)
        : json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404)
    })
  )
})

const apply = vi.fn<(text: string) => boolean | void>()

/** Per-test overrides of the stand-in's focused field (fix round 1). */
let standIn: { maxLength: number | null; multiline: boolean; hidden: boolean }

beforeEach(() => {
  apply.mockReset()
  toast.error.mockClear()
  standIn = { maxLength: 80, multiline: false, hidden: false }
})

/** Stands in for an editor: shares a record and reports a focused field. */
function EditorStandIn() {
  const { setField } = useAssistantScreen({
    title: "Home page",
    entityType: "page",
    entityId: "home",
    record: { hero: { heading: "Old" } },
  })
  const input = (
    <input
      id="probe-heading"
      aria-label="Heading"
      onFocus={() =>
        setField({
          path: "hero.heading",
          label: "Heading",
          maxLength: standIn.maxLength,
          multiline: standIn.multiline,
          elementId: "probe-heading",
          read: () => "Old",
          apply,
        })
      }
    />
  )
  // A field in a section tab that is not selected: rendered, but hidden.
  return standIn.hidden ? <div data-testid="tab">{input}</div> : input
}

function renderAssistant(
  // null = no status from the layout (a default parameter would turn an
  // explicit undefined into ON).
  status: AiStatusDto | null = ON,
  { editor = true } = {}
) {
  const client = makeQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <AssistantProvider>
        <AssistantButton initialStatus={status ?? undefined} />
        {editor ? <EditorStandIn /> : null}
      </AssistantProvider>
    </QueryClientProvider>
  )
  return { client, ...view }
}

const chatBodies = () =>
  calls
    .filter((c) => c.method === "POST" && c.path === "/api/v1/admin/ai/chat")
    .map((c) => c.body)

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "AI assistant" }))
  return screen.findByRole("dialog", { name: "AI assistant" })
}

async function sendMessage(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  text: string
) {
  await within(dialog).findByRole("button", { name: "Send" })
  await user.type(
    within(dialog).getByRole("textbox", { name: "Message the AI assistant" }),
    `${text}{Enter}`
  )
}

describe("AssistantButton (master 9.2: hidden when disabled)", () => {
  it("renders nothing while off, not allowed or unknown, and asks nothing", () => {
    renderAssistant({
      available: false,
      canManage: false,
      reason: "off",
      model: null,
      readOnly: false,
    })
    expect(screen.queryByRole("button", { name: "AI assistant" })).toBeNull()
    renderAssistant(null)
    expect(screen.queryByRole("button", { name: "AI assistant" })).toBeNull()
    expect(calls).toEqual([])
  })

  it("shows managers the button while unavailable, with a set-up link (MK C7)", async () => {
    const user = userEvent.setup()
    renderAssistant({
      available: false,
      canManage: true,
      reason: "unconfigured",
      model: null,
      readOnly: false,
    })
    const dialog = await openPanel(user)
    expect(
      within(dialog).getByText(
        "The AI assistant is turned off or not set up yet."
      )
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("link", { name: "Set up AI assistant" })
    ).toHaveAttribute("href", "/admin/settings/ai-assistant")
    expect(
      within(dialog).queryByRole("textbox", {
        name: "Message the AI assistant",
      })
    ).toBeNull()
    // Nothing is asked of the server for an unavailable assistant.
    expect(calls).toEqual([])
  })

  it("hides itself when Settings turns the assistant off", async () => {
    const { client } = renderAssistant()
    expect(
      screen.getByRole("button", { name: "AI assistant" })
    ).toBeInTheDocument()
    expect(calls).toEqual([])
    routes["GET /api/v1/admin/ai/status"] = () =>
      json({ available: false, model: null, readOnly: false })
    await act(() => client.invalidateQueries({ queryKey: AI_STATUS_KEY }))
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "AI assistant" })).toBeNull()
    )
  })

  it("opens from the button and with Ctrl+J; shows the model; focuses the box", async () => {
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    expect(within(dialog).getByText("claude-sonnet-5-5")).toBeInTheDocument()
    await waitFor(() =>
      expect(
        within(dialog).getByRole("textbox", {
          name: "Message the AI assistant",
        })
      ).toHaveFocus()
    )
    await user.click(within(dialog).getByRole("button", { name: "Close" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("button", { name: "AI assistant" })).toHaveFocus()
    await user.keyboard("{Control>}j{/Control}")
    expect(
      await screen.findByRole("dialog", { name: "AI assistant" })
    ).toBeInTheDocument()
  })
})

describe("AssistantPanel (master 9.2: context of the current record; Insert)", () => {
  it("sends the current record and field with the message and streams the reply", async () => {
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByLabelText("Heading"))
    const dialog = await openPanel(user)
    expect(within(dialog).getByText(/Using:/)).toHaveTextContent(
      "Using: Home page · field Heading"
    )
    await sendMessage(user, dialog, "Make it shorter")
    expect(await within(dialog).findByText("Hello world")).toBeInTheDocument()
    expect(within(dialog).getByText("Make it shorter")).toBeInTheDocument()
    expect(chatBodies()).toEqual([
      {
        message: "Make it shorter",
        context: {
          screen: "Home page",
          entityType: "page",
          entityId: "home",
          field: {
            path: "hero.heading",
            label: "Heading",
            value: "Old",
            maxLength: 80,
          },
          record: { hero: { heading: "Old" } },
        },
      },
    ])
  })

  it("Insert applies the suggestion to the focused field and closes the panel", async () => {
    routes["POST /api/v1/admin/ai/chat"] = () => reply("“Safer nights”")
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByLabelText("Heading"))
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Rewrite it")
    await user.click(
      await within(dialog).findByRole("button", { name: "Insert into Heading" })
    )
    expect(apply).toHaveBeenCalledWith("Safer nights")
    expect(toast.success).toHaveBeenCalledWith(
      "Inserted into “Heading”",
      expect.anything()
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByLabelText("Heading")).toHaveFocus()
  })

  it("offers Copy but no Insert when no text field is focused", async () => {
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    expect(within(dialog).queryByText(/Using:/)).toBeNull()
    await sendMessage(user, dialog, "Draft an intro")
    await within(dialog).findByText("Hello world")
    expect(
      within(dialog).getByRole("button", { name: "Copy" })
    ).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: /Insert/ })).toBeNull()
    expect(chatBodies()).toEqual([{ message: "Draft an intro" }])
  })

  it("the context chip can be left out of one message", async () => {
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    await user.click(
      within(dialog).getByRole("button", {
        name: "Don't send Home page with the next message",
      })
    )
    expect(within(dialog).queryByText(/Using:/)).toBeNull()
    await sendMessage(user, dialog, "Hi")
    await within(dialog).findByText("Hello world")
    expect(chatBodies()).toEqual([{ message: "Hi" }])
    expect(within(dialog).getByText(/Using:/)).toBeInTheDocument()
  })

  it("continues the conversation; New chat starts over", async () => {
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "One")
    await within(dialog).findByText("Hello world")
    await sendMessage(user, dialog, "Two")
    await waitFor(() => expect(chatBodies()).toHaveLength(2))
    expect(chatBodies()[1]).toEqual({ conversationId: "c1", message: "Two" })
    await within(dialog).findByRole("button", { name: "Send" })
    await user.click(within(dialog).getByRole("button", { name: "New chat" }))
    expect(within(dialog).queryByText("Hello world")).toBeNull()
    await sendMessage(user, dialog, "Three")
    await waitFor(() => expect(chatBodies()).toHaveLength(3))
    expect(chatBodies()[2]).toEqual({ message: "Three" })
  })

  it("shows HTTP errors and streamed provider errors as alerts", async () => {
    routes["POST /api/v1/admin/ai/chat"] = () =>
      json(
        {
          error: {
            code: "RATE_LIMITED",
            message:
              "You have sent a lot of messages. Wait a few minutes, then try again.",
          },
        },
        429
      )
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Hi")
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "You have sent a lot of messages."
    )
    routes["POST /api/v1/admin/ai/chat"] = () =>
      ndjson(
        { type: "start", conversationId: "c1" },
        { type: "error", message: "The AI provider rejected the API key." }
      )
    await sendMessage(user, dialog, "Again")
    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "The AI provider rejected the API key."
      )
    )
    expect(within(dialog).queryByRole("button", { name: "Copy" })).toBeNull()
  })

  it("is read-only while viewing the admin as someone else", async () => {
    const user = userEvent.setup()
    renderAssistant({ ...ON, readOnly: true })
    await user.click(screen.getByLabelText("Heading"))
    const dialog = await openPanel(user)
    expect(
      within(dialog).getByRole("textbox", { name: "Message the AI assistant" })
    ).toBeDisabled()
    expect(
      within(dialog).getByText(/viewing the admin as someone else/)
    ).toBeInTheDocument()
  })

  it("opens and deletes a past conversation", async () => {
    routes["GET /api/v1/admin/ai/conversations"] = () =>
      json({
        items: [
          {
            id: "c9",
            title: "Old chat",
            createdAt: "2026-10-15T09:00:00.000Z",
            updatedAt: "2026-10-15T09:05:00.000Z",
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      })
    routes["GET /api/v1/admin/ai/conversations/c9"] = () =>
      json({
        id: "c9",
        title: "Old chat",
        createdAt: "2026-10-15T09:00:00.000Z",
        updatedAt: "2026-10-15T09:05:00.000Z",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "Earlier question",
            createdAt: "2026-10-15T09:00:00.000Z",
          },
          {
            id: "m2",
            role: "assistant",
            content: "Earlier answer",
            createdAt: "2026-10-15T09:00:05.000Z",
          },
        ],
      })
    routes["DELETE /api/v1/admin/ai/conversations/c9"] = () =>
      json({ ok: true })
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    await user.click(
      within(dialog).getByRole("button", { name: "Past conversations" })
    )
    await user.click(await screen.findByRole("button", { name: "Old chat" }))
    expect(
      await within(dialog).findByText("Earlier answer")
    ).toBeInTheDocument()
    await user.click(
      within(dialog).getByRole("button", { name: "Past conversations" })
    )
    await user.click(
      await screen.findByRole("button", { name: "Delete “Old chat”" })
    )
    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "DELETE" &&
            c.path === "/api/v1/admin/ai/conversations/c9"
        )
      ).toBe(true)
    )
    await waitFor(() =>
      expect(within(dialog).queryByText("Earlier answer")).toBeNull()
    )
  })
})

/**
 * An answer that keeps streaming until its request is aborted (P9 T1/2
 * review: readChatStream never cancels the response; only aborting the
 * fetch makes the server stop the provider call and save no reply).
 */
function hangingAnswer(signals: AbortSignal[]) {
  return (init?: RequestInit) => {
    const signal = init!.signal!
    signals.push(signal)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encode = (event: unknown) =>
          new TextEncoder().encode(`${JSON.stringify(event)}\n`)
        controller.enqueue(encode({ type: "start", conversationId: "c1" }))
        controller.enqueue(encode({ type: "text", text: "Partial answer" }))
        signal.addEventListener("abort", () =>
          controller.error(new DOMException("Aborted", "AbortError"))
        )
      },
    })
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
    })
  }
}

describe("Stopping an answer aborts the request (server cancels the provider)", () => {
  it("Stop aborts the fetch and keeps what arrived, without an error", async () => {
    const signals: AbortSignal[] = []
    routes["POST /api/v1/admin/ai/chat"] = hangingAnswer(signals)
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Hi")
    expect(
      await within(dialog).findByText("Partial answer")
    ).toBeInTheDocument()
    expect(signals[0]!.aborted).toBe(false)
    await user.click(within(dialog).getByRole("button", { name: "Stop" }))
    expect(signals[0]!.aborted).toBe(true)
    expect(
      await within(dialog).findByRole("button", { name: "Send" })
    ).toBeInTheDocument()
    expect(within(dialog).getByText("Partial answer")).toBeInTheDocument()
    expect(within(dialog).queryByRole("alert")).toBeNull()
  })

  it("New chat and unmounting abort an answer in progress", async () => {
    const signals: AbortSignal[] = []
    routes["POST /api/v1/admin/ai/chat"] = hangingAnswer(signals)
    const user = userEvent.setup()
    const view = renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "One")
    await within(dialog).findByText("Partial answer")
    await user.click(within(dialog).getByRole("button", { name: "New chat" }))
    expect(signals[0]!.aborted).toBe(true)
    await waitFor(() =>
      expect(within(dialog).queryByText("Partial answer")).toBeNull()
    )
    await sendMessage(user, dialog, "Two")
    await within(dialog).findByText("Partial answer")
    expect(signals[1]!.aborted).toBe(false)
    view.unmount()
    expect(signals[1]!.aborted).toBe(true)
  })
})

describe("Insert respects the field (fix round 1)", () => {
  it("puts a multi-line reply on one line in a single-line field (max 80)", async () => {
    routes["POST /api/v1/admin/ai/chat"] = () =>
      reply("“Safer nights,\n  safer shops”")
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByLabelText("Heading"))
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Rewrite it")
    await user.click(
      await within(dialog).findByRole("button", { name: "Insert into Heading" })
    )
    expect(apply).toHaveBeenCalledWith("Safer nights, safer shops")
  })

  it("refuses a reply longer than the field allows; the panel stays open", async () => {
    routes["POST /api/v1/admin/ai/chat"] = () =>
      reply(`${"Round-the-clock security ".repeat(4)}for Irish businesses`)
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByLabelText("Heading"))
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Rewrite it")
    await user.click(
      await within(dialog).findByRole("button", { name: "Insert into Heading" })
    )
    expect(apply).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith(
      "Too long for “Heading” (120/80) — copy it instead"
    )
    expect(screen.getByRole("dialog", { name: "AI assistant" })).toBeVisible()
  })

  it("the success toast offers Undo, which puts the previous value back", async () => {
    routes["POST /api/v1/admin/ai/chat"] = () => reply("Safer nights")
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByLabelText("Heading"))
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Rewrite it")
    await user.click(
      await within(dialog).findByRole("button", { name: "Insert into Heading" })
    )
    const options = toast.success.mock.calls.at(-1)![1] as {
      action: { label: string; onClick: () => void }
    }
    expect(options.action.label).toBe("Undo")
    act(() => options.action.onClick())
    expect(apply).toHaveBeenLastCalledWith("Old")
  })

  it("refuses when the field is gone from the form", async () => {
    apply.mockReturnValue(false)
    routes["POST /api/v1/admin/ai/chat"] = () => reply("Safer nights")
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByLabelText("Heading"))
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Rewrite it")
    await user.click(
      await within(dialog).findByRole("button", { name: "Insert into Heading" })
    )
    expect(toast.error).toHaveBeenCalledWith(
      "“Heading” is no longer on the form — copy it instead"
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("returns focus to the AI button when the field is in a hidden tab", async () => {
    standIn.hidden = true
    routes["POST /api/v1/admin/ai/chat"] = () => reply("Safer nights")
    const user = userEvent.setup()
    renderAssistant()
    await user.click(screen.getByLabelText("Heading"))
    // The user switches section tab: the field is hidden, not unmounted.
    screen.getByTestId("tab").hidden = true
    const dialog = await openPanel(user)
    await sendMessage(user, dialog, "Rewrite it")
    await user.click(
      await within(dialog).findByRole("button", { name: "Insert into Heading" })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.getByRole("button", { name: "AI assistant" })).toHaveFocus()
  })
})

describe("Panel accessibility and keyboard (fix round 1)", () => {
  it("marks the log busy while a reply streams; the error is outside the log", async () => {
    const signals: AbortSignal[] = []
    routes["POST /api/v1/admin/ai/chat"] = hangingAnswer(signals)
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    const log = within(dialog).getByRole("log", { name: "Conversation" })
    expect(log).toHaveAttribute("aria-busy", "false")
    await sendMessage(user, dialog, "Hi")
    await within(dialog).findByText("Partial answer")
    expect(log).toHaveAttribute("aria-busy", "true")
    await user.click(within(dialog).getByRole("button", { name: "Stop" }))
    await waitFor(() => expect(log).toHaveAttribute("aria-busy", "false"))

    routes["POST /api/v1/admin/ai/chat"] = () =>
      json({ error: { code: "RATE_LIMITED", message: "Wait a bit." } }, 429)
    await sendMessage(user, dialog, "Again")
    const alert = await within(dialog).findByRole("alert")
    expect(alert).toHaveTextContent("Wait a bit.")
    expect(log).not.toContainElement(alert)
  })

  it("read-only: focus starts on Close (the composer is disabled)", async () => {
    const user = userEvent.setup()
    renderAssistant({ ...ON, readOnly: true }, { editor: false })
    const dialog = await openPanel(user)
    await waitFor(() =>
      expect(
        within(dialog).getByRole("button", { name: "Close" })
      ).toHaveFocus()
    )
  })

  it("Ctrl+J does nothing while another modal dialog is open", async () => {
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const other = document.createElement("div")
    other.setAttribute("role", "dialog")
    other.setAttribute("aria-modal", "true")
    document.body.append(other)
    await user.keyboard("{Control>}j{/Control}")
    expect(screen.queryByRole("dialog", { name: "AI assistant" })).toBeNull()
    other.remove()
    await user.keyboard("{Control>}j{/Control}")
    expect(
      await screen.findByRole("dialog", { name: "AI assistant" })
    ).toBeInTheDocument()
  })

  it("a past conversation that loads after New chat does not replace it", async () => {
    let release: () => void = () => {}
    routes["GET /api/v1/admin/ai/conversations"] = () =>
      json({
        items: [
          {
            id: "c9",
            title: "Old chat",
            createdAt: "2026-10-15T09:00:00.000Z",
            updatedAt: "2026-10-15T09:05:00.000Z",
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      })
    routes["GET /api/v1/admin/ai/conversations/c9"] = () =>
      new Promise<Response>((resolve) => {
        release = () =>
          resolve(
            json({
              id: "c9",
              title: "Old chat",
              createdAt: "2026-10-15T09:00:00.000Z",
              updatedAt: "2026-10-15T09:05:00.000Z",
              messages: [
                {
                  id: "m2",
                  role: "assistant",
                  content: "Earlier answer",
                  createdAt: "2026-10-15T09:00:05.000Z",
                },
              ],
            })
          )
      })
    const user = userEvent.setup()
    renderAssistant(ON, { editor: false })
    const dialog = await openPanel(user)
    await user.click(
      within(dialog).getByRole("button", { name: "Past conversations" })
    )
    await user.click(await screen.findByRole("button", { name: "Old chat" }))
    await waitFor(() =>
      expect(
        calls.some((c) => c.path === "/api/v1/admin/ai/conversations/c9")
      ).toBe(true)
    )
    await user.click(within(dialog).getByRole("button", { name: "New chat" }))
    await act(async () => release())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(within(dialog).queryByText("Earlier answer")).toBeNull()
  })
})
