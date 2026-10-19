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
  "newsletter",
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
