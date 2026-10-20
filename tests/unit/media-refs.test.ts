import { describe, expect, it } from "vitest"

import {
  collectMediaIds,
  isMediaId,
  type MediaView,
  replaceMediaRefs,
} from "@/lib/media"

describe("isMediaId (D1.1 re-review N2)", () => {
  it("accepts only a UUID: dot segments and paths never reach the API", () => {
    expect(isMediaId("0190f5a2-7c3b-7d4e-8f00-1234567890ab")).toBe(true)
    expect(isMediaId("0190F5A2-7C3B-7D4E-8F00-1234567890AB")).toBe(true)
    for (const bad of [
      ".",
      "..",
      "",
      "../users",
      "x?role=admin",
      null,
      undefined,
    ])
      expect(isMediaId(bad)).toBe(false)
  })
})

const view = (id: string): MediaView => ({
  id,
  url: `/images/${id}.png`,
  alt: "",
  width: 10,
  height: 10,
  blurDataUrl: null,
})

const data = {
  hero: { image: { mediaId: "a" }, title: "T" },
  items: [{ icon: { mediaId: "b" } }, { icon: { mediaId: "a" } }],
  body: {
    type: "doc",
    content: [{ type: "image", attrs: { media: { mediaId: "c" }, alt: "x" } }],
  },
  // not a reference: has more than one key
  other: { mediaId: "z", extra: true },
  when: new Date("2026-09-20T09:00:00Z"),
}

describe("media references", () => {
  it("collects every { mediaId } once", () => {
    expect([...collectMediaIds(data)].sort()).toEqual(["a", "b", "c"])
  })

  it("replaces references and leaves everything else as is", () => {
    const out = replaceMediaRefs(data, view)
    expect(out.hero.image.url).toBe("/images/a.png")
    expect(out.items.map((i) => i.icon.id)).toEqual(["b", "a"])
    expect(out.body.content[0].attrs.media).toEqual(view("c"))
    expect(out.other).toEqual({ mediaId: "z", extra: true })
    expect(out.when).toEqual(data.when)
    expect(out.hero.title).toBe("T")
    expect(data.hero.image).toEqual({ mediaId: "a" })
  })
})
