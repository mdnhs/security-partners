import type {
  InlineNode,
  ParagraphNode,
  RichTextBlock,
  RichTextDoc,
} from "@/lib/schemas/common"

// "N min read" for articles (spec §5.3: computed from the body).

export const WORDS_PER_MINUTE = 200

/** Words in plain text: runs of non-whitespace (no-break spaces separate too). */
export function countTextWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/** Rounded up, at least one minute. */
export function minutesFor(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

// Text nodes of one block join without a separator (marks may split a
// word); a hard break separates like a space.
function inlineText(nodes: InlineNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => (node.type === "text" ? node.text : " "))
    .join("")
}

function paragraphsText(paragraphs: ParagraphNode[]): string {
  return paragraphs.map((p) => inlineText(p.content)).join(" ")
}

function blockText(block: RichTextBlock): string {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return inlineText(block.content)
    case "bulletList":
    case "orderedList":
      return block.content.map((item) => paragraphsText(item.content)).join(" ")
    case "blockquote":
      // The cite is attribution, not reading.
      return paragraphsText(block.content)
    case "image":
      return ""
  }
}

/** Words a reader reads: every block's text (image alt and quote cite excluded). */
export function countWords(doc: RichTextDoc | null): number {
  if (!doc) return 0
  return countTextWords(doc.content.map(blockText).join(" "))
}

/** Minutes at 200 words per minute; null without a body (not shown). */
export function readTimeMinutes(doc: RichTextDoc | null): number | null {
  if (!doc) return null
  return minutesFor(countWords(doc))
}

/** No words and no images: what an emptied editor leaves behind. */
export function isEmptyDoc(doc: RichTextDoc | null): boolean {
  if (!doc) return true
  return (
    countWords(doc) === 0 &&
    !doc.content.some((block) => block.type === "image")
  )
}
