import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { AnalyticsWindow } from "@/lib/analytics/events"
import {
  startTracking,
  TRACKING_TEST_PARAM,
  trackingIds,
  trackingTestId,
} from "@/lib/analytics/loaders"

const IDS = { gtmId: "GTM-TEST1", ga4Id: "G-TEST1", metaPixelId: "1234567890" }

const PAGE_LOCATION = () =>
  `${window.location.origin}${window.location.pathname}`

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
  delete win.__spGa4Id
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

const SETTINGS = {
  enabled: true,
  gtmEnabled: true,
  gtmId: "GTM-TEST1",
  ga4Enabled: true,
  ga4Id: "G-TEST1",
  metaEnabled: true,
  metaPixelId: "1234567890",
}

describe("trackingIds (per-channel switches)", () => {
  it("keeps an ID only when its channel is switched on", () => {
    expect(trackingIds(SETTINGS)).toEqual(IDS)
    expect(
      trackingIds({ ...SETTINGS, gtmEnabled: false, metaEnabled: false })
    ).toEqual({ gtmId: null, ga4Id: "G-TEST1", metaPixelId: null })
  })

  it("startTracking with gtmEnabled=false does not inject the GTM script", () => {
    const loaded = startTracking(
      trackingIds({ ...SETTINGS, gtmEnabled: false }),
      { analytics: true, marketing: true },
      { win: window as AnalyticsWindow, doc: document }
    )
    expect(loaded).toEqual(["ga4", "meta"])
    expect(srcs()).not.toContain(
      "https://www.googletagmanager.com/gtm.js?id=GTM-TEST1"
    )
  })
})

describe("tracking test event (sp_tracking_test)", () => {
  const testEvents = (win: AnalyticsWindow) =>
    (win.dataLayer ?? []).filter(
      (e) => (e as { event?: string }).event === "tracking_test"
    )

  it("trackingTestId accepts 8–40 letters, digits and dashes only", () => {
    expect(TRACKING_TEST_PARAM).toBe("sp_tracking_test")
    expect(trackingTestId("?sp_tracking_test=abcdefgh-1")).toBe("abcdefgh-1")
    expect(
      trackingTestId(`?x=1&sp_tracking_test=${crypto.randomUUID()}`)
    ).toMatch(/^[0-9a-f-]{36}$/)
    for (const bad of [
      "",
      "?sp_tracking_test=short",
      "?sp_tracking_test=<script>alert(1)</script>",
      "?sp_tracking_test=%3Cscript%3Ealert1",
      `?sp_tracking_test=${"a".repeat(41)}`,
      "?other=abcdefgh-1",
    ])
      expect(trackingTestId(bad), bad).toBeNull()
  })

  it("analytics consent: pushes tracking_test once and puts GA4 in debug mode", () => {
    const win = window as AnalyticsWindow
    const env = { win, doc: document, search: "?sp_tracking_test=abcdefgh-1" }
    startTracking(IDS, { analytics: true, marketing: false }, env)
    startTracking(IDS, { analytics: true, marketing: true }, env)
    expect(testEvents(win)).toEqual([
      { event: "tracking_test", test_id: "abcdefgh-1" },
    ])
    const config = win
      .dataLayer!.map((e) => Array.from(e as ArrayLike<unknown>))
      .find((args) => args[0] === "config")
    expect(config).toEqual([
      "config",
      "G-TEST1",
      { page_location: PAGE_LOCATION(), debug_mode: true },
    ])
  })

  it("without analytics consent nothing is pushed", () => {
    const win = window as AnalyticsWindow
    const search = "?sp_tracking_test=abcdefgh-1"
    startTracking(
      IDS,
      { analytics: false, marketing: false },
      {
        win,
        doc: document,
        search,
      }
    )
    expect(win.dataLayer).toBeUndefined()
    startTracking(
      IDS,
      { analytics: false, marketing: true },
      {
        win,
        doc: document,
        search,
      }
    )
    expect(testEvents(win)).toEqual([])
  })

  it("an invalid test id is ignored", () => {
    const win = window as AnalyticsWindow
    startTracking(
      IDS,
      { analytics: true, marketing: false },
      {
        win,
        doc: document,
        search: "?sp_tracking_test=<script>",
      }
    )
    expect(testEvents(win)).toEqual([])
    const config = win
      .dataLayer!.map((e) => Array.from(e as ArrayLike<unknown>))
      .find((args) => args[0] === "config")
    expect(config).toEqual([
      "config",
      "G-TEST1",
      { page_location: PAGE_LOCATION() },
    ])
  })
})

describe("GA4 page_location (D2.4 minor 3)", () => {
  afterEach(() => window.history.replaceState(null, "", "/"))

  it("the config's page_location drops the query and hash", () => {
    window.history.replaceState(
      null,
      "",
      "/contact?token=secret&email=a%40b.ie#x"
    )
    const win = window as AnalyticsWindow
    startTracking(
      { ...IDS, gtmId: null },
      { analytics: true, marketing: false },
      { win, doc: document }
    )
    const config = win
      .dataLayer!.map((e) => Array.from(e as ArrayLike<unknown>))
      .find((args) => args[0] === "config")
    expect(config).toEqual([
      "config",
      "G-TEST1",
      { page_location: `${window.location.origin}/contact` },
    ])
    expect(win.__spGa4Id).toBe("G-TEST1")
  })

  it("no direct GA4 tag: no __spGa4Id, so track() sends no gtag events", () => {
    const win = window as AnalyticsWindow
    startTracking(
      { ...IDS, ga4Id: null },
      { analytics: true, marketing: false },
      { win, doc: document }
    )
    expect(win.__spGa4Id).toBeUndefined()
  })
})
