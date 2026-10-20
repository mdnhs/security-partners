import { describe, expect, it } from "vitest"

import {
  type CheckInput,
  DESCRIPTION_RANGE,
  runChecks,
  SEO_CHECK_COUNT,
  SEO_CHECKS,
  TITLE_RANGE,
} from "@/lib/seo/checks"
import { isShareImageSize } from "@/lib/seo/share-image"

const ok: CheckInput = {
  title: "Alarm Responses | Security Partners Ltd.",
  titleUnique: true,
  description:
    "Our trained team responds to your alarm day or night, across Laois and beyond.",
  usesDefaultDescription: false,
  ogImage: null,
  imagesMissingAlt: 0,
  hasH1: true,
  noindex: false,
  siteNoindex: false,
  internalLinks: 1,
}

const check = (input: Partial<CheckInput>, id: string) =>
  runChecks({ ...ok, ...input }).find((r) => r.id === id)

describe("SEO checks (D1.2)", () => {
  it("all eight ids in order", () => {
    expect(runChecks(ok).map((r) => r.id)).toEqual([...SEO_CHECKS])
    expect(SEO_CHECK_COUNT).toBe(8)
    expect(TITLE_RANGE).toEqual([30, 60])
    expect(DESCRIPTION_RANGE).toEqual([70, 160])
  })

  it("a good record passes every check", () => {
    expect(runChecks(ok).every((r) => r.ok)).toBe(true)
  })

  it("title 29 → title-length fails with the exact message", () => {
    expect(
      runChecks({ ...ok, title: "x".repeat(29) }).find(
        (r) => r.id === "title-length"
      )
    ).toEqual({
      id: "title-length",
      ok: false,
      message: "Title is 29 characters (aim for 30–60)",
    })
    expect(check({ title: "x".repeat(30) }, "title-length")?.ok).toBe(true)
    expect(check({ title: "x".repeat(60) }, "title-length")?.ok).toBe(true)
    expect(check({ title: "x".repeat(61) }, "title-length")).toMatchObject({
      ok: false,
      message: "Title is 61 characters (aim for 30–60)",
    })
  })

  it("counts characters, not UTF-16 units", () => {
    // 31 characters, 62 UTF-16 units.
    expect(check({ title: "🔒".repeat(31) }, "title-length")?.ok).toBe(true)
    expect(check({ title: "é".repeat(61) }, "title-length")?.ok).toBe(false)
  })

  it("title-unique", () => {
    expect(check({ titleUnique: false }, "title-unique")).toEqual({
      id: "title-unique",
      ok: false,
      message: "Another page uses the same title",
    })
  })

  it("description: missing, default, length", () => {
    expect(check({ description: null }, "description")).toEqual({
      id: "description",
      ok: false,
      message: "Add a meta description",
    })
    expect(check({ description: "   " }, "description")?.message).toBe(
      "Add a meta description"
    )
    expect(check({ usesDefaultDescription: true }, "description")).toEqual({
      id: "description",
      ok: false,
      message: "Uses the site-wide default description",
    })
    expect(check({ description: "x".repeat(69) }, "description")).toEqual({
      id: "description",
      ok: false,
      message: "Description is 69 characters (aim for 70–160)",
    })
    expect(check({ description: "x".repeat(70) }, "description")?.ok).toBe(true)
    expect(check({ description: "x".repeat(160) }, "description")?.ok).toBe(
      true
    )
    expect(check({ description: "x".repeat(161) }, "description")?.ok).toBe(
      false
    )
  })

  it("og-image 1200×630 passes; 1200×600 fails; null (generated card) passes", () => {
    expect(
      check({ ogImage: { width: 1200, height: 630 } }, "og-image")?.ok
    ).toBe(true)
    expect(
      check({ ogImage: { width: 1200, height: 600 } }, "og-image")
    ).toEqual({
      id: "og-image",
      ok: false,
      message: "Share image should be at least 1200×630 (1.91:1)",
    })
    expect(check({ ogImage: null }, "og-image")?.ok).toBe(true)
  })

  it("isShareImageSize: at least 1200×630, ratio 1.91 ± 0.05", () => {
    expect(isShareImageSize(1200, 630)).toBe(true)
    expect(isShareImageSize(2400, 1260)).toBe(true)
    expect(isShareImageSize(1200, 600)).toBe(false) // 2.0
    expect(isShareImageSize(1199, 628)).toBe(false) // too small
    expect(isShareImageSize(1200, 1200)).toBe(false) // square
    expect(isShareImageSize(1250, 640)).toBe(true) // 1.953
    expect(isShareImageSize(1300, 650)).toBe(false) // 2.0
  })

  it("alt-text counts images", () => {
    expect(check({ imagesMissingAlt: 2 }, "alt-text")).toEqual({
      id: "alt-text",
      ok: false,
      message: "2 image(s) missing alt text",
    })
  })

  it("h1", () => {
    expect(check({ hasH1: false }, "h1")).toEqual({
      id: "h1",
      ok: false,
      message: "No main heading (H1)",
    })
  })

  it("noindex makes indexable fail", () => {
    expect(check({ noindex: true }, "indexable")).toEqual({
      id: "indexable",
      ok: false,
      message: "Hidden from search engines",
    })
  })

  it("siteNoindex makes indexable fail with the site message", () => {
    expect(check({ siteNoindex: true, noindex: true }, "indexable")).toEqual({
      id: "indexable",
      ok: false,
      message: "The whole site is hidden from search engines (SEO › Defaults)",
    })
  })

  it("internal-link: 0 fails; null (no rich text) passes", () => {
    expect(check({ internalLinks: 0 }, "internal-link")).toEqual({
      id: "internal-link",
      ok: false,
      message: "No links to other pages on this site",
    })
    expect(check({ internalLinks: null }, "internal-link")?.ok).toBe(true)
  })
})
