import { describe, expect, it } from "vitest"

import {
  href,
  link,
  mediaRef,
  richText,
  slug,
  text,
} from "@/lib/schemas/common"

const ok = (
  schema: { safeParse: (v: unknown) => { success: boolean } },
  v: unknown
) => schema.safeParse(v).success

describe("slug", () => {
  it.each(["a", "alarm-responses", "inside-our-24-7-operations-team", "x1-2y"])(
    "accepts %s",
    (value) => expect(ok(slug, value)).toBe(true)
  )
  it.each(["", "-a", "a-", "a--b", "A-b", "a_b", "a b", "ä"])(
    "rejects %j",
    (value) => expect(ok(slug, value)).toBe(false)
  )
})

describe("href / link", () => {
  it.each([
    "/about",
    "/services/alarm-responses",
    "#services",
    "#",
    "https://www.mjseco.ie",
    "http://example.ie/x?y=1",
    "tel:+353858018746",
    "mailto:info@securitypartnersltd.com",
    "{phone24hHref}",
    "mailto:{operationsEmail}",
    "https://www.facebook.com/sharer/sharer.php?u={url}",
  ])("accepts %s", (value) => expect(ok(href, value)).toBe(true))

  it.each([
    "",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,x",
    "//evil.example",
    "ftp://x.ie",
    "about",
    "{not a placeholder}",
  ])("rejects %j", (value) => expect(ok(href, value)).toBe(false))

  it("link needs a label and a safe href", () => {
    expect(ok(link, { label: "About", href: "/about" })).toBe(true)
    expect(ok(link, { label: "", href: "/about" })).toBe(false)
    expect(ok(link, { label: "x", href: "javascript:void(0)" })).toBe(false)
  })
})

describe("text: no whitespace normalisation (Review Focus 1)", () => {
  it.each([
    "Monday–Friday, 9am to 6pm",
    "Mountmellick, Co. Laois  •  Since 2008",
    "Read Article  →",
    "News & insights",
    "Dinn Rí",
    "We are dedicated to safeguarding our clients' business",
    "   ·   ",
    "line one\nline two",
  ])("round-trips %j unchanged", (value) => {
    expect(text.parse(value)).toBe(value)
  })
})

describe("mediaRef", () => {
  it("requires a uuid", () => {
    expect(
      ok(mediaRef, { mediaId: "0199a0b2-4c1d-7e3f-8a5b-0123456789ab" })
    ).toBe(true)
    expect(ok(mediaRef, { mediaId: "/images/hero.jpg" })).toBe(false)
  })
})

describe("richText (TipTap subset, spec §5.3)", () => {
  const media = { mediaId: "0199a0b2-4c1d-7e3f-8a5b-0123456789ab" }
  const doc = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Plain " },
          { type: "text", text: "bold", marks: [{ type: "bold" }] },
          { type: "hardBreak" },
          {
            type: "text",
            text: "link",
            marks: [
              { type: "italic" },
              { type: "link", attrs: { href: "/contact" } },
            ],
          },
        ],
      },
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "H2" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "H3" }],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "Item" }] },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        attrs: { start: 1 },
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
        attrs: { cite: "Ops" },
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Quote" }] },
        ],
      },
      { type: "image", attrs: { media, alt: "Officer" } },
    ],
  }

  it("accepts every allowed node and round-trips unchanged", () => {
    expect(richText.parse(doc)).toEqual(doc)
  })

  it.each([
    ["h1", { type: "heading", attrs: { level: 1 }, content: [] }],
    ["code block", { type: "codeBlock", content: [] }],
    ["horizontal rule", { type: "horizontalRule" }],
    [
      "image by URL",
      { type: "image", attrs: { src: "/images/x.png", alt: "" } },
    ],
  ])("rejects %s", (_, block) => {
    expect(ok(richText, { type: "doc", content: [block] })).toBe(false)
  })

  it("rejects unknown marks and javascript: links", () => {
    const withMark = (m: unknown) => ({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [m] }],
        },
      ],
    })
    expect(ok(richText, withMark({ type: "strike" }))).toBe(false)
    expect(
      ok(
        richText,
        withMark({ type: "link", attrs: { href: "javascript:alert(1)" } })
      )
    ).toBe(false)
  })

  it("rejects an empty document", () => {
    expect(ok(richText, { type: "doc", content: [] })).toBe(false)
  })
})
