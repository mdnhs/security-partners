import { describe, expect, it } from "vitest"

import { clipUnits, clipWithEllipsis } from "@/server/modules/ai/clip"

describe("AI text clipping (final review minor 4)", () => {
  it("clipUnits keeps at most max UTF-16 units, never half a surrogate pair, no ellipsis", () => {
    expect(clipUnits("abcdef", 10)).toBe("abcdef")
    expect(clipUnits("abcdef", 3)).toBe("abc")
    // The rocket is two UTF-16 units: cutting at 3 would split it.
    expect(clipUnits("ab\u{1F680}cd", 3)).toBe("ab")
    expect(clipUnits("ab\u{1F680}cd", 4)).toBe("ab\u{1F680}")
  })

  it("clipWithEllipsis counts code points and marks the cut with …", () => {
    expect(clipWithEllipsis("abcdef", 6)).toBe("abcdef")
    expect(clipWithEllipsis("abcdef", 4)).toBe("abc…")
    expect(clipWithEllipsis("\u{1F680}\u{1F680}\u{1F680}", 2)).toBe(
      "\u{1F680}…"
    )
    expect([...clipWithEllipsis("x".repeat(500), 200)]).toHaveLength(200)
  })
})
