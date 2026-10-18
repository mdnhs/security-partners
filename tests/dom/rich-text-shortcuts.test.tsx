import { QueryClientProvider } from "@tanstack/react-query"
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { makeQueryClient } from "@/components/admin/providers"
import {
  isLinkShortcut,
  RichTextEditor,
} from "@/components/admin/rich-text/editor"

const doc = (...paragraphs: string[]): JSONContent => ({
  type: "doc",
  content: paragraphs.map((text) => ({
    type: "paragraph",
    content: [{ type: "text", text }],
  })),
})

function renderEditor(
  props: Partial<Parameters<typeof RichTextEditor>[0]> = {}
) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <RichTextEditor
        id="body"
        label="Article text"
        value={doc("One two three")}
        onChange={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  )
}

const seen: KeyboardEvent[] = []
const onWindowKeyDown = (event: KeyboardEvent) => seen.push(event)
afterEach(() => {
  window.removeEventListener("keydown", onWindowKeyDown)
  seen.length = 0
})

describe("rich text editor shortcuts and counts (Phase 5)", () => {
  it("recognises ⌘K / Ctrl+K only", () => {
    const key = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init)
    expect(isLinkShortcut(key({ key: "k", metaKey: true }))).toBe(true)
    expect(isLinkShortcut(key({ key: "K", ctrlKey: true }))).toBe(true)
    expect(isLinkShortcut(key({ key: "k" }))).toBe(false)
    expect(isLinkShortcut(key({ key: "k", ctrlKey: true, altKey: true }))).toBe(
      false
    )
  })

  it("⌘K in the text opens the link popover and keeps the page palette closed", async () => {
    window.addEventListener("keydown", onWindowKeyDown)
    renderEditor()
    const box = await screen.findByRole("textbox", { name: "Article text" })
    // ProseMirror listens on its own DOM node; the event then bubbles to
    // window, where the ⌘K palette ignores it because it was prevented.
    fireEvent.keyDown(box, { key: "k", ctrlKey: true })
    expect(
      await screen.findByRole("textbox", { name: "Link address" })
    ).toBeInTheDocument()
    const shortcut = seen.find((e) => e.key.toLowerCase() === "k")
    expect(shortcut?.defaultPrevented).toBe(true)
  })

  it("refuses a placeholder as a link target", async () => {
    const user = userEvent.setup()
    renderEditor()
    const toolbar = await screen.findByRole("toolbar", { name: "Formatting" })
    await user.click(within(toolbar).getByRole("button", { name: "Link" }))
    const input = await screen.findByRole("textbox", { name: "Link address" })
    fireEvent.change(input, { target: { value: "{phone24hHref}" } })
    await user.click(screen.getByRole("button", { name: "Apply" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Use /path, #anchor, https://…, tel: or mailto:"
    )
  })

  it("shows the word count and read time in full mode only", async () => {
    const { unmount } = renderEditor()
    expect(
      await screen.findByText("3 words · about 1 min read")
    ).toBeInTheDocument()
    unmount()
    renderEditor({ value: doc("Hello"), mode: "paragraphs" })
    await screen.findByRole("textbox", { name: "Article text" })
    await waitFor(() =>
      expect(screen.queryByText(/min read/)).not.toBeInTheDocument()
    )
  })
})
