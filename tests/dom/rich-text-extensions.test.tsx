import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it } from "vitest"

import { richTextExtensions } from "@/components/admin/rich-text/extensions"
import { paragraphsText, richText } from "@/lib/schemas/common"

let editors: Editor[] = []
afterEach(() => {
  for (const e of editors) e.destroy()
  editors = []
})

function parse(html: string, mode: "full" | "paragraphs" = "full") {
  const editor = new Editor({
    extensions: richTextExtensions(mode),
    content: html,
  })
  editors.push(editor)
  return editor.getJSON()
}

const types = (node: { type?: string; content?: unknown[] }): string[] => [
  node.type ?? "",
  ...((node.content ?? []) as { type?: string; content?: unknown[] }[]).flatMap(
    types
  ),
]

describe("rich text editor schema = stored schema (spec §5.3)", () => {
  it("keeps every allowed node and mark, and the result validates", () => {
    const doc = parse(
      [
        "<h2>Title</h2><h3>Sub</h3>",
        '<p>Plain <strong>bold</strong> <em>italic</em> <a href="/contact">link</a><br>next</p>',
        '<ul><li><p>one</p></li></ul><ol start="3"><li><p>two</p></li></ol>',
        '<blockquote cite="Michael"><p>Quote</p></blockquote>',
        '<img data-media-id="00000000-0000-7000-8000-000000000001" alt="Hero">',
      ].join("")
    )
    expect(new Set(types(doc))).toEqual(
      new Set([
        "doc",
        "heading",
        "paragraph",
        "text",
        "hardBreak",
        "bulletList",
        "orderedList",
        "listItem",
        "blockquote",
        "image",
      ])
    )
    const parsed = richText.safeParse(doc)
    expect(parsed.success).toBe(true)
    const blocks = parsed.data!.content
    expect(blocks.find((b) => b.type === "blockquote")).toMatchObject({
      attrs: { cite: "Michael" },
    })
    expect(blocks.find((b) => b.type === "image")).toEqual({
      type: "image",
      attrs: {
        media: { mediaId: "00000000-0000-7000-8000-000000000001" },
        alt: "Hero",
      },
    })
  })

  it("strips what the site cannot render when pasted", () => {
    const doc = parse(
      [
        "<h1>Big</h1><h4>Small</h4>",
        "<pre><code>code()</code></pre><hr><p><s>strike</s> <u>under</u> <code>x</code></p>",
        "<table><tr><td>cell</td></tr></table>",
        '<img src="https://evil.example/x.png">',
        '<p><a href="javascript:alert(1)">bad</a></p>',
        "<ul><li><p>a</p><ul><li><p>nested</p></li></ul></li></ul>",
        "<blockquote><h2>no headings in quotes</h2></blockquote>",
      ].join("")
    )
    const all = types(doc)
    for (const banned of ["codeBlock", "horizontalRule", "table", "code"])
      expect(all).not.toContain(banned)
    expect(JSON.stringify(doc)).not.toContain("javascript:")
    expect(JSON.stringify(doc)).not.toContain("evil.example")
    expect(JSON.stringify(doc)).not.toMatch(/"type":"(strike|underline)"/)
    expect(richText.safeParse(doc).success).toBe(true)
  })

  it("paragraphs mode keeps only paragraphs (with bold, italic, links)", () => {
    const doc = parse(
      '<h2>Heading</h2><p><strong>B</strong> <a href="https://example.com">l</a></p><ul><li><p>item</p></li></ul>',
      "paragraphs"
    )
    expect(new Set(types(doc))).toEqual(new Set(["doc", "paragraph", "text"]))
    expect(paragraphsText.safeParse(doc).success).toBe(true)
  })

  it("emits exactly the stored shape (no editor-only attributes)", () => {
    const html =
      '<h2>T</h2><p><a href="https://example.com">l</a></p><ol start="2"><li><p>x</p></li></ol><blockquote><p>q</p></blockquote><img data-media-id="00000000-0000-7000-8000-000000000001" alt="A">'
    const doc = parse(html)
    // The stored schema strips unknown attrs; an editor doc must already be
    // in that shape, or reloading a saved draft would look like an edit.
    expect(richText.parse(doc)).toEqual(doc)
    expect(doc.content![1].content![0].marks).toEqual([
      { type: "link", attrs: { href: "https://example.com" } },
    ])
  })

  it("drops links the site would not render as written", () => {
    const doc = parse(
      [
        '<p><a href="{phone24hHref}">placeholder</a></p>',
        '<p><a href="//evil.example">protocol relative</a></p>',
        '<p><a href="data:text/html,x">data</a></p>',
        '<p><a href="mailto:info@example.com">mail</a> <a href="tel:+353">tel</a> <a href="#top">top</a></p>',
      ].join("")
    )
    const hrefs = JSON.stringify(doc).match(/"href":"[^"]*"/g)
    expect(hrefs).toEqual([
      '"href":"mailto:info@example.com"',
      '"href":"tel:+353"',
      '"href":"#top"',
    ])
  })

  it("keeps only library images whose id is a uuid", () => {
    const doc = parse(
      [
        '<img data-media-id="not-a-uuid" alt="Bad">',
        '<img data-media-id="" alt="Empty">',
        '<img data-media-id="00000000-0000-7000-8000-000000000001" alt="Good">',
      ].join("")
    )
    const images = doc.content!.filter((n) => n.type === "image")
    expect(images.map((n) => n.attrs!.alt)).toEqual(["Good"])
    expect(richText.safeParse(doc).success).toBe(true)
  })

  it("starts pasted ordered lists at 1 or more", () => {
    for (const [start, expected] of [
      ["0", 1],
      ["-4", 1],
      ["2.5", 1],
      ["junk", 1],
      ["7", 7],
    ] as const) {
      const doc = parse(`<ol start="${start}"><li><p>x</p></li></ol>`)
      expect(doc.content![0].attrs).toEqual({ start: expected })
      expect(richText.safeParse(doc).success).toBe(true)
    }
  })
})
