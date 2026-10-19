// The internal-link check (spec §7.1): links from rich text to other pages
// of the site. Isomorphic.

import type {
  InlineNode,
  RichTextBlock,
  RichTextDoc,
} from "@/lib/schemas/common"

function inlineNodes(block: RichTextBlock): InlineNode[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return block.content ?? []
    case "bulletList":
    case "orderedList":
      return block.content.flatMap((item) =>
        item.content.flatMap((p) => p.content ?? [])
      )
    case "blockquote":
      return block.content.flatMap((p) => p.content ?? [])
    case "image":
      return []
  }
}

function isInternal(href: string, origin: string | undefined): boolean {
  if (href.startsWith("/")) return !href.startsWith("//")
  if (!origin) return false
  try {
    return new URL(href).origin === new URL(origin).origin
  } catch {
    return false
  }
}

/**
 * Link marks whose href is site-relative ("/…", not "//…") or on the site's
 * own `origin` (when given).
 */
export function countInternalLinks(doc: RichTextDoc, origin?: string): number {
  let n = 0
  for (const block of doc.content)
    for (const node of inlineNodes(block))
      if (node.type === "text")
        for (const mark of node.marks ?? [])
          if (mark.type === "link" && isInternal(mark.attrs.href, origin)) n++
  return n
}
