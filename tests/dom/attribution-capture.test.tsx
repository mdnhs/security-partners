import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AttributionCapture } from "@/components/attribution-capture"
import { ATTRIBUTION_KEY, readAttribution } from "@/lib/leads/attribution"

afterEach(() => {
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/")
  vi.restoreAllMocks()
})

describe("AttributionCapture (D3.1)", () => {
  it("renders nothing and stores the first touch in sessionStorage", () => {
    window.history.replaceState(
      null,
      "",
      "/services?utm_source=linkedin&utm_campaign=q4&fbclid=zzz"
    )
    const { container } = render(<AttributionCapture />)
    expect(container).toBeEmptyDOMElement()
    const stored = readAttribution(window.sessionStorage)
    expect(stored).toMatchObject({
      landingPath: "/services",
      utm: { utm_source: "linkedin", utm_campaign: "q4" },
    })
    expect(window.sessionStorage.getItem(ATTRIBUTION_KEY)).not.toContain(
      "fbclid"
    )
  })

  it("does not overwrite an earlier touch in the same session", () => {
    window.history.replaceState(null, "", "/a?utm_source=first")
    render(<AttributionCapture />).unmount()
    window.history.replaceState(null, "", "/b?utm_source=second")
    render(<AttributionCapture />)
    expect(readAttribution(window.sessionStorage)?.utm.utm_source).toBe(
      "first"
    )
  })

  it("survives blocked storage", () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError")
    })
    expect(() => render(<AttributionCapture />)).not.toThrow()
  })
})
