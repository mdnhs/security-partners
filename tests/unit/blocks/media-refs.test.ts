import { describe, expect, it } from "vitest"

import { collectMediaIds } from "@/blocks/media-refs"

const A = "0b8a3c4e-1f2d-4a5b-8c6d-7e8f9a0b1c2d"
const B = "1b8a3c4e-1f2d-4a5b-8c6d-7e8f9a0b1c2d"
const C = "2b8a3c4e-1f2d-4a5b-8c6d-7e8f9a0b1c2d"
const D = "3b8a3c4e-1f2d-4a5b-8c6d-7e8f9a0b1c2d"

describe("collectMediaIds", () => {
  it("collectMediaIds finds nested refs in hero, iconCards and richtext images", () => {
    const ids = collectMediaIds({
      blocks: [
        {
          data: {
            image: { mediaId: A },
            crumb: "About",
            title: "About",
            description: "x",
          },
        },
        {
          data: {
            eyebrow: "e",
            title: "t",
            description: "d",
            items: [
              { title: "a", description: "a", icon: { mediaId: B } },
              { title: "b", description: "b", icon: { mediaId: A } },
            ],
          },
        },
        {
          data: {
            doc: {
              type: "doc",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "x" }] },
                { type: "image", attrs: { media: { mediaId: C }, alt: "" } },
              ],
            },
          },
        },
        {
          data: {
            items: [
              { title: "d", icon: { mediaId: D }, lines: [{ text: "t" }] },
            ],
          },
        },
      ],
    })
    expect(ids.sort()).toEqual([A, B, C, D].sort())
  })

  it("skips references whose id is not a media id (unparsed drafts)", () => {
    expect(
      collectMediaIds({
        blocks: [
          { data: { image: { mediaId: "x" } } },
          { data: { image: { mediaId: A } } },
        ],
      })
    ).toEqual([A])
  })

  it("returns an empty list for blocks without media", () => {
    expect(
      collectMediaIds({ blocks: [{ data: { useShared: true } }] })
    ).toEqual([])
    expect(collectMediaIds({ blocks: [] })).toEqual([])
  })
})
