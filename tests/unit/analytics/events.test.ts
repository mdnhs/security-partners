import { describe, expect, it, vi } from "vitest"

import {
  type AnalyticsWindow,
  classifyClick,
  cleanPageLocation,
  track,
} from "@/lib/analytics/events"

const fakeWindow = (
  consent: AnalyticsWindow["__spConsent"],
  /** null: no direct GA4 tag (GTM only). */
  ga4Id: string | null = "G-TEST1"
) =>
  ({
    __spConsent: consent,
    __spGa4Id: ga4Id ?? undefined,
    location: {
      origin: "https://www.example.ie",
      pathname: "/contact",
      search: "?email=someone%40example.ie&token=secret",
      hash: "#form",
      href: "https://www.example.ie/contact?email=someone%40example.ie&token=secret#form",
    },
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
      page_location: "https://www.example.ie/contact",
    })
    expect(win.fbq).not.toHaveBeenCalled()
  })

  it("gtag events carry page_location without query or hash (D2.4 minor 3)", () => {
    const win = fakeWindow({ analytics: true, marketing: false })
    track(
      { event: "page_view_virtual", page_path: "/contact", page_title: "C" },
      win
    )
    const call = win.gtag.mock.calls.find((c) => c[0] === "event")!
    const params = call[2] as Record<string, string>
    expect(params.page_location).toBe("https://www.example.ie/contact")
    expect(JSON.stringify(win.gtag.mock.calls)).not.toMatch(/token|email|#/)
    expect(cleanPageLocation(win)).toBe("https://www.example.ie/contact")
  })

  it("a page change sets the GA4 page_location for later automatic hits (D2.4 N1)", () => {
    const win = fakeWindow({ analytics: true, marketing: false })
    track(
      { event: "page_view_virtual", page_path: "/contact", page_title: "C" },
      win
    )
    expect(win.gtag.mock.calls).toEqual([
      ["set", { page_location: "https://www.example.ie/contact" }],
      [
        "event",
        "page_view_virtual",
        {
          page_path: "/contact",
          page_title: "C",
          page_location: "https://www.example.ie/contact",
        },
      ],
    ])
    // Other events leave the page's location alone.
    const other = fakeWindow({ analytics: true, marketing: false })
    track({ event: "phone_click", link_url: "tel:1" }, other)
    expect(other.gtag.mock.calls.map((c) => c[0])).toEqual(["event"])
    // GTM only: no gtag commands at all.
    const gtmOnly = fakeWindow({ analytics: true, marketing: false }, null)
    track(
      { event: "page_view_virtual", page_path: "/contact", page_title: "C" },
      gtmOnly
    )
    expect(gtmOnly.gtag).not.toHaveBeenCalled()
  })

  it("GTM only (no direct GA4 tag): the plain push, no gtag event (no double trigger)", () => {
    const win = fakeWindow({ analytics: true, marketing: false }, null)
    track({ event: "phone_click", link_url: "tel:1" }, win)
    expect(win.dataLayer).toEqual([{ event: "phone_click", link_url: "tel:1" }])
    expect(win.gtag).not.toHaveBeenCalled()
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
