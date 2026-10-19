import { type BuilderDocument, emptyBlock } from "@/blocks/document"
import {
  BLOCK_BY_TYPE,
  type BlockData,
  type BlockInstance,
  type BlockType,
} from "@/blocks/registry"
import type { IconCard, MediaRef, PageHero } from "@/lib/schemas/common"
import { type PageData, type PageKey, PAGES } from "@/templates/registry"

// "Copy to new page" (spec §7.5): a fixed page's sections as builder blocks,
// in the order the fixed page renders them, carrying the page's own copy.
// The result seeds a NEW /p/<slug> page; the fixed page is never touched.
// Copy longer than a block allows is cut to fit and lists are cut to the
// block's maximum, so every copy publishes as is.

/** Block caps (blocks/registry.ts) the copy is cut to. */
const HERO = { crumb: 40, title: 80, description: 240 }
const SECTION = { eyebrow: 40, heading: 80, intro: 240 }
const CARDS = { eyebrow: 40, title: 80, description: 240, items: 6 }
const STAT = { value: 12, label: 40, description: 160, items: 4 }
const DEPARTMENT = {
  title: 40,
  name: 80,
  role: 80,
  line: 120,
  lines: 4,
  items: 6,
}
const MAX_SERVICES = 12
const MAX_POSTS = 6

const clip = (value: string, max: number) =>
  value.length > max ? value.slice(0, max) : value

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
    items: section.items.slice(0, CARDS.items).map((item) => ({
      ...item,
      icon: media(item.icon),
      title: clip(item.title, CARDS.title),
      description: clip(item.description, CARDS.description),
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
          heading: clip(page.team.heading, SECTION.heading),
          intro: clip(page.team.intro, SECTION.intro),
        }),
        part("blog", {
          heading: clip(page.blog.heading, SECTION.heading),
          intro: clip(page.blog.intro, SECTION.intro),
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
          items: page.stats.slice(0, STAT.items).map((stat) => ({
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
          heading: clip(page.leadership.heading, SECTION.heading),
          intro: clip(page.leadership.intro, SECTION.intro),
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
          heading: clip(page.hero.title, SECTION.heading),
          intro: clip(page.hero.description, SECTION.intro),
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
          eyebrow: clip(departments.eyebrow, SECTION.eyebrow),
          heading: clip(departments.heading, SECTION.heading),
          intro: clip(departments.intro, SECTION.intro),
          items: departments.items.slice(0, DEPARTMENT.items).map((item) => ({
            title: clip(item.title, DEPARTMENT.title),
            icon: media(item.icon),
            name: clip(item.name, DEPARTMENT.name),
            role: clip(item.role, DEPARTMENT.role),
            lines: item.lines.slice(0, DEPARTMENT.lines).map((line) => ({
              text: clip(line.text, DEPARTMENT.line),
              href: line.href,
            })),
          })),
        }),
        shared("map"),
      ]
    }
    case "legal": {
      const page = data as PageData<"privacy">
      return [heroOf(page.hero), part("richtext", { doc: page.body })]
    }
  }
}

/**
 * A fixed page as a builder document: fresh block ids, each block's own
 * anchor (owning blocks keep their section id: #about, #services …).
 */
export function blocksFromTemplate<K extends PageKey>(
  key: K,
  data: PageData<K>
): BuilderDocument {
  const blocks: BlockInstance[] = []
  for (const { type, data: blockData } of partsOf(key, data)) {
    const block = emptyBlock(type, { blocks })
    blocks.push({
      ...block,
      data: structuredClone(blockData),
    } as BlockInstance)
  }
  return { blocks }
}

/** The suggested title and address of a copy ("About copy", about-copy). */
export const copyTitle = (label: string) => `${label} copy`
export const copySlug = (key: PageKey | string) => `${key}-copy`

/** Labels of the blocks a copy holds, for the copy dialog. */
export const blockLabels = (doc: BuilderDocument) =>
  doc.blocks.map((block) => BLOCK_BY_TYPE[block.type].label)
