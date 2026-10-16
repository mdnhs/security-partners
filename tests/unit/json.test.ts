import { describe, expect, it } from "vitest"

import { diffValues, isDeepEqual, stableStringify } from "@/lib/json"
import { collectMediaFields } from "@/lib/media"

describe("isDeepEqual / stableStringify (jsonb ignores key order)", () => {
  it("ignores object key order, not array order", () => {
    expect(
      isDeepEqual({ a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 })
    ).toBe(true)
    expect(isDeepEqual([1, 2], [2, 1])).toBe(false)
    expect(stableStringify({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(
      '{"a":[{"c":2,"d":1}],"b":1}'
    )
  })

  it("keeps strings byte-identical (Review Focus 1)", () => {
    expect(isDeepEqual({ t: "Monday–Friday" }, { t: "Monday-Friday" })).toBe(
      false
    )
    expect(isDeepEqual({ t: "a  b" }, { t: "a b" })).toBe(false)
  })
})

describe("diffValues (publish dialog)", () => {
  it("lists leaf changes by path; media refs and rich text are leaves", () => {
    const before = {
      hero: { heading: "A", image: { mediaId: "m1" } },
      stats: [{ value: "1" }, { value: "2" }],
      body: { type: "doc", content: [{ type: "paragraph" }] },
    }
    const after = {
      hero: { heading: "B", image: { mediaId: "m2" } },
      stats: [{ value: "1" }, { value: "3" }],
      body: { type: "doc", content: [] },
    }
    expect(diffValues(before, after)).toEqual([
      { path: "hero.heading", before: "A", after: "B" },
      {
        path: "hero.image",
        before: { mediaId: "m1" },
        after: { mediaId: "m2" },
      },
      { path: "stats.1.value", before: "2", after: "3" },
      { path: "body", before: before.body, after: after.body },
    ])
  })

  it("treats a list whose length changed as one change", () => {
    expect(diffValues({ l: [1] }, { l: [1, 2] })).toEqual([
      { path: "l", before: [1], after: [1, 2] },
    ])
    expect(diffValues(null, { a: 1 })).toEqual([
      { path: "", before: null, after: { a: 1 } },
    ])
    expect(diffValues({ a: 1 }, { a: 1 })).toEqual([])
  })
})

describe("collectMediaFields (media_usages rows)", () => {
  it("returns every reference with its dot path", () => {
    expect(
      collectMediaFields({
        hero: { image: { mediaId: "a" } },
        items: [{ icon: { mediaId: "b" } }],
        body: {
          type: "doc",
          content: [
            { type: "image", attrs: { media: { mediaId: "c" }, alt: "" } },
          ],
        },
        notRef: { mediaId: "z", extra: 1 },
      })
    ).toEqual([
      { mediaId: "a", field: "hero.image" },
      { mediaId: "b", field: "items.0.icon" },
      { mediaId: "c", field: "body.content.0.attrs.media" },
    ])
  })
})
