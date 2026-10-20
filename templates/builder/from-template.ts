import { type BuilderDocument, emptyBlock } from "@/blocks/document"
import type { z } from "zod"

import {
  BLOCK_BY_TYPE,
  type BlockData,
  type BlockInstance,
  type BlockType,
  RICH_TEXT_MAX_CHARS,
  RICH_TEXT_MAX_NODES,
} from "@/blocks/registry"
import type {
  IconCard,
  MediaRef,
  PageHero,
  RichTextDoc,
} from "@/lib/schemas/common"
import { type PageData, type PageKey, PAGES } from "@/templates/registry"

// "Copy to new page" (spec §7.5): a fixed page's sections as builder blocks,
// in the order the fixed page renders them, carrying the page's own copy.
// The result seeds a NEW /p/<slug> page; the fixed page is never touched.
// Copy longer than a block allows is cut to fit and lists are cut to the
// block's maximum, so every copy publishes as is.

// Block caps, read from the block schemas (blocks/registry.ts) so a cap
// changed there is the cap the copy is cut to (review D5.5 M2).
type Shape = Record<string, z.ZodType>
const shapeOf = (type: BlockType): Shape =>
  (BLOCK_BY_TYPE[type].schema as unknown as z.ZodObject).shape as Shape
const elementOf = (list: z.ZodType): Shape =>
  ((list as z.ZodArray<z.ZodObject>).element as z.ZodObject).shape as Shape
const maxLength = (schema: z.ZodType): number =>
  (schema as z.ZodString).maxLength ?? Number.POSITIVE_INFINITY
const maxValue = (schema: z.ZodType): number =>
  (schema as z.ZodNumber).maxValue ?? Number.POSITIVE_INFINITY
const capsOf = (shape: Shape) =>
  Object.fromEntries(
    Object.entries(shape).map(([key, schema]) => [key, maxLength(schema)])
  ) as Record<string, number>

const HERO = capsOf(shapeOf("hero.page"))
const SECTION = capsOf(shapeOf("services"))
const TEAM = capsOf(shapeOf("team"))
const BLOG = capsOf(shapeOf("blog"))
const CARDS = capsOf(shapeOf("iconCards"))
const CARD = capsOf(elementOf(shapeOf("iconCards").items))
const STAT = capsOf(elementOf(shapeOf("stats").items))
const DEPARTMENTS = capsOf(shapeOf("departments"))
const DEPARTMENT = capsOf(elementOf(shapeOf("departments").items))
const LINE = capsOf(elementOf(elementOf(shapeOf("departments").items).lines))
/**
 * List maxima of the blocks. zod keeps no readable array maximum, so these
 * are pinned against the schemas by tests/unit/builder/from-template.test.
 */
export const COPY_LIST_MAX = {
  iconCards: 6,
  stats: 4,
  departments: 6,
  departmentLines: 4,
} as const
const MAX_SERVICES = maxValue(shapeOf("services").count)
const MAX_POSTS = maxValue(shapeOf("blog").count)

/** What a copy had to leave out (shown in the copy dialog). */
let cutCopy = false
let cutLists = false
let cutText = false

/**
 * At most `max` UTF-16 units (zod's and the server's measure), never ending
 * on half of a surrogate pair: a lone surrogate is refused by jsonb.
 */
export function sliceUnits(value: string, max: number): string {
  if (value.length <= max) return value
  let end = Math.max(0, max)
  const last = value.charCodeAt(end - 1)
  if (end > 0 && last >= 0xd800 && last <= 0xdbff) end -= 1
  return value.slice(0, end)
}

const clip = (value: string, max: number) => {
  if (value.length <= max) return value
  cutCopy = true
  return sliceUnits(value, max)
}
const take = <T>(list: T[], max: number): T[] => {
  if (list.length > max) cutLists = true
  return list.slice(0, max)
}

/**
 * A legal body cut to one Text block (RICH_TEXT_MAX_NODES top-level nodes,
 * RICH_TEXT_MAX_CHARS of JSON): its first part (review D5.5 M3).
 */
function capRichText(doc: RichTextDoc): RichTextDoc {
  const size = (content: RichTextDoc["content"]) =>
    JSON.stringify({ ...doc, content }).length
  let content = doc.content.slice(0, RICH_TEXT_MAX_NODES)
  while (content.length > 1 && size(content) > RICH_TEXT_MAX_CHARS)
    content = content.slice(0, -1)
  if (content.length < doc.content.length) cutText = true
  // One node alone is still too long (review D5.5 N1): shorten its text.
  if (size(content) > RICH_TEXT_MAX_CHARS) {
    cutText = true
    content = [shortenNode(content[0], (node) => size([node]))]
  }
  return { ...doc, content }
}

