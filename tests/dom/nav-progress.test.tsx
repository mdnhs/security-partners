import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const nav = vi.hoisted(() => ({ path: "/services" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))

import { NavProgress } from "@/components/motion/nav-progress"

const bar = () => document.querySelector("[data-nav-progress]")

function link(href: string, attrs: Record<string, string> = {}) {
  const a = document.createElement("a")
  a.href = href
  for (const [k, v] of Object.entries(attrs)) a.setAttribute(k, v)
  document.body.append(a)
  return a
}

beforeEach(() => {
  nav.path = "/services"
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  document.body.innerHTML = ""
  vi.useRealTimers()
})

describe("NavProgress", () => {
  it("shows nothing until a link to another page is clicked", () => {
    render(<NavProgress />)
    expect(bar()).toBeNull()
  })

  it("starts on the click, and finishes when the new page arrives", () => {
    const { rerender } = render(<NavProgress />)
    fireEvent.click(link("/services/alarm-responses"))
    expect(bar()).not.toBeNull()
    nav.path = "/services/alarm-responses"
    rerender(<NavProgress />)
    expect(bar()).not.toBeNull() // finishing
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(bar()).toBeNull()
  })

  it("ignores links that stay on the page, leave the site or open elsewhere", () => {
    render(<NavProgress />)
    fireEvent.click(link("/services#top"))
    fireEvent.click(link("/services?x=1"))
    fireEvent.click(link("https://example.com/other"))
    fireEvent.click(link("/about", { target: "_blank" }))
    fireEvent.click(link("/about"), { metaKey: true })
    fireEvent.click(link("/about"), { button: 1 })
    expect(bar()).toBeNull()
  })

  it("never keeps running for a click that did not navigate", () => {
    render(<NavProgress />)
    fireEvent.click(link("/about"))
    expect(bar()).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(10_100)
    })
    expect(bar()).toBeNull()
  })
})
