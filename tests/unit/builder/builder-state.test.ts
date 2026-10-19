import { describe, expect, it } from "vitest"

import { BLOCK_BY_TYPE, BLOCK_TYPES, BlockId } from "@/blocks/registry"
import {
  addableTypes,
  anchorProblem,
  blockErrors,
  docReducer,
  type DraftBlock,
  type DraftDocumentValue,
  errorsByBlock,
  MAX_BLOCKS,
  publishErrors,
  RESERVED_ANCHORS,
  selectAfterRemove,
  unavailableReason,
} from "@/components/admin/builder/builder-state"

const empty: DraftDocumentValue = { blocks: [] }

const block = (
  id: string,
  type: DraftBlock["type"],
  anchor: string,
  data: Record<string, unknown> = {}
): DraftBlock => ({ id, type, anchor, hidden: false, data })

const doc = (...blocks: DraftBlock[]): DraftDocumentValue => ({ blocks })

const ids = (d: DraftDocumentValue) => d.blocks.map((b) => b.id)

describe("docReducer", () => {
  it("add: a page hero goes first; a second one is a no-op (addableTypes excludes it)", () => {
    let d = docReducer(empty, { type: "add", blockType: "stats", at: 0 })
    d = docReducer(d, { type: "add", blockType: "hero.page", at: 1 })
    expect(d.blocks.map((b) => b.type)).toEqual(["hero.page", "stats"])
    expect(addableTypes(d)).not.toContain("hero.page")
    const again = docReducer(d, { type: "add", blockType: "hero.page", at: 0 })
    expect(again).toBe(d)
    expect(BlockId.safeParse(d.blocks[0].id).success).toBe(true)
  })

  it("add: inserts at `at`, never above the hero, with defaults and a fresh anchor", () => {
    let d = doc(block("hero-1", "hero.page", "hero-page"))
    d = docReducer(d, { type: "add", blockType: "stats", at: 0 })
    d = docReducer(d, { type: "add", blockType: "stats", at: 2 })
    expect(d.blocks.map((b) => [b.type, b.anchor])).toEqual([
      ["hero.page", "hero-page"],
      ["stats", "stats"],
      ["stats", "stats-2"],
    ])
    expect(d.blocks[1].data).toEqual(BLOCK_BY_TYPE.stats.defaults)
  })

  it("move keeps ids (and the hero stays first)", () => {
    const d = doc(
      block("hero-1", "hero.page", "hero-page"),
      block("aaaa", "stats", "stats"),
      block("bbbb", "richtext", "richtext"),
      block("cccc", "map", "map")
    )
    const moved = docReducer(d, { type: "move", id: "aaaa", to: 3 })
    expect(ids(moved)).toEqual(["hero-1", "bbbb", "cccc", "aaaa"])
    expect(new Set(ids(moved))).toEqual(new Set(ids(d)))
    expect(moved.blocks[3]).toBe(d.blocks[1])
    // Nothing moves above the hero, and the hero does not move.
    expect(ids(docReducer(d, { type: "move", id: "cccc", to: 0 }))).toEqual([
      "hero-1",
      "cccc",
      "aaaa",
      "bbbb",
    ])
    expect(docReducer(d, { type: "move", id: "hero-1", to: 2 })).toBe(d)
    expect(docReducer(d, { type: "move", id: "nope", to: 1 })).toBe(d)
  })

  it("duplicate gives a new id and anchor x-2, right after the original", () => {
    const d = doc(
      block("aaaa", "stats", "stats", { items: [{ value: "24/7" }] }),
      block("bbbb", "map", "map")
    )
    const dup = docReducer(d, { type: "duplicate", id: "aaaa" })
    expect(dup.blocks.map((b) => b.anchor)).toEqual(["stats", "stats-2", "map"])
    const copy = dup.blocks[1]
    expect(copy.id).not.toBe("aaaa")
    expect(BlockId.safeParse(copy.id).success).toBe(true)
    expect(copy.data).toEqual(d.blocks[0].data)
    expect(copy.data).not.toBe(d.blocks[0].data)
    // stats-2 is taken now: the next copy is stats-3.
    const again = docReducer(dup, { type: "duplicate", id: "aaaa" })
    expect(again.blocks[1].anchor).toBe("stats-3")
    // One-per-page blocks cannot be duplicated.
    expect(docReducer(d, { type: "duplicate", id: "bbbb" })).toBe(d)
  })

  it("duplicate keeps a 40-character anchor within 40", () => {
    const long = `a${"b".repeat(39)}`
    const dup = docReducer(doc(block("aaaa", "richtext", long)), {
      type: "duplicate",
      id: "aaaa",
    })
    expect(dup.blocks[1].anchor).toHaveLength(40)
    expect(dup.blocks[1].anchor.endsWith("-2")).toBe(true)
  })

  it("remove the selected block; selection moves to its neighbour", () => {
    const d = doc(
      block("aaaa", "stats", "stats"),
      block("bbbb", "richtext", "richtext"),
      block("cccc", "map", "map")
    )
    expect(selectAfterRemove(d, "bbbb")).toBe("cccc")
    expect(selectAfterRemove(d, "cccc")).toBe("bbbb")
    expect(selectAfterRemove(doc(block("aaaa", "map", "map")), "aaaa")).toBe(
      null
    )
    expect(ids(docReducer(d, { type: "remove", id: "bbbb" }))).toEqual([
      "aaaa",
      "cccc",
    ])
  })

  it("data, meta and replace", () => {
    const d = doc(block("aaaa", "team", "team"))
    const withData = docReducer(d, {
      type: "data",
      id: "aaaa",
      data: { heading: "People" },
    })
    expect(withData.blocks[0].data).toEqual({ heading: "People" })
    expect(docReducer(d, { type: "data", id: "aaaa", data: "x" })).toBe(d)
    const hidden = docReducer(d, {
      type: "meta",
      id: "aaaa",
      patch: { hidden: true },
    })
    expect(hidden.blocks[0]).toMatchObject({ hidden: true, anchor: "team" })
    const next = doc(block("zzzz", "map", "map"))
    expect(docReducer(d, { type: "replace", doc: next })).toBe(next)
  })
})

