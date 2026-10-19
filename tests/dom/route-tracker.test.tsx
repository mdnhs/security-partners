import { render } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AnalyticsWindow } from "@/lib/analytics/events"

const nav = vi.hoisted(() => ({ pathname: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))

import { RouteTracker } from "@/components/consent/route-tracker"

const win = window as AnalyticsWindow

const pageViews = () =>
  (win.dataLayer ?? []).filter(
    (e) => (e as { event?: string }).event === "page_view_virtual"
  )

beforeEach(() => {
  nav.pathname = "/"
  win.dataLayer = []
  win.__spConsent = { analytics: true, marketing: false }
  document.title = "Home"
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    cb(0)
    return 1
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  delete win.dataLayer
  delete win.__spConsent
})

describe("RouteTracker (SPA page views, D2.4)", () => {
  it("skips the first page (the tags' own page view covers it)", () => {
    render(<RouteTracker />)
    expect(pageViews()).toEqual([])
  })

  it("pushes page_view_virtual on the second pathname, after a frame", () => {
    const view = render(<RouteTracker />)
    nav.pathname = "/services"
    document.title = "Services"
    view.rerender(<RouteTracker />)
    expect(window.requestAnimationFrame).toHaveBeenCalled()
    expect(pageViews()).toEqual([
      {
        event: "page_view_virtual",
        page_path: "/services",
        page_title: "Services",
      },
    ])
  })

  it("a re-render on the same pathname pushes nothing", () => {
    const view = render(<RouteTracker />)
    view.rerender(<RouteTracker />)
    expect(pageViews()).toEqual([])
  })

  it("StrictMode's double mount does not count as a page change", () => {
    const view = render(
      <StrictMode>
        <RouteTracker />
      </StrictMode>
    )
    expect(pageViews()).toEqual([])
    nav.pathname = "/about"
    view.rerender(
      <StrictMode>
        <RouteTracker />
      </StrictMode>
    )
    expect(pageViews()).toHaveLength(1)
  })

  it("without consent nothing is pushed", () => {
    for (const consent of [undefined, null]) {
      win.__spConsent = consent
      nav.pathname = "/"
      const view = render(<RouteTracker />)
      nav.pathname = "/contact"
      view.rerender(<RouteTracker />)
      view.unmount()
    }
    expect(win.dataLayer).toEqual([])
  })

  it("analytics declined (marketing only): nothing in the dataLayer", () => {
    win.__spConsent = { analytics: false, marketing: true }
    const view = render(<RouteTracker />)
    nav.pathname = "/contact"
    view.rerender(<RouteTracker />)
    expect(win.dataLayer).toEqual([])
  })
})
