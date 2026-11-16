import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ChromeReady, whenChromeReady } from "@/components/motion/chrome-ready"

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  vi.useRealTimers()
})

describe("whenChromeReady", () => {
  it("runs at once when the page has no navbar or footer", () => {
    const run = vi.fn()
    whenChromeReady(run)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it("waits for a footer in the DOM to hydrate, then runs once", () => {
    document.body.innerHTML = "<footer data-site-footer></footer>"
    const run = vi.fn()
    whenChromeReady(run)
    expect(run).not.toHaveBeenCalled()
    render(<ChromeReady part="footer" />)
    expect(run).toHaveBeenCalledTimes(1)
    // Hydrated parts stay hydrated: a later page runs straight away.
    const later = vi.fn()
    whenChromeReady(later)
    expect(later).toHaveBeenCalledTimes(1)
  })

  it("can be cancelled before the footer hydrates", () => {
    document.body.innerHTML = "<header data-site-header></header>"
    const run = vi.fn()
    const cancel = whenChromeReady(run)
    cancel()
    render(<ChromeReady part="header" />)
    expect(run).not.toHaveBeenCalled()
  })

  it("gives up waiting after a few seconds so the page still gets its motion", async () => {
    vi.resetModules()
    const fresh = await import("@/components/motion/chrome-ready")
    vi.useFakeTimers()
    document.body.innerHTML = "<footer data-site-footer></footer>"
    const run = vi.fn()
    fresh.whenChromeReady(run)
    act(() => {
      vi.advanceTimersByTime(3999)
    })
    expect(run).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(run).toHaveBeenCalledTimes(1)
  })
})
