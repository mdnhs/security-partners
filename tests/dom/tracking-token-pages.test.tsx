import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const loaders = vi.hoisted(() => ({ startTracking: vi.fn(() => []) }))
vi.mock("@/lib/analytics/loaders", () => loaders)
vi.mock("@/components/consent/consent-provider", () => ({
  useConsent: () => ({ choice: { analytics: true, marketing: true } }),
}))

import { TrackingScripts } from "@/components/consent/tracking-scripts"

const ids = { gtmId: "GTM-X", ga4Id: "G-X", metaPixelId: "1" }

afterEach(() => {
  loaders.startTracking.mockClear()
  window.history.replaceState(null, "", "/")
})

describe("TrackingScripts on newsletter token pages", () => {
  it("does not load tags while the URL carries a newsletter token", () => {
    window.history.replaceState(null, "", "/newsletter/confirm?token=secret")
    render(<TrackingScripts ids={ids} />)
    expect(loaders.startTracking).not.toHaveBeenCalled()
  })

  it("loads them on every other page", () => {
    window.history.replaceState(null, "", "/newsletter/confirmed")
    render(<TrackingScripts ids={ids} />)
    expect(loaders.startTracking).toHaveBeenCalledOnce()
  })
})
