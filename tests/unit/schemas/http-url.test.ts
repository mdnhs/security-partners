import { describe, expect, it } from "vitest"

import { httpUrl } from "@/lib/schemas/common"

describe("httpUrl rejects control characters (ledger P03-1)", () => {
  it("accepts ordinary http(s) URLs", () => {
    expect(httpUrl.safeParse("https://www.example.ie/path?q=1").success).toBe(
      true
    )
    expect(httpUrl.safeParse("http://localhost:3000/").success).toBe(true)
  })

  it.each([
    ["NUL", "https://example.ie/a\u0000b"],
    ["unit separator", "https://example.ie/a\u001fb"],
    ["DEL", "https://example.ie/a\u007fb"],
    ["C1 NEL", "https://example.ie/a\u0085b"],
  ])("rejects an inner %s with a 422-style issue", (_name, value) => {
    const result = httpUrl.safeParse(value)
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe(
      "Must not contain control characters"
    )
  })
})
