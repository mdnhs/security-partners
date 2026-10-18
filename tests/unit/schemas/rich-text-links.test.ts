import { describe, expect, it } from "vitest"

import { isSafeRichTextHref } from "@/lib/href"
import { href, richText } from "@/lib/schemas/common"

const withLink = (target: string) => ({
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Call us",
          marks: [{ type: "link", attrs: { href: target } }],
        },
      ],
    },
  ],
})

describe("links inside rich text (ledger minor P03-7)", () => {
  it.each([
    "/contact",
    "#top",
    "https://www.securitypartnersltd.com/a?b=c",
    "tel:+353578662400",
    "mailto:info@example.ie",
  ])("accepts %s", (target) => {
    expect(isSafeRichTextHref(target)).toBe(true)
    expect(richText.safeParse(withLink(target)).success).toBe(true)
  })

  it.each([
    "{phone24hHref}",
    "tel:{phone24h}",
    "mailto:{email}",
    "/{x}",
    "javascript:alert(1)",
    "//evil.example",
  ])(
    "rejects %s (placeholders are not interpolated inside formatted text)",
    (target) => {
      expect(isSafeRichTextHref(target)).toBe(false)
      const result = richText.safeParse(withLink(target))
      expect(result.success).toBe(false)
    }
  )

  it("explains why a placeholder is refused", () => {
    const result = richText.safeParse(withLink("{phone24hHref}"))
    expect(result.error?.issues[0].message).toContain("placeholders")
  })

  it("link fields outside rich text still take whole placeholders (they are interpolated)", () => {
    expect(href.safeParse("{phone24hHref}").success).toBe(true)
  })
})
