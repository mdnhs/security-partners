import { describe, expect, it } from "vitest"

import {
  countTextWords,
  countWords,
  isEmptyDoc,
  minutesFor,
  readTimeMinutes,
} from "@/lib/rich-text/read-time"
import type { RichTextDoc } from "@/lib/schemas/common"

const text = (value: string) => ({ type: "text" as const, text: value })
const paragraph = (value: string) => ({
  type: "paragraph" as const,
  content: [text(value)],
})
const doc = (...content: RichTextDoc["content"]): RichTextDoc => ({
  type: "doc",
  content,
})
const words = (n: number) =>
  Array.from({ length: n }, (_, i) => `word${i}`).join(" ")

describe("read time (master 5.1: 200 words per minute, at least 1)", () => {
  it("rounds up and never shows less than a minute", () => {
    expect(minutesFor(1)).toBe(1)
    expect(minutesFor(200)).toBe(1)
    expect(minutesFor(201)).toBe(2)
    expect(minutesFor(450)).toBe(3)
    expect(readTimeMinutes(doc(paragraph(words(450))))).toBe(3)
    expect(readTimeMinutes(doc(paragraph("Hi")))).toBe(1)
  })

  it("has no read time without a body", () => {
    expect(readTimeMinutes(null)).toBeNull()
    expect(countWords(null)).toBe(0)
  })

  it("counts every block's text; marks inside a word do not split it", () => {
    const body = doc(
      {
        type: "heading",
        attrs: { level: 2 },
        content: [text("Two words")],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hel", marks: [{ type: "bold" }] },
          text("lo world"),
          { type: "hardBreak" },
          text("again"),
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [paragraph("one item")] },
          { type: "listItem", content: [paragraph("two")] },
        ],
      },
      {
        type: "blockquote",
        attrs: { cite: "Not counted at all" },
        content: [paragraph("quoted words")],
      },
      {
        type: "image",
        attrs: {
          media: { mediaId: "00000000-0000-7000-8000-000000000001" },
          alt: "Alt text is not read",
        },
      }
    )
    // 2 + 3 (Hello world again) + 3 + 2
    expect(countWords(body)).toBe(10)
  })

  it("treats any whitespace (incl. no-break space) as a separator, keeps en-dashes", () => {
    expect(countTextWords("Monday–Friday  9 to 5\n")).toBe(4)
    expect(countTextWords("   ")).toBe(0)
  })

  it("knows an empty editor document", () => {
    expect(isEmptyDoc(null)).toBe(true)
    expect(isEmptyDoc(doc({ type: "paragraph" }))).toBe(true)
    expect(isEmptyDoc(doc(paragraph("  ")))).toBe(true)
    expect(isEmptyDoc(doc(paragraph("x")))).toBe(false)
    expect(
      isEmptyDoc(
        doc({
          type: "image",
          attrs: {
            media: { mediaId: "00000000-0000-7000-8000-000000000001" },
            alt: "",
          },
        })
      )
    ).toBe(false)
  })
})
