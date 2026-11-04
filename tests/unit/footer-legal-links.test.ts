import { describe, expect, it } from "vitest"

import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { chromeView } from "@/templates/shared/views"

describe("chromeView footer legal links", () => {
  it("keeps Privacy and Terms and appends no extras by default", () => {
    const { footer } = chromeView(fixtureSiteSources())
    expect(footer.legal.privacy.href).toBe("/privacy")
    expect(footer.legal.terms.href).toBe("/terms")
    expect(footer.legal.extra).toEqual([])
  })

  it("appends the published legal pages after them, in the order given, at /<slug>", () => {
    const { footer } = chromeView({
      ...fixtureSiteSources(),
      legalLinks: [
        { slug: "cookie-policy", title: "Cookie Policy" },
        { slug: "acceptable-use", title: "Acceptable Use" },
      ],
    })
    expect(footer.legal.extra).toEqual([
      { label: "Cookie Policy", href: "/cookie-policy" },
      { label: "Acceptable Use", href: "/acceptable-use" },
    ])
    expect(footer.legal.privacy.href).toBe("/privacy")
  })
})