describe("addableTypes and reasons", () => {
  it("respects max per type and the 40-block cap", () => {
    const d = doc(block("aaaa", "about", "about"))
    expect(addableTypes(d)).not.toContain("about")
    expect(addableTypes(d)).toContain("stats")
    expect(addableTypes(empty)).toEqual(BLOCK_TYPES)
    const full = {
      blocks: Array.from({ length: MAX_BLOCKS }, (_, i) =>
        block(`blk-${i}`, "richtext", `t-${i}`)
      ),
    }
    expect(addableTypes(full)).toEqual([])
    expect(unavailableReason("richtext", full)).toBe(
      "A page holds at most 40 blocks"
    )
    expect(unavailableReason("hero.page")).toBe("Only one per page")
    expect(unavailableReason("about")).toBe("Only one per page")
  })
})

describe("anchorProblem", () => {
  const d = doc(
    block("aaaa", "about", "about"),
    block("bbbb", "stats", "figures")
  )

  it("reserves about/services/team/blog/contact for their own blocks", () => {
    expect(Object.keys(RESERVED_ANCHORS)).toEqual([
      "about",
      "services",
      "team",
      "blog",
      "contact",
    ])
    expect(anchorProblem("about", d.blocks[0], d)).toBeNull()
    expect(anchorProblem("services", d.blocks[1], d)).toBe(
      '"services" is kept for the Services section'
    )
    expect(
      anchorProblem("contact", { id: "x1x1", type: "contact" }, d)
    ).toBeNull()
  })

  it("format and uniqueness", () => {
    expect(anchorProblem("Figures", d.blocks[1], d)).toMatch(/lower-case/)
    expect(anchorProblem("", d.blocks[1], d)).toMatch(/lower-case/)
    expect(anchorProblem("figures", d.blocks[1], d)).toBeNull()
    expect(anchorProblem("figures", { id: "new1", type: "map" }, d)).toBe(
      'Anchor "figures" is already used on this page'
    )
  })
})

describe("publish errors", () => {
  const d = doc(
    block("hero-1", "hero.page", "hero-page"),
    block("aaaa", "stats", "stats")
  )
  const fieldErrors = {
    "blocks.0.data.title": ["Required"],
    "blocks.1.data.items.0.value": ["Required"],
    "blocks.1.anchor": ['Anchor "stats" is already used on this page'],
    "blocks.1.type": ["At most 1 About per page"],
    "blocks.7.data.title": ["Required"],
    document: ["x"],
    _media: ["y"],
  }

  it("errorsByBlock maps indexes to ids", () => {
    expect(errorsByBlock(fieldErrors, d)).toEqual({
      "hero-1": ["Title: Required"],
      aaaa: [
        "Items 1 › Figure: Required",
        'Anchor: Anchor "stats" is already used on this page',
        "At most 1 About per page",
      ],
    })
  })

  it("blockErrors splits data paths, anchor and block-level errors", () => {
    expect(blockErrors(fieldErrors, 1)).toEqual({
      data: {
        "items.0.value": ["Required"],
        _root: ["At most 1 About per page"],
      },
      anchor: ['Anchor "stats" is already used on this page'],
    })
    expect(blockErrors(fieldErrors, 0)).toEqual({
      data: { title: ["Required"] },
      anchor: [],
    })
  })

  it("publishErrors keys by block id against the published snapshot, so a later reorder keeps them on their block (review D5.4 M1)", () => {
    const sent = { blocks: [...d.blocks, block("cccc", "map", "map")] }
    const errors = publishErrors(fieldErrors, sent)
    // The editor then moves Stats down: index 1 is now Map, but the stored
    // id-keyed errors stay on Stats.
    const moved = docReducer(sent, { type: "move", id: "aaaa", to: 2 })
    expect(moved.blocks[1].id).toBe("cccc")
    expect(errors.cccc).toBeUndefined()
    expect(errors.aaaa).toEqual({
      summary: errorsByBlock(fieldErrors, d).aaaa,
      data: blockErrors(fieldErrors, 1).data,
      anchor: blockErrors(fieldErrors, 1).anchor,
    })
    expect(errors["hero-1"].data).toEqual({ title: ["Required"] })
    expect(Object.keys(errors).sort()).toEqual(["aaaa", "hero-1"])
  })
})
