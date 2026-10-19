import { describe, expect, it } from "vitest"

import { seo } from "@/lib/schemas/common"

describe("seo social fields (MK D1.3)", () => {
  it("all three are optional; an empty record still parses", () => {
    expect(seo.safeParse({}).success).toBe(true)
  })

  it("ogTitle up to 70 characters", () => {
    expect(seo.safeParse({ ogTitle: "a".repeat(70) }).success).toBe(true)
    expect(seo.safeParse({ ogTitle: "a".repeat(71) }).success).toBe(false)
  })

  it("ogDescription up to 200 characters", () => {
    expect(seo.safeParse({ ogDescription: "a".repeat(200) }).success).toBe(true)
    expect(seo.safeParse({ ogDescription: "a".repeat(201) }).success).toBe(
      false
    )
  })

  it("twitterCard is summary_large_image or summary", () => {
    expect(seo.safeParse({ twitterCard: "summary" }).success).toBe(true)
    expect(seo.safeParse({ twitterCard: "summary_large_image" }).success).toBe(
      true
    )
    expect(seo.safeParse({ twitterCard: "player" }).success).toBe(false)
  })
})
