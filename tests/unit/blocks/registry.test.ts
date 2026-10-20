import { describe, expect, it } from "vitest"

import {
  Anchor,
  BLOCK_BY_TYPE,
  BLOCKS,
  BlockId,
  BlockInstance,
  type BlockType,
} from "@/blocks/registry"

const TYPES: BlockType[] = [
  "hero.page",
  "about",
  "stats",
  "iconCards",
  "services",
  "whyChooseUs",
  "enquireBanner",
  "clients",
  "team",
  "blog",
  "departments",
  "contact",
  "map",
  "richtext",
]

const MEDIA = "0b8a3c4e-1f2d-4a5b-8c6d-7e8f9a0b1c2d"

describe("block registry", () => {
  it("every block type has a definition and a unique label", () => {
    expect(BLOCKS.map((b) => b.type).sort()).toEqual([...TYPES].sort())
    const labels = BLOCKS.map((b) => b.label)
    expect(new Set(labels).size).toBe(labels.length)
    for (const type of TYPES) {
      const def = BLOCK_BY_TYPE[type]
      expect(def.type).toBe(type)
      expect(def.label.length).toBeGreaterThan(0)
      expect(def.description.length).toBeGreaterThan(0)
      expect(def.icon).toMatch(/^[A-Z][A-Za-z0-9]+$/)
    }
  })

  it("only the page hero is first; singletons have max 1", () => {
    expect(BLOCKS.filter((b) => b.first).map((b) => b.type)).toEqual([
      "hero.page",
    ])
    const repeatable = BLOCKS.filter((b) => b.max === undefined).map(
      (b) => b.type
    )
    expect(repeatable.sort()).toEqual(
      ["departments", "iconCards", "richtext", "stats"].sort()
    )
  })

  it("BlockId and Anchor patterns", () => {
    expect(BlockId.safeParse(crypto.randomUUID()).success).toBe(true)
    expect(BlockId.safeParse("abc").success).toBe(false)
    expect(BlockId.safeParse("a".repeat(49)).success).toBe(false)
    expect(BlockId.safeParse("has space").success).toBe(false)
    expect(Anchor.safeParse("stats-2").success).toBe(true)
    expect(Anchor.safeParse("a".repeat(40)).success).toBe(true)
    expect(Anchor.safeParse("a".repeat(41)).success).toBe(false)
    expect(Anchor.safeParse("2stats").success).toBe(false)
    expect(Anchor.safeParse("Stats").success).toBe(false)
  })

  it("enforces the field limits of the design", () => {
    const hero = (over: Record<string, unknown>) =>
      BLOCK_BY_TYPE["hero.page"].schema.safeParse({
        image: { mediaId: MEDIA },
        crumb: "About",
        title: "About us",
        description: "Who we are",
        ...over,
      }).success
    expect(hero({})).toBe(true)
    expect(hero({ crumb: "x".repeat(41) })).toBe(false)
    expect(hero({ title: "x".repeat(81) })).toBe(false)
    expect(hero({ description: "x".repeat(241) })).toBe(false)
    expect(hero({ title: "" })).toBe(false)

    const stat = { value: "24/7", label: "Cover", description: "Always on" }
    const stats = BLOCK_BY_TYPE.stats.schema
    expect(stats.safeParse({ items: [stat] }).success).toBe(true)
    expect(stats.safeParse({ items: [] }).success).toBe(false)
    expect(stats.safeParse({ items: Array(5).fill(stat) }).success).toBe(false)
    expect(
      stats.safeParse({ items: [{ ...stat, value: "x".repeat(13) }] }).success
    ).toBe(false)

    const services = BLOCK_BY_TYPE.services.schema
    const svc = { eyebrow: "Services", heading: "What we do", intro: "Intro" }
    expect(services.safeParse({ ...svc, count: 12 }).success).toBe(true)
    expect(services.safeParse({ ...svc, count: 13 }).success).toBe(false)
    expect(services.safeParse({ ...svc, count: 0 }).success).toBe(false)

    const blog = BLOCK_BY_TYPE.blog.schema
    expect(
      blog.safeParse({ heading: "News", intro: "x", count: 6 }).success
    ).toBe(true)
    expect(
      blog.safeParse({ heading: "News", intro: "x", count: 7 }).success
    ).toBe(false)

    expect(
      BLOCK_BY_TYPE.whyChooseUs.schema.safeParse({ useShared: false }).success
    ).toBe(false)
    expect(
      BLOCK_BY_TYPE.about.schema.safeParse({ useShared: false }).success
    ).toBe(true)
  })

  it("caps icon cards, department cards and rich text (D5.1 review)", () => {
    const card = {
      title: "Proactive",
      description: "Early",
      icon: { mediaId: MEDIA },
    }
    const cards = (item: Record<string, unknown>) =>
      BLOCK_BY_TYPE.iconCards.schema.safeParse({
        eyebrow: "Values",
        title: "What we stand for",
        description: "Intro",
        items: [{ ...card, ...item }],
      }).success
    expect(cards({})).toBe(true)
    expect(cards({ title: "x".repeat(80) })).toBe(true)
    expect(cards({ title: "x".repeat(81) })).toBe(false)
    expect(cards({ description: "x".repeat(240) })).toBe(true)
    expect(cards({ description: "x".repeat(241) })).toBe(false)

    const line = { text: "Tel: 01 234", href: "tel:+3531234" }
    const dept = {
      title: "HR",
      icon: { mediaId: MEDIA },
      name: "Sarah",
      role: "Manager",
      lines: [line],
    }
    const departments = (item: Record<string, unknown>) =>
      BLOCK_BY_TYPE.departments.schema.safeParse({
        eyebrow: "Departments",
        heading: "Who to call",
        intro: "Intro",
        items: [{ ...dept, ...item }],
      }).success
    expect(departments({})).toBe(true)
    expect(departments({ lines: Array(4).fill(line) })).toBe(true)
    expect(departments({ lines: Array(5).fill(line) })).toBe(false)
    expect(departments({ lines: [{ ...line, text: "x".repeat(121) }] })).toBe(
      false
    )
    expect(departments({ name: "x".repeat(81) })).toBe(false)

    const para = (text: string) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })
    const rich = (content: unknown[]) =>
      BLOCK_BY_TYPE.richtext.schema.safeParse({
        doc: { type: "doc", content },
      }).success
    expect(rich(Array(200).fill(para("Hi")))).toBe(true)
    expect(rich(Array(201).fill(para("Hi")))).toBe(false)
    expect(rich([para("x".repeat(20_000))])).toBe(true)
    expect(rich([para("x".repeat(50_001))])).toBe(false)
    expect(
      rich([
        {
          type: "image",
          attrs: { media: { mediaId: MEDIA }, alt: "x".repeat(50_001) },
        },
      ])
    ).toBe(false)
  })

  it("refuses unsafe links and strips unknown keys at block level", () => {
    const linked = (href: string) =>
      BLOCK_BY_TYPE.richtext.schema.safeParse({
        doc: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Click",
                  marks: [{ type: "link", attrs: { href } }],
                },
              ],
            },
          ],
        },
      }).success
    expect(linked("/contact")).toBe(true)
    expect(linked("javascript:alert(1)")).toBe(false)
    expect(linked("//evil.example")).toBe(false)

    const departments = (href: string) =>
      BLOCK_BY_TYPE.departments.schema.safeParse({
        eyebrow: "Departments",
        heading: "Who to call",
        intro: "Intro",
        items: [
          {
            title: "HR",
            icon: { mediaId: MEDIA },
            name: "Sarah",
            role: "Manager",
            lines: [{ text: "Write", href }],
          },
        ],
      }).success
    expect(departments("mailto:hr@example.com")).toBe(true)
    expect(departments("//evil")).toBe(false)
    expect(departments("javascript:alert(1)")).toBe(false)

    const parsed = BlockInstance.parse({
      id: "block-1",
      type: "team",
      anchor: "team",
      hidden: false,
      html: "<script>",
      data: {
        heading: "Team",
        intro: "Who",
        dangerouslySetInnerHTML: { __html: "<script>" },
      },
    })
    expect(parsed).not.toHaveProperty("html")
    expect(parsed.data).toEqual({ heading: "Team", intro: "Who" })
  })

  it("BlockInstance discriminates on type", () => {
    const ok = BlockInstance.safeParse({
      id: "block-1",
      type: "map",
      anchor: "map",
      hidden: false,
      data: { useShared: true },
    })
    expect(ok.success).toBe(true)
    const bad = BlockInstance.safeParse({
      id: "block-1",
      type: "nope",
      anchor: "map",
      hidden: false,
      data: {},
    })
    expect(bad.success).toBe(false)
  })
})
