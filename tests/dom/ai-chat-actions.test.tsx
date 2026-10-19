import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
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

const ON: AiStatusDto = {
  available: true,
  canManage: false,
  reason: null,
  model: "claude-sonnet-5-5",
  readOnly: false,
}

let chatBodies: Record<string, unknown>[]
/** Replies of the next chat calls, in order (the last one repeats). */
let replies: string[]

beforeEach(() => {
  chatBodies = []
  replies = ["Hello world"]
  let turn = 0
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://localhost")
      const method = init?.method ?? "GET"
      if (method === "POST" && url.pathname === "/api/v1/admin/ai/chat") {
        chatBodies.push(JSON.parse(String(init!.body)))
        turn++
        const text = replies[Math.min(turn - 1, replies.length - 1)]!
        // "!" = the provider fails before any text.
        if (text === "!")
          return ndjson(
            { type: "start", conversationId: "c1", userMessageId: `u${turn}` },
            { type: "error", message: "The AI provider is unavailable." }
          )
        return ndjson(
          { type: "start", conversationId: "c1", userMessageId: `u${turn}` },
          { type: "text", text },
          { type: "done", messageId: `a${turn}` }
        )
      }
      if (url.pathname === "/api/v1/admin/ai/conversations")
        return json({ items: [], page: 1, pageSize: 20, total: 0 })
      return json({ error: { code: "NOT_FOUND", message: "Not found" } }, 404)
    })
  )
})

function EditorStandIn() {
  useAssistantScreen({
    title: "Home page",
    entityType: "page",
    entityId: "home",
    record: { hero: { heading: "Old" } },
  })
  return null
}

function renderAssistant({ editor = false } = {}) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <AssistantProvider>
        <AssistantButton initialStatus={ON} />
        {editor ? <EditorStandIn /> : null}
      </AssistantProvider>
    </QueryClientProvider>
  )
}

async function openPanel(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "AI assistant" }))
  return screen.findByRole("dialog", { name: "AI assistant" })
}

