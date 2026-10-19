import { describe, expect, it } from "vitest"

import {
  carriesNewsletterToken,
  isNewsletterState,
  NEWSLETTER_STATES,
  newsletterView,
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

  it("state pages: the confirm view plus the four API redirect targets", () => {
    expect([...NEWSLETTER_STATES]).toEqual([
      "confirm",
      "confirmed",
      "invalid",
      "unsubscribe",
      "unsubscribed",
    ])
    expect(isNewsletterState("confirm")).toBe(true)
    expect(isNewsletterState("confirmed")).toBe(true)
    expect(isNewsletterState("nope")).toBe(false)
    expect(isNewsletterState("toString")).toBe(false)
  })
})

describe("newsletterView", () => {
  it("button pages keep a usable token and post it to their API endpoint", () => {
    expect(newsletterView("confirm", "abc")).toEqual({
      state: "confirm",
      token: "abc",
      action: "/api/v1/public/newsletter/confirm",
    })
    expect(newsletterView("unsubscribe", "id.mac")).toEqual({
      state: "unsubscribe",
      token: "id.mac",
      action: "/api/v1/public/newsletter/unsubscribe",
    })
  })

  it("a button page without a usable token shows the invalid copy, no form", () => {
    const invalid = { state: "invalid", token: "", action: null }
    for (const state of ["confirm", "unsubscribe"] as const) {
      expect(newsletterView(state, undefined)).toEqual(invalid)
      expect(newsletterView(state, "")).toEqual(invalid)
      expect(newsletterView(state, ["a", "b"])).toEqual(invalid)
      expect(newsletterView(state, "x".repeat(201))).toEqual(invalid)
    }
    expect(newsletterView("confirm", "x".repeat(200)).state).toBe("confirm")
  })

  it("display states never carry a token", () => {
    for (const state of ["confirmed", "invalid", "unsubscribed"] as const)
      expect(newsletterView(state, "abc")).toEqual({
        state,
        token: "",
        action: null,
      })
  })
})

describe("carriesNewsletterToken (analytics never sees a token URL)", () => {
  it("is true only for a /newsletter/* URL with a token query", () => {
    expect(
      carriesNewsletterToken({
        pathname: "/newsletter/confirm",
        search: "?token=abc",
      })
    ).toBe(true)
    expect(
      carriesNewsletterToken({
        pathname: "/newsletter/unsubscribe",
        search: "?x=1&token=",
      })
    ).toBe(true)
    expect(
      carriesNewsletterToken({ pathname: "/newsletter/confirmed", search: "" })
    ).toBe(false)
    expect(
      carriesNewsletterToken({ pathname: "/blog", search: "?token=abc" })
    ).toBe(false)
  })
})
