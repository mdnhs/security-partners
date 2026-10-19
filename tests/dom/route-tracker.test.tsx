import { render } from "@testing-library/react"
import { StrictMode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AnalyticsWindow } from "@/lib/analytics/events"

const nav = vi.hoisted(() => ({ pathname: "/" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))

import { RouteTracker, TITLE_WAIT_MS } from "@/components/consent/route-tracker"

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
    document.title = "About"
    view.rerender(
      <StrictMode>
        <RouteTracker />
      </StrictMode>
    )
    expect(pageViews()).toHaveLength(1)
  })

  it("waits for the new <title> when it streams in after the path", async () => {
    const view = render(<RouteTracker />)
    nav.pathname = "/about"
    view.rerender(<RouteTracker />)
    // Still the previous page's title: nothing yet.
    expect(pageViews()).toEqual([])
    document.title = "About"
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pageViews()).toEqual([
      { event: "page_view_virtual", page_path: "/about", page_title: "About" },
    ])
  })

  it("a page with the same title is still counted after TITLE_WAIT_MS", () => {
    vi.useFakeTimers()
    try {
      const view = render(<RouteTracker />)
      nav.pathname = "/services/cctv"
      view.rerender(<RouteTracker />)
      vi.advanceTimersByTime(TITLE_WAIT_MS - 1)
      expect(pageViews()).toEqual([])
      vi.advanceTimersByTime(1)
      expect(pageViews()).toEqual([
        {
          event: "page_view_virtual",
          page_path: "/services/cctv",
          page_title: "Home",
        },
      ])
      view.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it("leaving before the title arrives sends nothing stale", () => {
    vi.useFakeTimers()
    try {
      const view = render(<RouteTracker />)
      nav.pathname = "/about"
      view.rerender(<RouteTracker />)
      view.unmount()
      vi.advanceTimersByTime(TITLE_WAIT_MS * 2)
      expect(pageViews()).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it("without consent nothing is pushed", () => {
    for (const consent of [undefined, null]) {
      win.__spConsent = consent
      nav.pathname = "/"
      document.title = "Home"
      const view = render(<RouteTracker />)
      nav.pathname = "/contact"
      document.title = "Contact"
      view.rerender(<RouteTracker />)
      view.unmount()
    }
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2)
    expect(win.dataLayer).toEqual([])
  })

  it("analytics declined (marketing only): nothing in the dataLayer", () => {
    win.__spConsent = { analytics: false, marketing: true }
    const view = render(<RouteTracker />)
    nav.pathname = "/contact"
    document.title = "Contact"
    view.rerender(<RouteTracker />)
    expect(window.requestAnimationFrame).toHaveBeenCalled()
    expect(win.dataLayer).toEqual([])
  })
})
