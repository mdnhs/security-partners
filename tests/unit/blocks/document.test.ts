import { describe, expect, it } from "vitest"

import {
  BuilderDocument,
  DraftDocument,
  emptyBlock,
  validateDocument,
} from "@/blocks/document"
import { BLOCKS, BlockId, type BlockInstance } from "@/blocks/registry"

const none = { blocks: [] as { anchor: string }[] }
const MEDIA = "0b8a3c4e-1f2d-4a5b-8c6d-7e8f9a0b1c2d"

const map = (id: string, anchor = "map"): BlockInstance => ({
  id,
  type: "map",
  anchor,
  hidden: false,
  data: { useShared: true },
})
const richtext = (id: string, anchor: string): BlockInstance => ({
  id,
  type: "richtext",
  anchor,
  hidden: false,
  data: {
    doc: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Hi" }] }],
    },
  },
})
const hero = (id: string): BlockInstance => ({
  id,
  type: "hero.page",
  anchor: "hero",
  hidden: false,
  data: {
    image: { mediaId: MEDIA },
    crumb: "About",
    title: "About",
    description: "Intro",
  },
})

describe("validateDocument", () => {
  it("accepts a valid document", () => {
    const doc = { blocks: [hero("hero-1"), richtext("text-1", "intro")] }
    const r = validateDocument(doc)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.doc).toEqual(doc)
  })

  it("validateDocument enforces first/max/unique anchors with indexed keys", () => {
    const r = validateDocument({
      blocks: [emptyBlock("stats", none), emptyBlock("hero.page", none)],
    })
    expect(r).toEqual({
      ok: false,
      fieldErrors: expect.objectContaining({
        "blocks.1.type": ["Page hero must be the first block"],
      }),
    })

    const dup = validateDocument({
      blocks: [
        hero("hero-1"),
        map("map-1"),
        map("map-2", "map-two"),
        richtext("text-1", "intro"),
        richtext("text-1", "intro"),
      ],
    })
    expect(dup.ok).toBe(false)
    if (!dup.ok) {
      expect(dup.fieldErrors["blocks.2.type"]).toEqual([
        "At most 1 Map per page",
      ])
      expect(dup.fieldErrors["blocks.4.id"]).toEqual([
        "Two blocks share this id",
      ])
      expect(dup.fieldErrors["blocks.4.anchor"]).toEqual([
        'Anchor "intro" is already used on this page',
      ])
      expect(dup.fieldErrors["blocks.0.type"]).toBeUndefined()
    }
  })

  it("reports schema errors under blocks.<i>.<path>", () => {
    const bad = hero("hero-1")
    const r = validateDocument({
      blocks: [{ ...bad, data: { ...bad.data, title: "" } }],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fieldErrors["blocks.0.data.title"]).toBeDefined()
  })

  it("requires 1..40 blocks", () => {
    const empty = validateDocument({ blocks: [] })
    expect(empty.ok).toBe(false)
    if (!empty.ok) expect(empty.fieldErrors.blocks).toBeDefined()
    const many = Array.from({ length: 41 }, (_, i) =>
      richtext(`text-${i}`, `t${i}`)
    )
    expect(validateDocument({ blocks: many }).ok).toBe(false)
    expect(validateDocument({ blocks: many.slice(0, 40) }).ok).toBe(true)
  })

  it("rejects garbage", () => {
    expect(validateDocument(null).ok).toBe(false)
    expect(validateDocument({}).ok).toBe(false)
  })
})

describe("emptyBlock", () => {
  it("emptyBlock gives unique anchors (stats, stats-2)", () => {
    const a = emptyBlock("stats", none)
    const b = emptyBlock("stats", { blocks: [a] })
    const c = emptyBlock("stats", { blocks: [a, b] })
    expect([a.anchor, b.anchor, c.anchor]).toEqual([
      "stats",
      "stats-2",
      "stats-3",
    ])
    expect(a.id).not.toBe(b.id)
    expect(BlockId.safeParse(a.id).success).toBe(true)
    expect(a.hidden).toBe(false)
  })

  it("turns the type into a valid anchor", () => {
    expect(emptyBlock("hero.page", none).anchor).toBe("hero-page")
    expect(emptyBlock("iconCards", none).anchor).toBe("icon-cards")
    expect(emptyBlock("whyChooseUs", none).anchor).toBe("why-choose-us")
  })

  it("every block starts with draft-valid data that a shared block publishes as is", () => {
    for (const { type } of BLOCKS) {
      const block = emptyBlock(type, none)
      expect(block.type).toBe(type)
      expect(DraftDocument.safeParse({ blocks: [block] }).success).toBe(true)
    }
    for (const type of [
      "about",
      "whyChooseUs",
      "enquireBanner",
      "clients",
      "contact",
      "map",
      "newsletter",
    ] as const) {
      const block = emptyBlock(type, none)
      expect(BuilderDocument.safeParse({ blocks: [block] }).success).toBe(true)
    }
  })

  it("does not share default objects between blocks", () => {
    const a = emptyBlock("stats", none)
    const b = emptyBlock("stats", none)
    expect(a.data).toEqual(b.data)
    expect(a.data).not.toBe(b.data)
  })
})

describe("DraftDocument", () => {
  it("keeps half-finished data but only known types", () => {
    const block = { ...emptyBlock("stats", none), data: { items: "wip" } }
    expect(DraftDocument.safeParse({ blocks: [block] }).success).toBe(true)
    expect(
      DraftDocument.safeParse({ blocks: [{ ...block, type: "nope" }] }).success
    ).toBe(false)
    expect(DraftDocument.safeParse({ blocks: [] }).success).toBe(true)
  })
})
