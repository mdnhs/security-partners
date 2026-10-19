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
})