async function send(
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

describe("Chat actions (MK parity C9)", () => {
  it("regenerate posts regenerate:true and replaces the last reply", async () => {
    replies = ["Hello world", "Second take"]
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    await send(user, dialog, "One")
    await within(dialog).findByText("Hello world")
    // Only the last reply can be regenerated.
    await user.click(within(dialog).getByRole("button", { name: "Regenerate" }))
    expect(await within(dialog).findByText("Second take")).toBeInTheDocument()
    expect(within(dialog).queryByText("Hello world")).toBeNull()
    expect(chatBodies[1]).toEqual({ conversationId: "c1", regenerate: true })
    // One question, one answer.
    expect(
      within(dialog).getAllByRole("button", { name: "Copy" })
    ).toHaveLength(1)
    expect(within(dialog).getByText("One")).toBeInTheDocument()
  })

  it("a failed regenerate brings the old answer back, with Regenerate (review M2)", async () => {
    replies = ["Hello world", "!", "Third"]
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    await send(user, dialog, "One")
    await within(dialog).findByText("Hello world")
    await user.click(within(dialog).getByRole("button", { name: "Regenerate" }))
    // Focus moves to the conversation, where the new turn appears (M3).
    expect(
      within(dialog).getByRole("region", { name: "Conversation" })
    ).toHaveFocus()
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The AI provider is unavailable."
    )
    expect(within(dialog).getByText("Hello world")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: "Regenerate" }))
    expect(await within(dialog).findByText("Third")).toBeInTheDocument()
    expect(chatBodies.slice(1)).toEqual([
      { conversationId: "c1", regenerate: true },
      { conversationId: "c1", regenerate: true },
    ])
  })

  it("a question left without an answer offers Try again", async () => {
    replies = ["!", "Late answer"]
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    await send(user, dialog, "One")
    await within(dialog).findByRole("alert")
    await user.click(within(dialog).getByRole("button", { name: "Try again" }))
    expect(await within(dialog).findByText("Late answer")).toBeInTheDocument()
    expect(chatBodies[1]).toEqual({ conversationId: "c1", regenerate: true })
  })

  it("edit trims later messages and resends", async () => {
    replies = ["First answer", "Second answer", "Edited answer"]
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    await send(user, dialog, "One")
    await within(dialog).findByText("First answer")
    await send(user, dialog, "Two")
    await within(dialog).findByText("Second answer")
    expect(
      within(dialog).getAllByRole("button", { name: "Regenerate" })
    ).toHaveLength(1)

    const edits = within(dialog).getAllByRole("button", { name: "Edit" })
    expect(edits).toHaveLength(2)
    await user.click(edits[0]!)
    const box = within(dialog).getByRole("textbox", {
      name: "Edit your message",
    })
    expect(box).toHaveFocus()
    expect(box).toHaveValue("One")
    await user.clear(box)
    await user.type(box, "Uno")
    await user.click(
      within(dialog).getByRole("button", { name: "Save & resend" })
    )
    expect(
      within(dialog).getByRole("region", { name: "Conversation" })
    ).toHaveFocus()
    expect(await within(dialog).findByText("Edited answer")).toBeInTheDocument()
    expect(chatBodies[2]).toEqual({
      conversationId: "c1",
      message: "Uno",
      editMessageId: "u1",
    })
    for (const gone of ["One", "Two", "First answer", "Second answer"])
      expect(within(dialog).queryByText(gone)).toBeNull()
    expect(within(dialog).getByText("Uno")).toBeInTheDocument()
  })

  it("Cancel and Escape leave the message as it was; focus returns to Edit", async () => {
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    await send(user, dialog, "One")
    await within(dialog).findByText("Hello world")
    const edit = within(dialog).getByRole("button", { name: "Edit" })
    await user.click(edit)
    await user.type(
      within(dialog).getByRole("textbox", { name: "Edit your message" }),
      " more"
    )
    await user.keyboard("{Escape}")
    // Escape closes the editor, not the panel.
    expect(screen.getByRole("dialog", { name: "AI assistant" })).toBeVisible()
    expect(
      within(dialog).queryByRole("textbox", { name: "Edit your message" })
    ).toBeNull()
    expect(within(dialog).getByRole("button", { name: "Edit" })).toHaveFocus()
    await user.click(within(dialog).getByRole("button", { name: "Edit" }))
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }))
    expect(within(dialog).getByText("One")).toBeInTheDocument()
    expect(chatBodies).toHaveLength(1)
  })

  it("dismissing the Using chip sends no context", async () => {
    const user = userEvent.setup()
    renderAssistant({ editor: true })
    const dialog = await openPanel(user)
    expect(within(dialog).getByText(/Using:/)).toHaveTextContent(
      "Using: Home page"
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Don't send this screen" })
    )
    expect(within(dialog).queryByText(/Using:/)).toBeNull()
    await send(user, dialog, "Hi")
    await within(dialog).findByText("Hello world")
    expect(chatBodies).toEqual([{ message: "Hi" }])
    // Only that message: the chip is back for the next one.
    expect(within(dialog).getByText(/Using:/)).toBeInTheDocument()
  })

  it("announces a short summary, not the streamed text", async () => {
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    const conversation = within(dialog).getByRole("region", {
      name: "Conversation",
    })
    expect(conversation).not.toHaveAttribute("aria-live")
    await send(user, dialog, "One")
    await within(dialog).findByText("Hello world")
    await waitFor(() =>
      expect(within(dialog).getByRole("status")).toHaveTextContent(
        "The assistant has answered."
      )
    )
    expect(within(dialog).getByRole("status")).not.toHaveTextContent(
      "Hello world"
    )
  })

  it("renders replies as Markdown and the user's text as plain text", async () => {
    replies = ["- **a**\n- b"]
    const user = userEvent.setup()
    renderAssistant()
    const dialog = await openPanel(user)
    await send(user, dialog, "**not bold**")
    await within(dialog).findByText("a")
    expect(within(dialog).getByText("a").tagName).toBe("STRONG")
    expect(within(dialog).getByText("**not bold**")).toBeInTheDocument()
  })
})
