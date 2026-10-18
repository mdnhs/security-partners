import { describe, expect, it, vi } from "vitest"

import {
  type AnalyticsWindow,
  classifyClick,
  track,
} from "@/lib/analytics/events"

const fakeWindow = (consent: AnalyticsWindow["__spConsent"]) =>
  ({
    __spConsent: consent,
    dataLayer: [] as unknown[],
    gtag: vi.fn(),
    fbq: Object.assign(vi.fn(), { queue: [], loaded: true, version: "2.0" }),
  }) as unknown as AnalyticsWindow & {
    dataLayer: unknown[]
    gtag: ReturnType<typeof vi.fn>
    fbq: ReturnType<typeof vi.fn>
  }

describe("typed analytics events", () => {
  it("sends nothing without consent", () => {
    for (const consent of [undefined, null]) {
      const win = fakeWindow(consent)
      expect(track({ event: "phone_click", link_url: "tel:1" }, win)).toBe(
        false
      )
      expect(win.dataLayer).toEqual([])
    }
  })

  it("analytics consent: dataLayer + gtag event", () => {
    const win = fakeWindow({ analytics: true, marketing: false })
    expect(
      track({ event: "lead_submitted", source_page: "/contact" }, win)
    ).toBe(true)
    expect(win.dataLayer).toEqual([
      { event: "lead_submitted", source_page: "/contact" },
    ])
    expect(win.gtag).toHaveBeenCalledWith("event", "lead_submitted", {
      source_page: "/contact",
    })
    expect(win.fbq).not.toHaveBeenCalled()
  })

  it("marketing consent only: a Meta Lead for enquiries, no dataLayer", () => {
    const win = fakeWindow({ analytics: false, marketing: true })
    track({ event: "lead_submitted", source_page: "/" }, win)
    expect(win.fbq).toHaveBeenCalledWith("track", "Lead")
    expect(win.dataLayer).toEqual([])
  })

  it("classifies clicks on phone, email and contact links", () => {
    expect(classifyClick("tel:0858018746", "(085) 8018746")).toEqual({
      event: "phone_click",
      link_url: "tel:0858018746",
    })
    expect(classifyClick("mailto:info@x.ie", "info@x.ie")).toEqual({
      event: "email_click",
      link_url: "mailto:info@x.ie",
    })
    expect(classifyClick("/contact", "  Get a\n Quote ")).toEqual({
      event: "cta_click",
      link_text: "Get a Quote",
      link_url: "/contact",
    })
    expect(classifyClick("/services", "Services")).toBeNull()
  })
})
