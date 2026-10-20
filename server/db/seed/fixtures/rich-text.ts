import "server-only"

import type {
  MediaRef,
  ParagraphNode,
  ParagraphsDoc,
  RichTextBlock,
  RichTextDoc,
} from "@/lib/schemas/common"

// Tiny builders for TipTap JSON in fixtures (plain text, no marks).

export const paragraph = (text: string): ParagraphNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
})

export const doc = (...content: RichTextBlock[]): RichTextDoc => ({
  type: "doc",
  content,
})

/** A doc of plain paragraphs. */
export const paragraphs = (...texts: string[]): ParagraphsDoc => ({
  type: "doc",
  content: texts.map(paragraph),
})

export const heading2 = (text: string): RichTextBlock => ({
  type: "heading",
  attrs: { level: 2 },
  content: [{ type: "text", text }],
})

export const bulletList = (...items: string[]): RichTextBlock => ({
  type: "bulletList",
  content: items.map((item) => ({
    type: "listItem",
    content: [paragraph(item)],
  })),
})

export const quote = (text: string, cite: string): RichTextBlock => ({
  type: "blockquote",
  attrs: { cite },
  content: [paragraph(text)],
})

export const image = (media: MediaRef, alt: string): RichTextBlock => ({
  type: "image",
  attrs: { media, alt },
})
