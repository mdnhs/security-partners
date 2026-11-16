import { describe, expect, it } from "vitest"

import {
  HOME_SECTIONS,
  normalizeSections,
  visibleSections,
} from "@/templates/shared/sections"

describe("page section layout", () => {
  it("reads a page without a layout as the default order, all visible", () => {
    expect(visibleSections(undefined, HOME_SECTIONS)).toEqual([
      ...HOME_SECTIONS,
    ])
  })

  it("keeps the stored order and hides what is switched off", () => {
    const out = visibleSections(
      [
        { id: "blog", visible: true },
        { id: "about", visible: false },
      ],
      HOME_SECTIONS
    )
    expect(out[0]).toBe("blog")
    expect(out).not.toContain("about")
    // Sections the stored list lacks follow, visible, in default order.
    expect(out.slice(1)).toEqual(
      HOME_SECTIONS.filter((id) => id !== "blog" && id !== "about")
    )
  })

  it("drops unknown ids and repeats, never loses a section", () => {
    const out = normalizeSections(
      [
        { id: "nope", visible: true },
        { id: "map", visible: true },
        { id: "map", visible: false },
      ],
      HOME_SECTIONS
    )
    expect(out).toHaveLength(HOME_SECTIONS.length)
    expect(out.filter((s) => s.id === "map")).toEqual([
      { id: "map", visible: true },
    ])
  })
})
