import { describe, expect, it } from "vitest"

import { HIDDEN_CHARS, stripHiddenChars } from "@/lib/hidden-chars"
import { cleanAltText } from "@/lib/schemas/api/media"

const HIDDEN = [
  "\u0000",
  "\u0007",
  "\u001f",
  "\u007f",
  "\u0085",
  "\u009f",
  "\u061c", // Arabic letter mark
  "\u180e", // Mongolian vowel separator
  "\u200b",
  "\u200c",
  "\u200e",
  "\u200f",
  "\u2028", // line separator
  "\u2029", // paragraph separator
  "\u202a",
  "\u202e",
  "\u2060", // word joiner
  "\u2064", // invisible plus
  "\u2066",
  "\u2069",
  "\ufeff",
  "\u{e0000}",
  "\u{e0001}", // language tag
  "\u{e0041}", // tag latin capital A
  "\u{e007f}", // cancel tag
]

describe("HIDDEN_CHARS (one set for alt text and file names)", () => {
  it.each(HIDDEN.map((ch) => [ch.codePointAt(0)!.toString(16), ch]))(
    "strips U+%s",
    (_, ch) => {
      expect(stripHiddenChars(`a${ch}b`)).toBe("ab")
    }
  )

  it("keeps ZWJ so emoji sequences survive", () => {
    const family = "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}"
    expect(stripHiddenChars(`Team ${family}`)).toBe(`Team ${family}`)
  })

  it("keeps ordinary text, accents and non-Latin scripts", () => {
    const text = "Garda Síochána — Ελλάδα 東京 مرحبا"
    expect(stripHiddenChars(text)).toBe(text)
  })

  it("is a global regex (replaces every occurrence)", () => {
    expect(HIDDEN_CHARS.global).toBe(true)
    expect(stripHiddenChars("\u200ba\u2028b\u{e0041}c\u0007")).toBe("abc")
  })

  it("alt text uses the same set, then trims", () => {
    expect(
      cleanAltText("  Guard\u2028 at\u2060 the\u{e0041} gate\u061c ")
    ).toBe("Guard at the gate")
  })
})
