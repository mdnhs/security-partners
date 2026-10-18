import { describe, expect, it } from "vitest"

import { effectiveSeo, filled } from "@/lib/seo/effective"

const defaults = {
  title: "Security Partners Ltd. | Watching Over You",
  titleTemplate: "{title} | Security Partners Ltd.",
  description: "Default description.",
}
const values = { phone24h: "(085) 8018746" }

describe("effective SEO (record → fallbacks → site defaults)", () => {
  it("filled treats blank strings as unset", () => {
    expect(filled("  ")).toBeNull()
    expect(filled("")).toBeNull()
    expect(filled(undefined)).toBeNull()
    expect(filled("x")).toBe("x")
  })

  it("home: the site title and the default description", () => {
    expect(
      effectiveSeo({
        seo: {},
        defaults,
        name: null,
        fallbackDescription: null,
        values,
      })
    ).toEqual({
      title: defaults.title,
      description: "Default description.",
      usesDefaultDescription: true,
    })
  })

  it("records use the title template and their own fallback description", () => {
    expect(
      effectiveSeo({
        seo: { title: "" },
        defaults,
        name: "Alarm Responses",
        fallbackDescription: "Call {phone24h} any time.",
        values,
      })
    ).toEqual({
      title: "Alarm Responses | Security Partners Ltd.",
      description: "Call (085) 8018746 any time.",
      usesDefaultDescription: false,
    })
  })

  it("explicit SEO fields win and are interpolated", () => {
    expect(
      effectiveSeo({
        seo: { title: "24/7 on {phone24h}", description: "Own text" },
        defaults,
        name: "Ignored",
        fallbackDescription: "Ignored",
        values,
      })
    ).toEqual({
      title: "24/7 on (085) 8018746",
      description: "Own text",
      usesDefaultDescription: false,
    })
  })
})
