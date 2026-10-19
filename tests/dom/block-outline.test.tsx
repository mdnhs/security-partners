import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useReducer, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BlockOutline } from "@/components/admin/builder/block-outline"
import {
  type DocAction,
  docReducer,
  type DraftBlock,
  type DraftDocumentValue,
} from "@/components/admin/builder/builder-state"

const block = (
  id: string,
  type: DraftBlock["type"],
  anchor: string
): DraftBlock => ({ id, type, anchor, hidden: false, data: {} })

const DOC: DraftDocumentValue = {
  blocks: [
    block("hero-1", "hero.page", "hero-page"),
    block("aaaa", "stats", "stats"),
    block("bbbb", "richtext", "richtext"),
    block("cccc", "map", "map"),
  ],
}

// jsdom has no layout: give each outline row a 60 px slot by its position
// so dnd-kit's keyboard sensor can measure where "down" is.
const ROW = 60
function rowRect(el: Element): DOMRect {
  const li = el.closest("li")
  const list = li?.parentElement
  const index = li && list ? [...list.children].indexOf(li) : 0
  const top = index * ROW
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    width: 400,
    height: ROW - 8,
    right: 400,
    bottom: top + ROW - 8,
    toJSON: () => ({}),
  } as DOMRect
}
let restore: () => void
beforeEach(() => {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.closest("li")) return rowRect(this)
    // The list itself: restrictToParentElement keeps rows inside it.
    if (this.tagName === "OL") {
      const height = this.children.length * ROW
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        width: 400,
        height,
        right: 400,
        bottom: height,
        toJSON: () => ({}),
      } as DOMRect
    }
    return original.call(this)
  }
  restore = () => {
    Element.prototype.getBoundingClientRect = original
  }
})
afterEach(() => restore())

function Harness({
  initial = DOC,
  spy,
  errors = {},
  readOnly = false,
}: {
  initial?: DraftDocumentValue
  spy?: (a: DocAction) => void
  errors?: Record<string, string[]>
  readOnly?: boolean
}) {
  const [doc, dispatch] = useReducer(docReducer, initial)
  const [selected, setSelected] = useState<string | null>("aaaa")
  return (
    <>
      <BlockOutline
        doc={doc}
        selectedId={selected}
        errors={errors}
        readOnly={readOnly}
        onSelect={setSelected}
        dispatch={(a) => {
          spy?.(a)
          dispatch(a)
        }}
      />
      <output data-testid="order">
        {doc.blocks.map((b) => b.id).join(",")}
      </output>
      <output data-testid="selected">{selected}</output>
    </>
  )
}

const order = () => screen.getByTestId("order").textContent

describe("BlockOutline", () => {
  it("keyboard reorder (Space, ArrowDown, Space) dispatches move and announces it", async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    const grip = screen.getByRole("button", { name: "Drag to reorder Stats" })
    grip.focus()
    await user.keyboard("[Space]")
    await waitFor(() =>
      expect(document.body).toHaveTextContent(
        "Picked up Stats, position 2 of 4."
      )
    )
    await user.keyboard("[ArrowDown]")
    await waitFor(() =>
      expect(document.body).toHaveTextContent("Stats is over position 3 of 4.")
    )
    await user.keyboard("[Space]")
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith({ type: "move", id: "aaaa", to: 2 })
    )
    expect(order()).toBe("hero-1,bbbb,aaaa,cccc")
    expect(document.body).toHaveTextContent("Stats moved to position 3 of 4.")
  })

  it("Move up / Move down buttons; the page hero is fixed first", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(
      screen.queryByRole("button", { name: "Drag to reorder Page hero" })
    ).toBeNull()
    expect(screen.getByRole("button", { name: "Move Stats up" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Move Map up" }))
    expect(order()).toBe("hero-1,aaaa,cccc,bbbb")
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Map up" })).toHaveFocus()
    )
  })

  it("the hide toggle sets aria-pressed", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const hide = screen.getByRole("button", { name: "Hide Text" })
    expect(hide).toHaveAttribute("aria-pressed", "false")
    await user.click(hide)
    expect(hide).toHaveAttribute("aria-pressed", "true")
    expect(
      screen.getByRole("button", { name: "Text, #richtext, hidden" })
    ).toBeInTheDocument()
  })

  it("delete asks for confirmation; selection moves on", async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<Harness spy={spy} />)
    await user.click(screen.getByRole("button", { name: "Delete Stats" }))
    const dialog = await screen.findByRole("alertdialog", {
      name: "Delete Stats?",
    })
    expect(spy).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("button", { name: "Keep block" }))
    expect(order()).toBe("hero-1,aaaa,bbbb,cccc")

    await user.click(screen.getByRole("button", { name: "Delete Stats" }))
    await user.click(
      within(
        await screen.findByRole("alertdialog", { name: "Delete Stats?" })
      ).getByRole("button", { name: "Delete block" })
    )
    expect(spy).toHaveBeenCalledWith({ type: "remove", id: "aaaa" })
    expect(order()).toBe("hero-1,bbbb,cccc")
    expect(screen.getByTestId("selected")).toHaveTextContent("bbbb")
  })

  it("duplicate; one-per-page blocks cannot be duplicated", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByRole("button", { name: "Duplicate Map" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Duplicate Stats" }))
    // Two Stats now: rows are told apart by anchor.
    expect(
      screen.getByRole("button", { name: "Hide Stats (#stats-2)" })
    ).toBeInTheDocument()
    expect(order()?.split(",")).toHaveLength(5)
  })

  it("selection, error badge as text, read-only", async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <Harness errors={{ bbbb: ["Text: Required", "Anchor: Taken"] }} />
    )
    const text = screen.getByRole("button", {
      name: "Text, #richtext, 2 problems",
    })
    expect(text).toHaveTextContent("2 problems")
    expect(
      screen.getByRole("button", { name: "Stats, #stats" })
    ).toHaveAttribute("aria-current", "true")
    await user.click(text)
    expect(screen.getByTestId("selected")).toHaveTextContent("bbbb")
    unmount()

    render(<Harness readOnly />)
    expect(screen.queryByRole("button", { name: /^Delete/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Hide/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Move Map up" })).toBeDisabled()
    await act(async () => {})
  })
})