type TextLeaf = { type: "text"; text: string }
type RichNode = RichTextDoc["content"][number]

/** Every text leaf of a node (the objects themselves, for trimming). */
function textLeaves(node: unknown, out: TextLeaf[] = []): TextLeaf[] {
  if (!node || typeof node !== "object") return out
  const value = node as { type?: unknown; text?: unknown; content?: unknown }
  if (value.type === "text" && typeof value.text === "string")
    out.push(value as TextLeaf)
  if (Array.isArray(value.content))
    for (const child of value.content) textLeaves(child, out)
  return out
}

/**
 * A node cut until `size(node)` fits: its longest text is shortened first
 * (formatting kept, every text at least one character). If that cannot be
 * enough, its plain text in one paragraph, cut to fit.
 */
function shortenNode(node: RichNode, size: (node: RichNode) => number) {
  const copy = structuredClone(node)
  const leaves = textLeaves(copy)
  while (size(copy) > RICH_TEXT_MAX_CHARS) {
    const longest = leaves.reduce<TextLeaf | null>(
      (best, leaf) =>
        !best || leaf.text.length > best.text.length ? leaf : best,
      null
    )
    if (!longest || longest.text.length <= 1) break
    const over = size(copy) - RICH_TEXT_MAX_CHARS
    const next = sliceUnits(
      longest.text,
      Math.max(1, longest.text.length - over - 1)
    )
    // One astral character left: it cannot be cut further without a split.
    if (next.length === 0 || next.length === longest.text.length) break
    longest.text = next
  }
  if (size(copy) <= RICH_TEXT_MAX_CHARS) return copy
  const plain = textLeaves(node)
    .map((leaf) => leaf.text)
    .join(" ")
  const paragraph = (text: string): RichNode => ({
    type: "paragraph",
    content: [{ type: "text", text: text || " " }],
  })
  let text = sliceUnits(plain, RICH_TEXT_MAX_CHARS)
  while (text.length > 1 && size(paragraph(text)) > RICH_TEXT_MAX_CHARS)
    text = sliceUnits(
      text,
      text.length - (size(paragraph(text)) - RICH_TEXT_MAX_CHARS) - 1
    )
  return paragraph(text)
}

const media = (ref: MediaRef): MediaRef => ({ ...ref })

type Part = { [T in BlockType]: { type: T; data: BlockData<T> } }[BlockType]

const part = <T extends BlockType>(type: T, data: BlockData<T>) =>
  ({ type, data }) as Part

const shared = (type: "enquireBanner" | "clients" | "contact" | "map") =>
  part(type, { useShared: true })

function heroOf(hero: PageHero): Part {
  return part("hero.page", {
    image: media(hero.image),
    crumb: clip(hero.crumb, HERO.crumb),
    title: clip(hero.title, HERO.title),
    description: clip(hero.description, HERO.description),
  })
}

function iconCardsOf(section: {
  eyebrow: string
  title: string
  description: string
  items: IconCard[]
}): Part {
  return part("iconCards", {
    eyebrow: clip(section.eyebrow, CARDS.eyebrow),
    title: clip(section.title, CARDS.title),
    description: clip(section.description, CARDS.description),
    items: take(section.items, COPY_LIST_MAX.iconCards).map((item) => ({
      ...item,
      icon: media(item.icon),
      title: clip(item.title, CARD.title),
      description: clip(item.description, CARD.description),
    })),
  })
}

function servicesOf(copy: {
  eyebrow: string
  heading: string
  intro: string
}): Part {
  return part("services", {
    eyebrow: clip(copy.eyebrow, SECTION.eyebrow),
    heading: clip(copy.heading, SECTION.heading),
    intro: clip(copy.intro, SECTION.intro),
    // The fixed pages list every published service.
    count: MAX_SERVICES,
  })
}

