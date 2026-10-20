import { describe, expect, it } from "vitest"

import { redactContacts } from "@/server/modules/ai/redact"

describe("redactContacts (best-effort; C8 review M1, C9 review I2/M1)", () => {
  it.each([
    ["plain email", "write to john@gmail.com please"],
    ["space before @", "write to john @gmail.com please"],
    ["space after @", "write to john@ gmail.com please"],
    ["spaces around @", "write to john @ gmail.com please"],
    ["fullwidth at with spaces", "write to john ＠ gmail.com please"],
    ["fullwidth at", "write to john＠gmail.com please"],
    ["small at", "write to john﹫gmail.com please"],
    ["spelled email", "write to john at gmail dot com please"],
    ["bracketed email", "write to john[at]gmail[dot]com please"],
    ["bracketed at, real dot", "write to john (at) gmail.com please"],
    ["mixed spelled", "john at gmail.com"],
  ])("removes an email: %s", (_name, text) => {
    const out = redactContacts(text)
    expect(out).toContain("[email removed]")
    expect(out).not.toMatch(/gmail|john|@|＠/)
  })

  it.each([
    ["plain", "call 0871234567"],
    ["spaces", "call 087 123 4567"],
    ["international", "call +353 87 123 4567"],
    ["hyphen", "call 087-123-4567"],
    ["en dash", "call 087–123–4567"],
    ["em dash", "call 087—123—4567"],
    ["minus sign", "call 087−123−4567"],
    ["middle dot", "call 087 · 123 · 4567"],
    ["bullet", "call 087•123•4567"],
    ["dots", "call 087.123.4567"],
    ["brackets", "call (087) 123 4567"],
    ["fullwidth digits", "call ０８７１２３４５６７"],
    ["fullwidth with dashes", "call ０８７－１２３－４５６７"],
    ["no-break spaces", "call 087 123 4567"],
    ["commas", "call 087,123,4567"],
    ["underscores", "call 087_123_4567"],
    ["Arabic-Indic digits", "call ٠٨٧١٢٣٤٥٦٧"],
    ["Devanagari digits", "call ०८७ १२३ ४५६७"],
    ["mixed scripts", "call 08٧-123-४567"],
  ])("removes a phone number: %s", (_name, text) => {
    const out = redactContacts(text)
    expect(out).toBe("call [number removed]")
  })

  it("keeps dates, times and short numbers", () => {
    expect(redactContacts("Start 2024-10-12, 12/10/2024 or 12.10.2024")).toBe(
      "Start 2024-10-12, 12/10/2024 or 12.10.2024"
    )
    expect(redactContacts("3 guards from 09:00 to 17:30, 24/7")).toBe(
      "3 guards from 09:00 to 17:30, 24/7"
    )
    expect(redactContacts("Unit 12, D02 X285")).toBe("Unit 12, D02 X285")
  })

  it("does not treat ordinary 'at' sentences as emails", () => {
    expect(redactContacts("We are at the office. Then we leave.")).toBe(
      "We are at the office. Then we leave."
    )
    expect(redactContacts("Meet at noon")).toBe("Meet at noon")
  })

  it("never leaves an @ behind", () => {
    expect(redactContacts("@ home @@ x")).not.toContain("@")
  })

  // C9 re-review N3 probes.
  it.each([
    ["zero-width space", "call 087​123​4567"],
    ["zero-width joiner", "call 087‍123‍4567"],
    ["left-to-right mark", "call 087‎123‏4567"],
    ["word joiner", "call 087⁠123⁠4567"],
    ["BOM", "call 087﻿123﻿4567"],
    ["colons", "call 087:123:4567"],
    ["apostrophes", "call 087'123'4567"],
    ["asterisks", "call 087*123*4567"],
    ["pipes", "call 087|123|4567"],
    ["tildes", "call 087~123~4567"],
    ["pluses", "call 087+123+4567"],
    ["invalid date shape", "call 08/71/2345"],
    ["invalid date list", "call 08.71.2345, 67.89.0123"],
    ["invalid ISO date", "call 2345-67-89"],
  ])("removes a phone number: %s", (_name, text) => {
    expect(redactContacts(text)).toBe("call [number removed]")
  })

  it.each([
    ["(@)", "write to john(@)gmail.com please"],
    ["[@]", "write to john [@] gmail.com please"],
    ["{@}", "write to john{@}gmail.com please"],
    ["<@>", "write to john < @ > gmail.com please"],
    ["zero-width around @", "write to john​@​gmail.com please"],
    // C9 N5 (final review minor 9): spaced {@} and unbalanced brackets.
    ["spaced {@}", "write to john {@} gmail.com please"],
    ["spaced { @ }", "write to john { @ } gmail.com please"],
    ["open bracket only", "write to john (@ gmail.com please"],
    ["close bracket only", "write to john @) gmail.com please"],
    ["open bracket, at", "write to john (at gmail dot com please"],
    ["close bracket, at", "write to john at] gmail.com please"],
  ])("removes an obfuscated email: %s", (_name, text) => {
    const out = redactContacts(text)
    expect(out).toBe("write to [email removed] please")
  })

  it("keeps valid dates and times next to each other", () => {
    expect(
      redactContacts("From 17:30, 24/7 on 31/12/2024 and 12/31/2024")
    ).toBe("From 17:30, 24/7 on 31/12/2024 and 12/31/2024")
    expect(redactContacts("Shifts 08:00 - 16:00")).toBe("Shifts 08:00 - 16:00")
  })

  it("clips its input before matching (C9 re-review N4)", () => {
    expect(redactContacts("a".repeat(50), 10)).toBe("a".repeat(10))
    expect(redactContacts("x".repeat(20_000))).toHaveLength(10_000)
    // Never splits a surrogate pair.
    expect(redactContacts(`${"a".repeat(9)}😀`, 10)).toBe("a".repeat(9))
  })

  it.each([
    ["no @", "a".repeat(10_000)],
    ["no @, long input", "a".repeat(100_000)],
    ["spelled, no at", "a.".repeat(5_000)],
    ["words", "john ".repeat(2_000)],
    ["digits and separators", "1 ".repeat(5_000)],
    ["separators then letter", `1${" ".repeat(10_000)}x`],
    ["dots", ".".repeat(10_000)],
  ])("runs in linear time on 10k characters: %s", (_name, text) => {
    redactContacts("warm up john@gmail.com 087 123 4567")
    const started = performance.now()
    redactContacts(text)
    expect(performance.now() - started).toBeLessThan(100)
  })
})
