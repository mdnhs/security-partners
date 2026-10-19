import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))
vi.mock("sonner", () => ({ toast }))

import { Markdown, parseBlocks, safeHref } from "@/components/admin/ai/markdown"

describe("Markdown for assistant replies (no raw HTML, ever)", () => {
  it("renders lists, tables and code without HTML injection", () => {
    render(
      <Markdown
        text={
          "- a\n- b\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))"
        }
      />
    )
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(document.querySelector("img")).toBeNull()
    expect(screen.queryByRole("link", { name: "x" })).toBeNull()
    // The unsafe link stays readable as text.
    expect(document.body.textContent).toContain("x (javascript:alert(1))")
  })

  it("renders the supported subset; headings never join the page outline", () => {
    const { container } = render(
      <Markdown
        text={
          "## Title\n\nSome **bold** and *soft* `code`.\n\n- one\n- two\n\n3. three\n4. four\n\n> quoted\n> on\n>\n> two\n\n---\n\n```ts\nconst a = 1\n```"
        }
      />
    )
    expect(screen.getByText("Title").tagName).toBe("P")
    expect(screen.getByText("Title")).toHaveClass("font-semibold")
    expect(container.querySelector("h1, h2, h3, h4, h5, h6")).toBeNull()
    expect(container.querySelector("strong")!.textContent).toBe("bold")
    expect(container.querySelector("em")!.textContent).toBe("soft")
    expect(container.querySelectorAll("ul li")).toHaveLength(2)
    expect(container.querySelector("ol")!.getAttribute("start")).toBe("3")
    const quote = container.querySelector("blockquote")!
    expect([...quote.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "quoted on",
      "two",
    ])
    expect(container.querySelector("hr")).toBeTruthy()
    expect(container.querySelector("pre code")!.textContent).toBe("const a = 1")
  })

  it("shows HTML and script as text", () => {
    const { container } = render(
      <Markdown
        text={'<img src=x onerror="alert(1)"><script>alert(2)</script>'}
      />
    )
    expect(container.querySelector("img, script")).toBeNull()
    expect(container.textContent).toContain("<script>alert(2)</script>")
  })

  it("links only safe URLs; external ones open a new tab without opener or referrer", () => {
    const { container } = render(
      <Markdown
        text={
          "[ok](https://example.ie/a) [bad](javascript:alert(1)) [rel](/admin/pages) [plain](http://example.ie)"
        }
      />
    )
    const links = [...container.querySelectorAll("a")]
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://example.ie/a",
      "/admin/pages",
    ])
    expect(links[0]!.getAttribute("target")).toBe("_blank")
    expect(links[0]!.getAttribute("rel")).toBe("noopener noreferrer nofollow")
    expect(links[1]!.getAttribute("target")).toBeNull()
    expect(container.textContent).toContain("bad (javascript:alert(1))")
  })

  it("safeHref: https, plain mailto and site paths outside /api only", () => {
    expect(safeHref("https://example.ie/a")).toBe("https://example.ie/a")
    expect(safeHref("/admin/pages")).toBe("/admin/pages")
    expect(safeHref("/apiary")).toBe("/apiary")
    expect(safeHref("mailto:hi@example.ie")).toBe("mailto:hi@example.ie")
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      " javascript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html,x",
      "vbscript:x",
      "http://plain.example",
      "//evil.example",
      "/\\evil.example",
      "mailto:hi@example.ie?subject=x",
      "mailto:hi@example.ie?",
      "/api/v1/admin/leads/export",
      "/API/v1/admin/leads/export",
      "/api",
      "/x/../api/v1/admin/leads/export",
      "/%61pi/v1/admin/leads/export",
      "relative/path",
      "#top",
    ])
      expect(safeHref(bad), bad).toBeNull()
  })

  it("keeps the link rules inside tables and quotes", () => {
    const { container } = render(
      <Markdown
        text={
          "| Link |\n| --- |\n| [x](/api/v1/admin/leads/export) |\n\n> [y](mailto:a@b.ie?body=hi) [z](javascript:alert(1))"
        }
      />
    )
    expect(container.querySelector("a")).toBeNull()
    expect(container.textContent).toContain("x (/api/v1/admin/leads/export)")
  })

  it("draws tables with column headers in a scrollable, focusable region", () => {
    const { container } = render(
      <Markdown
        text={
          "| Page | Score |\n| :--- | ---: |\n| About | **92** |\n| Fees | 61 |\n\nAfter."
        }
      />
    )
    const region = screen.getByRole("region", { name: "Table" })
    expect(region).toHaveAttribute("tabindex", "0")
    const heads = screen.getAllByRole("columnheader")
    expect(heads.map((h) => h.textContent)).toEqual(["Page", "Score"])
    expect(heads[0]).toHaveAttribute("scope", "col")
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2)
    expect(container.querySelector("tbody strong")!.textContent).toBe("92")
    expect(screen.getByText("After.").tagName).toBe("P")
  })

  it("parseBlocks: joins paragraph lines, groups lists, handles ragged tables", () => {
    expect(parseBlocks("a\nb\n\n- x\n- y")).toEqual([
      { kind: "p", text: "a b" },
      { kind: "ul", items: ["x", "y"] },
    ])
    expect(
      parseBlocks("a | b\n--|--\n| x |\ny | z \\| w | extra\nafter")
    ).toEqual([
      {
        kind: "table",
        head: ["a", "b"],
        rows: [
          ["x", ""],
          ["y", "z | w"],
        ],
      },
      { kind: "p", text: "after" },
    ])
    expect(parseBlocks("a | b\nc | d")).toEqual([
      { kind: "p", text: "a | b c | d" },
    ])
    expect(parseBlocks("# One\n```\nx\n")).toEqual([
      { kind: "h", level: 1, text: "One" },
      // An unclosed fence (a reply still streaming) runs to the end.
      { kind: "code", lang: "", text: "x\n" },
    ])
  })

  it("labels fenced code with its language, scrolls by keyboard, and copies it", async () => {
    const writeText = vi.fn(() => Promise.resolve())
    // After setup(): user-event installs its own clipboard stub.
    const user = userEvent.setup()
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    })
    render(<Markdown text={'```json\n{ "a": 1 }\n```\n\n```\nplain\n```'} />)
    const block = screen.getByRole("region", { name: "json code" })
    expect(block).toHaveAttribute("tabindex", "0")
    expect(block.textContent).toBe('{ "a": 1 }')
    expect(screen.getByRole("region", { name: "Code" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Copy json code" }))
    expect(writeText).toHaveBeenCalledWith('{ "a": 1 }')
    expect(toast.success).toHaveBeenCalledWith("Copied")
  })

  it("strips a heading's closing hashes only after a space", () => {
    expect(parseBlocks("## Title ##\n# C#")).toEqual([
      { kind: "h", level: 2, text: "Title" },
      { kind: "h", level: 1, text: "C#" },
    ])
  })

  it("shows where an external link goes (C9 review M7)", () => {
    const { container } = render(
      <Markdown text="[the report](https://evil.example/?q=Jane)" />
    )
    const link = container.querySelector("a")!
    expect(link.textContent).toContain("the report (evil.example)")
  })

  it("parses 20k-character adversarial replies in linear time (C9 review M4)", () => {
    const inputs = [
      `# ${"a ".repeat(10_000)}x`,
      `# ${" ".repeat(20_000)}x`,
      "[".repeat(20_000),
      `[${"a".repeat(20_000)}`,
      `[a](${"b".repeat(20_000)}`,
      `# a${" ".repeat(20_000)}b`,
      "| a ".repeat(5_000),
      `${"- ".repeat(10_000)}x`,
    ]
    for (const input of inputs) {
      const started = performance.now()
      const { unmount } = render(<Markdown text={input} />)
      unmount()
      // Quadratic patterns took ~400 ms here; linear ones a few ms.
      expect(performance.now() - started, input.slice(0, 12)).toBeLessThan(100)
    }
  })
})
