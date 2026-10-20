import { act, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AttributionCapture } from "@/components/attribution-capture"
import type { AnalyticsWindow } from "@/lib/analytics/events"
import { CONSENT_EVENT } from "@/lib/analytics/snippets"
import { ATTRIBUTION_KEY, readAttribution } from "@/lib/leads/attribution"

const win = window as AnalyticsWindow

/** What ConsentProvider does: publish the choice, then announce it. */
function publishConsent(analytics: boolean | null) {
  win.__spConsent = analytics === null ? null : { analytics, marketing: false }
  act(() => {
    window.dispatchEvent(
      new CustomEvent(CONSENT_EVENT, { detail: win.__spConsent })
    )
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  delete win.__spConsent
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/")
})

describe("AttributionCapture (D3.1)", () => {
  it("renders nothing and, with analytics consent, stores the first touch", () => {
    win.__spConsent = { analytics: true, marketing: false }
    window.history.replaceState(
      null,
      "",
      "/services?utm_source=linkedin&utm_campaign=q4&fbclid=zzz"
    )
    const { container } = render(<AttributionCapture />)
    expect(container).toBeEmptyDOMElement()
    expect(readAttribution(window.sessionStorage)).toMatchObject({
      landingPath: "/services",
      utm: { utm_source: "linkedin", utm_campaign: "q4" },
    })
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).not.toContain(
      "fbclid"
    )
  })

  it("stores nothing without consent: tracking off, no choice, or analytics refused", () => {
    window.history.replaceState(null, "", "/?utm_source=x")
    // Tracking off: the provider never publishes.
    render(<AttributionCapture />).unmount()
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBeNull()

    render(<AttributionCapture />)
    publishConsent(null)
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBeNull()
    publishConsent(false)
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBeNull()
  })

  it("consent given later captures the page the visitor is on then", () => {
    window.history.replaceState(null, "", "/?utm_source=landing")
    render(<AttributionCapture />)
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBeNull()

    window.history.replaceState(null, "", "/contact?utm_source=later")
    publishConsent(true)
    expect(readAttribution(window.sessionStorage)).toMatchObject({
      landingPath: "/contact",
      utm: { utm_source: "later" },
    })
  })

  it("withdrawing consent removes the stored value", () => {
    win.__spConsent = { analytics: true, marketing: false }
    window.history.replaceState(null, "", "/?utm_source=x")
    render(<AttributionCapture />)
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).not.toBeNull()
    publishConsent(false)
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).toBeNull()
  })

  it("a later page load keeps the first touch while the provider has not published yet", () => {
    win.__spConsent = { analytics: true, marketing: false }
    window.history.replaceState(null, "", "/a?utm_source=first")
    render(<AttributionCapture />).unmount()
    delete win.__spConsent
    window.history.replaceState(null, "", "/b?utm_source=second")
    render(<AttributionCapture />)
    expect(readAttribution(window.sessionStorage)?.utm.utm_source).toBe("first")
    publishConsent(true)
    expect(readAttribution(window.sessionStorage)?.utm.utm_source).toBe("first")
  })

  it("survives blocked storage", () => {
    win.__spConsent = { analytics: true, marketing: false }
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError")
    })
    expect(() => render(<AttributionCapture />)).not.toThrow()
    expect(() => publishConsent(false)).not.toThrow()
  })
})
