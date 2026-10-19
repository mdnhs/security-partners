import { describe, expect, it } from "vitest"

import {
  isNewsletterState,
  NEWSLETTER_STATES,
  shouldRender,
} from "@/lib/newsletter/placement"

describe("newsletter placement (ruling 2)", () => {
  it("shouldRender: off never renders", () => {
    expect(shouldRender("off", "blog")).toBe(false)
    expect(shouldRender("off", "article")).toBe(false)
    expect(shouldRender("blog", "article")).toBe(false)
    expect(shouldRender("article", "blog")).toBe(false)
    expect(shouldRender("blog", "blog")).toBe(true)
    expect(shouldRender("article", "article")).toBe(true)
  })

  it("state pages: exactly the four API redirect targets", () => {
    expect([...NEWSLETTER_STATES]).toEqual([
      "confirmed",
      "invalid",
      "unsubscribe",
      "unsubscribed",
    ])
    expect(isNewsletterState("confirmed")).toBe(true)
    expect(isNewsletterState("nope")).toBe(false)
    expect(isNewsletterState("toString")).toBe(false)
  })
})
