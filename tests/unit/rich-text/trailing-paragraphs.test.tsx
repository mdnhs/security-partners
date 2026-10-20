import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ArticleBlocks } from "@/lib/rich-text/render"

const p = (text: string) => ({
  type: "paragraph" as const,
  content: [{ type: "text" as const, text }],
})

const html = (content: Parameters<typeof ArticleBlocks>[0]["doc"]["content"]) =>
  renderToStaticMarkup(<ArticleBlocks doc={{ type: "doc", content }} />)

describe("renderer ignores the editor's trailing empty paragraph", () => {
  it("drops empty paragraphs at the end only", () => {
    expect(html([p("a"), { type: "paragraph" }, p("  ")])).toBe(html([p("a")]))
    expect(html([p("a"), { type: "paragraph" }, p("b")])).toContain("<p class")
    expect(
      (html([p("a"), { type: "paragraph" }, p("b")]).match(/<p /g) ?? []).length
    ).toBe(3)
  })

  it("renders a stored javascript: or placeholder link target as #", () => {
    const markup = html([
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "x",
            marks: [{ type: "link", attrs: { href: "{phone24hHref}" } }],
          },
        ],
      },
    ])
    expect(markup).toContain('href="#"')
  })
})
