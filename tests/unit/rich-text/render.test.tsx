import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { replaceMediaRefs, type MediaView } from "@/lib/media"
import { ArticleBlocks, renderInline } from "@/lib/rich-text/render"
import {
  richText,
  type InlineNode,
  type RichTextDoc,
} from "@/lib/schemas/common"
import { articlesFixture } from "@/server/db/seed/fixtures/articles"
import {
  fixtureMediaKey,
  fixtureMediaLookup,
} from "@/server/db/seed/fixtures/media"

import { LegacyBlock, legacyBody } from "./legacy-article-block"

const staticMedia = (id: string): MediaView => ({
  id,
  url: fixtureMediaKey(id),
  alt: "",
  width: null,
  height: null,
  blurDataUrl: null,
})

const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>)

describe("TipTap JSON → article markup (ruling: renderer in Phase 3)", () => {
  it("renders the seeded article body exactly like the static site", () => {
    const article = articlesFixture(fixtureMediaLookup).find(
      (a) => a.slug === "mobile-patrols-protect-your-business-after-hours"
    )!
    const doc = replaceMediaRefs(article.content.body!, staticMedia)
    const legacy = html(
      legacyBody.map((block, i) => <LegacyBlock key={i} block={block} />)
    )
    expect(html(<ArticleBlocks doc={doc} />)).toBe(legacy)
  })

  it("renders a plain text node as a bare string", () => {
    expect(renderInline([{ type: "text", text: "Dinn Rí" }])).toBe("Dinn Rí")
    expect(renderInline(undefined)).toBeNull()
  })

  it("renders marks, links and line breaks", () => {
    expect(
      html(
        renderInline([
          { type: "text", text: "a", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          {
            type: "text",
            text: "b",
            marks: [
              { type: "italic" },
              { type: "link", attrs: { href: "/contact" } },
            ],
          },
        ])
      )
    ).toBe(
      '<strong>a</strong><br/><a href="/contact" class="font-bold text-brand-blue hover:underline"><em>b</em></a>'
    )
  })

  it("renders an unsafe link href (bypassing the schema) as #", () => {
    const unsafe = {
      type: "text",
      text: "x",
      marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
    } as InlineNode
    expect(html(renderInline([unsafe]))).toBe(
      '<a href="#" class="font-bold text-brand-blue hover:underline">x</a>'
    )
  })

  it("renders h3, ordered lists and a quote without cite", () => {
    const doc = richText.parse({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Sub" }],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "One" }] },
              ],
            },
          ],
        },
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Q" }] },
          ],
        },
      ],
    }) as RichTextDoc
    const out = html(<ArticleBlocks doc={replaceMediaRefs(doc, staticMedia)} />)
    expect(out).toContain(">Sub</h3>")
    expect(out).toContain("<li>One</li>")
    expect(out).toContain("“Q”</blockquote>")
    expect(out).not.toContain("figcaption")
  })
})
