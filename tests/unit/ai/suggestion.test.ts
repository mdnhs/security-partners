import { describe, expect, it } from "vitest"

import { suggestionText } from "@/lib/ai/suggestion"

describe("suggestionText (Insert)", () => {
  it("returns the reply trimmed", () => {
    expect(suggestionText("  Safer nights\n")).toBe("Safer nights")
  })

  it("drops one pair of wrapping quotes the model added", () => {
    expect(suggestionText('"Safer nights"')).toBe("Safer nights")
    expect(suggestionText("“Safer nights”")).toBe("Safer nights")
    expect(suggestionText("‘Safer nights’")).toBe("Safer nights")
  })

  it("keeps quotes that belong to the text", () => {
    expect(suggestionText('"Safe" and "sound"')).toBe('"Safe" and "sound"')
    expect(suggestionText("We’re here")).toBe("We’re here")
  })

  it("unwraps a single code fence", () => {
    expect(suggestionText("```text\nLine one\nLine two\n```")).toBe(
      "Line one\nLine two"
    )
  })
})
