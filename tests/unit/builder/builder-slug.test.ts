import { describe, expect, it } from "vitest"

import { isBuilderSlug } from "@/lib/builder-slug"
import { builderSlug } from "@/lib/schemas/api/builder-pages"

describe("isBuilderSlug (zod-free, proxy) matches builderSlug", () => {
  it.each([
    "landing",
    "spring-offer-2026",
    "a",
    "x".repeat(60),
    "x".repeat(61),
    "",
    "Landing",
    "a--b",
    "a-",
    "-a",
    "a/b",
    "é",
    " a",
    "a\nb",
    "landing\n",
    "admin",
    "api",
    "og",
    "images",
    "p",
  ])("%j", (slug) => {
    expect(isBuilderSlug(slug)).toBe(builderSlug.safeParse(slug).success)
  })
})
