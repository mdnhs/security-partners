import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { emptyBlock } from "@/blocks/document"
import { BLOCK_TYPES } from "@/blocks/registry"
import { BlockForm, isSharedOnly } from "@/components/admin/builder/block-form"
import { BlockMeta } from "@/components/admin/builder/block-meta"
import type {
  DraftBlock,
  DraftDocumentValue,
} from "@/components/admin/builder/builder-state"
import { makeQueryClient } from "@/components/admin/providers"

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ items: [], page: 1, pageSize: 24, total: 0 }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
    )
  )
})

const fresh = (type: DraftBlock["type"]) =>
  emptyBlock(type, { blocks: [] }) as DraftBlock

function renderForm(block: DraftBlock, errors: Record<string, string[]> = {}) {
  const onChange = vi.fn()
  render(
    <QueryClientProvider client={makeQueryClient()}>
      <BlockForm
        block={block}
        onChange={onChange}
        errors={errors}
        readOnly={false}
      />
    </QueryClientProvider>
  )
  return onChange
}

describe("BlockForm", () => {
  it.each(BLOCK_TYPES)("renders a fresh %s block", (type) => {
    renderForm(fresh(type))
    if (isSharedOnly(type))
      expect(screen.getByText(/nothing to fill in here/)).toBeInTheDocument()
    else expect(document.querySelector("form")).not.toBeNull()
  })

  it("labels fields from BLOCK_FIELD_LABELS and emits every change", async () => {
    const user = userEvent.setup()
    const onChange = renderForm(fresh("hero.page"))
    expect(
      screen.getByRole("textbox", { name: "Breadcrumb label" })
    ).toBeInTheDocument()
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Hi")
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "Hi", crumb: "" })
    )
  })

  it("shows publish errors on their fields", async () => {
    renderForm(fresh("team"), { heading: ["Required"] })
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Heading" })).toHaveAttribute(
        "aria-invalid",
        "true"
      )
    )
  })
})

describe("BlockForm resetKey (review D5.4 I2)", () => {
  function Harness({ initial }: { initial: DraftBlock }) {
    const [block, setBlock] = useState(initial)
    const [resetKey, setResetKey] = useState(0)
    return (
      <QueryClientProvider client={makeQueryClient()}>
        <BlockForm
          block={block}
          resetKey={resetKey}
          onChange={(data) =>
            setBlock((b) => ({ ...b, data: data as DraftBlock["data"] }))
          }
          errors={{}}
          readOnly={false}
        />
        <button
          type="button"
          onClick={() => {
            // A restore / conflict reload: same block id, new data.
            setBlock((b) => ({
              ...b,
              data: { heading: "Restored", intro: "From history" },
            }))
            setResetKey((k) => k + 1)
          }}
        >
          Restore
        </button>
        <output data-testid="data">{JSON.stringify(block.data)}</output>
      </QueryClientProvider>
    )
  }

  it("a replace reloads the form, so the next edit keeps the restored data", async () => {
    const user = userEvent.setup()
    render(
      <Harness
        initial={{
          ...fresh("team"),
          data: { heading: "Old heading", intro: "Old intro" },
        }}
      />
    )
    const heading = screen.getByRole("textbox", { name: "Heading" })
    expect(heading).toHaveValue("Old heading")
    await user.click(screen.getByRole("button", { name: "Restore" }))
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Heading" })).toHaveValue(
        "Restored"
      )
    )
    await user.type(screen.getByRole("textbox", { name: "Intro" }), "!")
    const data = JSON.parse(screen.getByTestId("data").textContent!)
    expect(data).toEqual(
      expect.objectContaining({ heading: "Restored", intro: "From history!" })
    )
  })
})

function MetaHarness({ doc }: { doc: DraftDocumentValue }) {
  const [block, setBlock] = useState(doc.blocks[1])
  const current = {
    blocks: doc.blocks.map((b) => (b.id === block.id ? block : b)),
  }
  return (
    <BlockMeta
      block={block}
      doc={current}
      onChange={(p) => setBlock((b) => ({ ...b, ...p }))}
    />
  )
}

describe("BlockMeta", () => {
  const doc: DraftDocumentValue = {
    blocks: [
      {
        id: "aaaa",
        type: "about",
        anchor: "about",
        hidden: false,
        data: {},
      },
      {
        id: "bbbb",
        type: "stats",
        anchor: "stats",
        hidden: false,
        data: {},
      },
    ],
  }

  it("validates the anchor as typed: format, reserved ids, uniqueness", async () => {
    const user = userEvent.setup()
    render(<MetaHarness doc={doc} />)
    const anchor = screen.getByRole("textbox", { name: "Anchor" })
    expect(anchor).not.toHaveAttribute("aria-invalid")

    await user.clear(anchor)
    await user.type(anchor, "services")
    expect(anchor).toHaveAttribute("aria-invalid", "true")
    expect(anchor).toHaveAccessibleDescription(
      expect.stringContaining('"services" is kept for the Services section')
    )

    await user.clear(anchor)
    await user.type(anchor, "about")
    expect(anchor).toHaveAccessibleDescription(
      expect.stringContaining('"about" is kept for the About section')
    )

    await user.clear(anchor)
    await user.type(anchor, "Figures")
    expect(anchor).toHaveAccessibleDescription(
      expect.stringContaining("lower-case")
    )

    await user.clear(anchor)
    await user.type(anchor, "figures")
    expect(anchor).not.toHaveAttribute("aria-invalid")
  })

  it("the anchor error sits in a polite live region", async () => {
    const user = userEvent.setup()
    render(<MetaHarness doc={doc} />)
    const anchor = screen.getByRole("textbox", { name: "Anchor" })
    const region = anchor.parentElement!.querySelector("[aria-live=polite]")
    expect(region).not.toBeNull()
    expect(region).toBeEmptyDOMElement()
    await user.clear(anchor)
    await user.type(anchor, "services")
    expect(region).toHaveTextContent("is kept for the Services section")
  })

  it("the hidden switch", async () => {
    const user = userEvent.setup()
    render(<MetaHarness doc={doc} />)
    const hidden = screen.getByRole("switch", { name: "Hidden" })
    expect(hidden).not.toBeChecked()
    await user.click(hidden)
    expect(hidden).toBeChecked()
  })
})
