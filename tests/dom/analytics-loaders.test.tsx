import { beforeEach, describe, expect, it } from "vitest"

import type { AnalyticsWindow } from "@/lib/analytics/events"
import { startTracking } from "@/lib/analytics/loaders"

const IDS = { gtmId: "GTM-TEST1", ga4Id: "G-TEST1", metaPixelId: "1234567890" }

const srcs = () =>
  [...document.querySelectorAll("script[data-sp-src]")].map(
    (s) => (s as HTMLScriptElement).dataset.spSrc
  )

beforeEach(() => {
  document.head.innerHTML = ""
  const win = window as AnalyticsWindow
  delete win.dataLayer
  delete win.gtag
  delete win.fbq
  delete win._fbq
})

describe("startTracking (after consent)", () => {
  it("analytics only: Consent Mode first, then GTM and GA4; no Meta", () => {
    const win = window as AnalyticsWindow
    const loaded = startTracking(
      IDS,
      { analytics: true, marketing: false },
      { win, doc: document }
    )
    expect(loaded).toEqual(["gtm", "ga4"])
    expect(srcs()).toEqual([
      "https://www.googletagmanager.com/gtm.js?id=GTM-TEST1",
      "https://www.googletagmanager.com/gtag/js?id=G-TEST1",
    ])
    const commands = win.dataLayer!.map((entry) =>
      Array.from(entry as ArrayLike<unknown>).slice(0, 2)
    )
    expect(commands[0]).toEqual(["consent", "default"])
    expect(commands[1]).toEqual(["consent", "update"])
    expect(win.fbq).toBeUndefined()
  })

  it("marketing adds the Meta pixel; a second call loads nothing twice", () => {
    const win = window as AnalyticsWindow
    const env = { win, doc: document }
    startTracking(IDS, { analytics: true, marketing: true }, env)
    expect(srcs()).toContain("https://connect.facebook.net/en_US/fbevents.js")
    expect(
      startTracking(IDS, { analytics: true, marketing: true }, env)
    ).toEqual([])
    expect(srcs()).toHaveLength(3)
  })

  it("nothing granted, nothing loaded", () => {
    expect(
      startTracking(
        IDS,
        { analytics: false, marketing: false },
        { win: window as AnalyticsWindow, doc: document }
      )
    ).toEqual([])
    expect(srcs()).toEqual([])
  })
})
