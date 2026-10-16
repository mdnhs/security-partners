import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { JSONContent } from "@tiptap/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { MediaPickerDialog } from "@/components/admin/media/picker-dialog"
import { makeQueryClient } from "@/components/admin/providers"
import { RichTextEditor } from "@/components/admin/rich-text/editor"
import { richText } from "@/lib/schemas/common"

const LIBRARY = [
  {
    id: "00000000-0000-7000-8000-000000000001",
    url: "/images/hero.jpg",
    alt: "Officer at night",
    mime: "image/jpeg",
    width: 1440,
    height: 748,
    size: 1,
    createdAt: "2026-10-16T00:00:00.000Z",
  },
  {
    id: "00000000-0000-7000-8000-000000000002",
    url: "/images/about.png",
    alt: "Team photo",
    mime: "image/png",
    width: 600,
    height: 400,
    size: 1,
    createdAt: "2026-10-16T00:00:00.000Z",
  },
]

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost")
  const one = url.pathname.match(/^\/api\/v1\/admin\/media\/(.+)$/)
  const body = one
    ? LIBRARY.find((m) => m.id === one[1])
    : {
        items: LIBRARY.filter(
          (m) =>
            !url.searchParams.get("q") ||
            m.alt.includes(url.searchParams.get("q")!)
        ),
        page: 1,
        pageSize: 24,
        total: 2,
      }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
})

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal("fetch", fetchMock)
})

const doc = (text: string): JSONContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

function renderEditor(
  props: Partial<Parameters<typeof RichTextEditor>[0]> = {}
) {
  const onChange = vi.fn()
  const utils = render(
    <QueryClientProvider client={makeQueryClient()}>
      <RichTextEditor
        id="body"
        label="Body"
        value={doc("Hello")}
        onChange={onChange}
        {...props}
      />
    </QueryClientProvider>
  )
  return { ...utils, onChange }
}

describe("RichTextEditor", () => {
  it("renders an accessible textbox with a formatting toolbar", async () => {
    renderEditor()
    const box = await screen.findByRole("textbox", { name: "Body" })
    expect(box).toHaveAttribute("aria-multiline", "true")
    expect(box).toHaveTextContent("Hello")
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" })
    for (const name of [
      "Bold",
      "Italic",
      "Link",
      "Heading",
      "Subheading",
      "Bulleted list",
      "Numbered list",
      "Quote",
      "Insert image",
      "Undo",
      "Redo",
    ])
      expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument()
  })

  it("paragraphs mode offers only inline formatting", async () => {
    renderEditor({ mode: "paragraphs" })
    const toolbar = await screen.findByRole("toolbar", { name: "Formatting" })
    expect(
      within(toolbar)
        .getAllByRole("button")
        .map((b) => b.getAttribute("aria-label"))
    ).toEqual(["Bold", "Italic", "Link", "Undo", "Redo"])
  })

  it("inserts a library image as a { media, alt } node that validates", async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    await screen.findByRole("textbox", { name: "Body" })
    await user.click(screen.getByRole("button", { name: "Insert image" }))
    const dialog = await screen.findByRole("dialog", {
      name: "Choose an image",
    })
    await user.click(
      await within(dialog).findByRole("button", { name: /Team photo/ })
    )
    await user.click(
      within(dialog).getByRole("button", { name: "Use this image" })
    )
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const last = onChange.mock.calls.at(-1)![0] as JSONContent
    const image = last.content!.find((n) => n.type === "image")
    expect(image?.attrs).toEqual({
      media: { mediaId: LIBRARY[1].id },
      alt: "Team photo",
    })
    expect(richText.safeParse(last).success).toBe(true)
  })

  it("replaces its content when the value changes from outside", async () => {
    const { rerender } = renderEditor()
    await screen.findByRole("textbox", { name: "Body" })
    rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <RichTextEditor
          id="body"
          label="Body"
          value={doc("Reloaded")}
          onChange={vi.fn()}
        />
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: "Body" })).toHaveTextContent(
        "Reloaded"
      )
    )
  })

  it("does not report a change just for loading a value", async () => {
    const { onChange } = renderEditor({
      value: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
          {
            type: "image",
            attrs: { media: { mediaId: LIBRARY[0].id }, alt: "Officer" },
          },
        ],
      },
    })
    await screen.findByRole("textbox", { name: "Body" })
    await screen.findByDisplayValue("Officer")
    expect(onChange).not.toHaveBeenCalled()
  })

  it("Mod-K opens the link form (and keeps ⌘K from the palette); only safe, literal hrefs apply", async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor()
    const box = await screen.findByRole("textbox", { name: "Body" })
    const seen: boolean[] = []
    const spy = (event: KeyboardEvent) => seen.push(event.defaultPrevented)
    window.addEventListener("keydown", spy)
    box.focus()
    await user.keyboard("{Control>}k{/Control}")
    window.removeEventListener("keydown", spy)
    expect(seen.at(-1)).toBe(true)

    const address = await screen.findByRole("textbox", {
      name: "Link address",
    })
    for (const bad of ["{phone24hHref}", "javascript:alert(1)"]) {
      await user.clear(address)
      await user.type(
        address,
        bad.replace(/[{[]/g, (c) => c + c)
      )
      await user.click(screen.getByRole("button", { name: "Apply" }))
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Use /path, #anchor, https://…, tel: or mailto:"
      )
    }
    expect(onChange).not.toHaveBeenCalled()

    await user.clear(address)
    await user.type(address, "/contact")
    await user.click(screen.getByRole("button", { name: "Apply" }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    const last = onChange.mock.calls.at(-1)![0] as JSONContent
    expect(JSON.stringify(last)).toContain(
      '"marks":[{"type":"link","attrs":{"href":"/contact"}}]'
    )
    expect(richText.safeParse(last).success).toBe(true)
  })
})

describe("MediaPickerDialog", () => {
  it("searches the library and returns the chosen item", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <MediaPickerDialog open onOpenChange={vi.fn()} onSelect={onSelect} />
      </QueryClientProvider>
    )
    const dialog = await screen.findByRole("dialog", {
      name: "Choose an image",
    })
    expect(
      within(dialog).getByRole("button", { name: "Use this image" })
    ).toBeDisabled()
    await user.type(
      within(dialog).getByRole("searchbox", { name: "Search images" }),
      "Officer"
    )
    await waitFor(() =>
      expect(
        within(dialog).queryByRole("button", { name: /Team photo/ })
      ).toBeNull()
    )
    const officer = within(dialog).getByRole("button", {
      name: /Officer at night/,
    })
    await user.click(officer)
    expect(officer).toHaveAttribute("aria-pressed", "true")
    await user.click(
      within(dialog).getByRole("button", { name: "Use this image" })
    )
    expect(onSelect).toHaveBeenCalledWith(LIBRARY[0])
    expect(String(fetchMock.mock.calls.at(-1)![0])).toContain("kind=image")
  })
})
