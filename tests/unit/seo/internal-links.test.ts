import { describe, expect, it } from "vitest"

import type { RichTextDoc } from "@/lib/schemas/common"
import { countInternalLinks } from "@/lib/seo/internal-links"

const link = (href: string, text = "link") => ({
  type: "text" as const,
  text,
  marks: [{ type: "link" as const, attrs: { href } }],
})

const doc = (...hrefs: string[]): RichTextDoc => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "See " }, ...hrefs.map((h) => link(h))],
    },
  ],
})

describe("countInternalLinks (D1.2)", () => {
  it("counts site-relative links, not protocol-relative or external ones", () => {
    expect(countInternalLinks(doc("/contact"))).toBe(1)
    expect(countInternalLinks(doc("/services/alarm-responses", "/"))).toBe(2)
    expect(countInternalLinks(doc("//evil.example/x"))).toBe(0)
    expect(countInternalLinks(doc("https://example.org/x"))).toBe(0)
    expect(
      countInternalLinks(doc("#top", "mailto:a@b.ie", "tel:+353000"))
    ).toBe(0)
    expect(countInternalLinks(doc())).toBe(0)
  })

  it("an absolute link to the site's own origin counts", () => {
    expect(
      countInternalLinks(
        doc("https://securitypartners.ie/about"),
        "https://securitypartners.ie"
      )
    ).toBe(1)
    expect(
      countInternalLinks(
        doc("https://securitypartners.ie.evil.example/about"),
        "https://securitypartners.ie"
      )
    ).toBe(0)
  })

  it("finds links in headings, lists and quotes", () => {
    const d: RichTextDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [link("/a")] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [link("/b")] }],
            },
          ],
        },
        {
          type: "blockquote",
          content: [{ type: "paragraph", content: [link("/c")] }],
        },
        { type: "paragraph" },
      ],
    }
    expect(countInternalLinks(d)).toBe(3)
  })
})