/** Each fixed page's sections, in its render order (templates/<name>/render.tsx). */
function partsOf(key: PageKey, data: PageData<PageKey>): Part[] {
  const template = PAGES[key]
  switch (template) {
    case "home": {
      const page = data as PageData<"home">
      // The home hero is not a builder block: a page hero with its image,
      // heading and subheading.
      return [
        part("hero.page", {
          image: media(page.hero.backgroundImage),
          crumb: clip(page.hero.heading, HERO.crumb),
          title: clip(page.hero.heading, HERO.title),
          description: clip(page.hero.subheading, HERO.description),
        }),
        part("about", { useShared: true }),
        servicesOf(page.services),
        shared("enquireBanner"),
        shared("clients"),
        part("team", {
          heading: clip(page.team.heading, TEAM.heading),
          intro: clip(page.team.intro, TEAM.intro),
        }),
        part("blog", {
          heading: clip(page.blog.heading, BLOG.heading),
          intro: clip(page.blog.intro, BLOG.intro),
          count: Math.min(page.blog.count, MAX_POSTS),
        }),
        shared("contact"),
        shared("map"),
      ]
    }
    case "about": {
      const page = data as PageData<"about">
      return [
        heroOf(page.hero),
        part("about", { useShared: true }),
        part("stats", {
          items: take(page.stats, COPY_LIST_MAX.stats).map((stat) => ({
            value: clip(stat.value, STAT.value),
            label: clip(stat.label, STAT.label),
            description: clip(stat.description, STAT.description),
          })),
        }),
        iconCardsOf(page.values),
        shared("clients"),
        shared("enquireBanner"),
      ]
    }
    case "services": {
      const page = data as PageData<"services">
      return [
        heroOf(page.hero),
        servicesOf(page.servicesSection),
        part("whyChooseUs", { useShared: true }),
        shared("clients"),
        shared("enquireBanner"),
      ]
    }
    case "team": {
      const page = data as PageData<"team">
      return [
        heroOf(page.hero),
        part("team", {
          heading: clip(page.leadership.heading, TEAM.heading),
          intro: clip(page.leadership.intro, TEAM.intro),
        }),
        iconCardsOf({ ...page.officers, items: page.officers.qualities }),
        shared("enquireBanner"),
      ]
    }
    case "blog": {
      const page = data as PageData<"blog">
      // The blog block is the latest-posts strip: headed by the hero's copy.
      return [
        heroOf(page.hero),
        part("blog", {
          heading: clip(page.hero.title, BLOG.heading),
          intro: clip(page.hero.description, BLOG.intro),
          count: Math.min(page.pageSize, MAX_POSTS),
        }),
        shared("enquireBanner"),
      ]
    }
    case "contact": {
      const page = data as PageData<"contact">
      const departments = page.departments
      return [
        heroOf(page.hero),
        shared("contact"),
        part("departments", {
          eyebrow: clip(departments.eyebrow, DEPARTMENTS.eyebrow),
          heading: clip(departments.heading, DEPARTMENTS.heading),
          intro: clip(departments.intro, DEPARTMENTS.intro),
          items: take(departments.items, COPY_LIST_MAX.departments).map(
            (item) => ({
              title: clip(item.title, DEPARTMENT.title),
              icon: media(item.icon),
              name: clip(item.name, DEPARTMENT.name),
              role: clip(item.role, DEPARTMENT.role),
              lines: take(item.lines, COPY_LIST_MAX.departmentLines).map(
                (line) => ({
                  text: clip(line.text, LINE.text),
                  href: line.href,
                })
              ),
            })
          ),
        }),
        shared("map"),
      ]
    }
    case "legal": {
      const page = data as PageData<"privacy">
      return [
        heroOf(page.hero),
        part("richtext", { doc: capRichText(page.body) }),
      ]
    }
  }
}

export type TemplateCopy = { doc: BuilderDocument; notes: string[] }

/**
 * A fixed page as a builder document: fresh block ids, each block's own
 * anchor (owning blocks keep their section id: #about, #services …), and
 * notes on anything that had to be cut to fit the blocks.
 */
export function copyFromTemplate<K extends PageKey>(
  key: K,
  data: PageData<K>
): TemplateCopy {
  cutCopy = cutLists = cutText = false
  const blocks: BlockInstance[] = []
  for (const { type, data: blockData } of partsOf(key, data)) {
    const block = emptyBlock(type, { blocks })
    blocks.push({
      ...block,
      data: structuredClone(blockData),
    } as BlockInstance)
  }
  const notes = [
    cutText
      ? "The text is longer than one Text block holds: only its first part is copied. Add another Text block for the rest."
      : null,
    cutCopy
      ? "Some copy is longer than its block allows and is shortened."
      : null,
    cutLists
      ? "Some lists have more items than their block shows: the extra items are left out."
      : null,
  ].filter((note): note is string => note !== null)
  return { doc: { blocks }, notes }
}

/** copyFromTemplate without the notes. */
export function blocksFromTemplate<K extends PageKey>(
  key: K,
  data: PageData<K>
): BuilderDocument {
  return copyFromTemplate(key, data).doc
}

/** The suggested title and address of a copy ("About copy", about-copy). */
export const copyTitle = (label: string) => `${label} copy`
export const copySlug = (key: PageKey | string) => `${key}-copy`

/** Labels of the blocks a copy holds, for the copy dialog. */
export const blockLabels = (doc: BuilderDocument) =>
  doc.blocks.map((block) => BLOCK_BY_TYPE[block.type].label)
