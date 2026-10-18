import {
  type Attributes,
  type Extensions,
  mergeAttributes,
  Node,
  type NodeViewRenderer,
} from "@tiptap/core"
import { Blockquote } from "@tiptap/extension-blockquote"
import { Link } from "@tiptap/extension-link"
import { ListItem, OrderedList } from "@tiptap/extension-list"
import { Plugin } from "@tiptap/pm/state"
import { StarterKit } from "@tiptap/starter-kit"

import { isSafeRichTextHref } from "@/lib/href"

// The editor's schema is exactly what lib/schemas/common.ts accepts and
// lib/rich-text/render.tsx renders (spec §5.3): paragraph, h2/h3, bullet and
// ordered lists of paragraphs, blockquote (with cite) of paragraphs, image
// (media ref + alt), hard break, bold, italic, link. Anything else pasted in
// is dropped or flattened by ProseMirror's schema. Node and mark attributes
// are limited to the stored ones too, so `getJSON()` is already in the shape
// the API saves (no editor-only attrs that a save round trip would strip).

/** "full": articles and legal pages; "paragraphs": about copy, service overview. */
export type RichTextMode = "full" | "paragraphs"

/** A uuid as `mediaRef` (z.uuid()) accepts it; anything else is dropped. */
const MEDIA_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** attrs: { media: { mediaId }, alt } — same shape the renderer reads. */
export const MediaImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      media: {
        default: null,
        parseHTML: (element) => {
          const mediaId = element.getAttribute("data-media-id")
          return mediaId ? { mediaId } : null
        },
        renderHTML: (attrs) =>
          attrs.media ? { "data-media-id": attrs.media.mediaId } : {},
      },
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt") ?? "",
        renderHTML: (attrs) => ({ alt: attrs.alt }),
      },
    }
  },
  // Only library images survive a paste; arbitrary <img src> is dropped.
  parseHTML() {
    return [
      {
        tag: "img[data-media-id]",
        getAttrs: (element) =>
          MEDIA_ID.test(element.getAttribute("data-media-id") ?? "")
            ? null
            : false,
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)]
  },
})

/** List items hold paragraphs only (no nested lists). */
const ParagraphListItem = ListItem.extend({ content: "paragraph+" })

/** Ordered list with only the `start` the renderer uses (no list-style `type`). */
const StartOrderedList = OrderedList.extend({
  addAttributes() {
    return {
      // The stored schema needs an integer ≥ 1; pasted 0, negatives or junk
      // start at 1.
      start: {
        default: 1,
        parseHTML: (element) => {
          const start = Number(element.getAttribute("start") ?? 1)
          return Number.isInteger(start) && start >= 1 ? start : 1
        },
      },
    }
  },
  // Typing "0. " (input rule) or pasting a list numbered from 0 would set
  // start 0; the stored schema needs ≥ 1, so every transaction is fixed up.
  addProseMirrorPlugins() {
    const type = this.type
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((tr) => tr.docChanged)) return null
          const tr = state.tr
          state.doc.descendants((node, pos) => {
            const start = node.attrs.start as unknown
            if (
              node.type === type &&
              !(Number.isInteger(start) && (start as number) >= 1)
            )
              tr.setNodeAttribute(pos, "start", 1)
          })
          return tr.docChanged ? tr : null
        },
      }),
    ]
  },
})

/** Blockquote of paragraphs with an optional cite (the article quote design). */
const CiteBlockquote = Blockquote.extend({
  content: "paragraph+",
  addAttributes() {
    return {
      cite: {
        default: null,
        parseHTML: (element) => element.getAttribute("cite"),
        renderHTML: (attrs) => (attrs.cite ? { cite: attrs.cite } : {}),
      },
    }
  },
})

/**
 * Link mark storing `href` only (the renderer sets its own markup). Hrefs:
 * /path, #anchor, http(s), tel:, mailto: — rich text is not interpolated,
 * so anything with "{" or "}" would reach the site literally and is refused.
 */
const HrefLink = Link.extend({
  addAttributes() {
    const parent = (this.parent?.() ?? {}) as Partial<Attributes>
    return { href: parent.href ?? { default: null } }
  },
}).configure({
  openOnClick: false,
  autolink: true,
  defaultProtocol: "https",
  isAllowedUri: (url, ctx) =>
    ctx.defaultValidate(url) && isSafeRichTextHref(url),
})

/**
 * Extensions for one editor mode. `imageView` lets the admin editor render
 * library images through React (thumbnail lookup); headless use (tests,
 * Phase 5 paste checks) omits it.
 */
export function richTextExtensions(
  mode: RichTextMode,
  options: { imageView?: NodeViewRenderer } = {}
): Extensions {
  const common = {
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    underline: false,
    listItem: false,
    orderedList: false,
    blockquote: false,
    link: false,
    // A trailing empty paragraph would be saved and rendered on the site;
    // the gap cursor lets authors type after a final image instead.
    trailingNode: false,
  } as const
  if (mode === "paragraphs")
    return [
      StarterKit.configure({
        ...common,
        heading: false,
        bulletList: false,
        listKeymap: false,
      }),
      HrefLink,
    ]
  const image = options.imageView
    ? MediaImage.extend({ addNodeView: () => options.imageView! })
    : MediaImage
  return [
    StarterKit.configure({ ...common, heading: { levels: [2, 3] } }),
    HrefLink,
    ParagraphListItem,
    StartOrderedList,
    CiteBlockquote,
    image,
  ]
}
