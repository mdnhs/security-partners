import { Fragment, type ReactNode } from "react"
import Image from "next/image"
import type { JSONContent } from "@tiptap/core"

import { isSafeHref } from "@/lib/href"
import { UNSAFE_HREF_FALLBACK } from "@/lib/interpolate"
import type { WithMedia } from "@/lib/media"
import type {
  InlineNode,
  ParagraphNode,
  RichTextBlock,
  RichTextDoc,
} from "@/lib/schemas/common"

// Server-safe TipTap JSON → React for the public site. Article blocks
// reproduce the static site's ArticleBody markup exactly (Phase 5 adds the
// editor on top of the same JSON).

/** Stored docs are valid TipTap content (the editor loads them as is). */
export function toJSONContent(doc: RichTextDoc): JSONContent {
  return doc
}

function withMarks(node: Extract<InlineNode, { type: "text" }>): ReactNode {
  let out: ReactNode = node.text
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") out = <strong>{out}</strong>
    else if (mark.type === "italic") out = <em>{out}</em>
    else
      out = (
        <a
          // Validated on write; re-checked so a bad row never renders.
          href={
            isSafeHref(mark.attrs.href) ? mark.attrs.href : UNSAFE_HREF_FALLBACK
          }
          className="font-bold text-brand-blue hover:underline"
        >
          {out}
        </a>
      )
  }
  return out
}

/**
 * Inline content. A single unmarked text node renders as a bare string, so
 * seeded copy produces exactly the text node the static site rendered.
 */
export function renderInline(nodes: InlineNode[] | undefined): ReactNode {
  if (!nodes?.length) return null
  if (nodes.length === 1 && nodes[0].type === "text" && !nodes[0].marks?.length)
    return nodes[0].text
  return nodes.map((node, i) => (
    <Fragment key={i}>
      {node.type === "hardBreak" ? <br /> : withMarks(node)}
    </Fragment>
  ))
}

/** Several paragraphs inside one element (list items, quotes) separated by line breaks. */
function renderParagraphs(paragraphs: ParagraphNode[]): ReactNode {
  if (paragraphs.length === 1) return renderInline(paragraphs[0].content)
  return paragraphs.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {renderInline(p.content)}
    </Fragment>
  ))
}

const paragraphClass = "text-lg leading-[1.75] text-[#3b4556]"

function ArticleBlock({ block }: { block: WithMedia<RichTextBlock> }) {
  switch (block.type) {
    case "paragraph":
      return <p className={paragraphClass}>{renderInline(block.content)}</p>
    case "heading":
      return block.attrs.level === 2 ? (
        <h2 className="mt-7 text-[26px] leading-[1.25] font-black tracking-[-0.005em] text-brand-navy md:text-[30px]">
          {renderInline(block.content)}
        </h2>
      ) : (
        <h3 className="mt-5 text-[22px] leading-[1.3] font-black text-brand-navy md:text-[24px]">
          {renderInline(block.content)}
        </h3>
      )
    case "bulletList":
      return (
        <ul className="flex flex-col gap-3.5">
          {block.content.map((item, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <Image
                src="/images/check.svg"
                alt=""
                width={24}
                height={24}
                className="shrink-0"
              />
              <span className="text-[17px] leading-normal font-medium text-brand-navy">
                {renderParagraphs(item.content)}
              </span>
            </li>
          ))}
        </ul>
      )
    case "orderedList":
      return (
        <ol
          start={block.attrs?.start}
          className="flex list-decimal flex-col gap-3.5 pl-6 text-[17px] leading-normal font-medium text-brand-navy"
        >
          {block.content.map((item, i) => (
            <li key={i}>{renderParagraphs(item.content)}</li>
          ))}
        </ol>
      )
    case "blockquote":
      return (
        <figure className="flex flex-col gap-3 rounded-[20px] border-l-5 border-brand-green bg-brand-mint px-7 py-8 font-bold md:px-9">
          <blockquote className="text-xl leading-normal text-brand-navy md:text-[22px]">
            “{renderParagraphs(block.content)}”
          </blockquote>
          {block.attrs?.cite && (
            <figcaption className="text-sm leading-[normal] text-brand-green-dark">
              {block.attrs.cite}
            </figcaption>
          )}
        </figure>
      )
    case "image":
      return (
        <div className="relative h-64 overflow-hidden rounded-3xl md:h-[400px]">
          <Image
            src={block.attrs.media.url}
            alt={block.attrs.alt}
            fill
            sizes="(min-width: 1280px) 776px, 100vw"
            className="object-cover"
          />
        </div>
      )
  }
}

/** Article body blocks (also the legal pages), as siblings in the article column. */
export function ArticleBlocks({ doc }: { doc: WithMedia<RichTextDoc> }) {
  return doc.content.map((block, i) => <ArticleBlock key={i} block={block} />)
}
