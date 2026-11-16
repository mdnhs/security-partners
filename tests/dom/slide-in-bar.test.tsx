import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { SlideInBar } from "@/components/motion/slide-in-bar"

const scrollTo = (y: number) =>
  act(() => {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true })
    window.dispatchEvent(new Event("scroll"))
  })

beforeEach(() => {
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true })
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 72,
  })
})

afterEach(() => {
  cleanup()
  document.documentElement.style.removeProperty("--sticky-cta-h")
  // @ts-expect-error restoring the jsdom default
  delete HTMLElement.prototype.offsetHeight
})

describe("SlideInBar", () => {
  it("is out of the way on the first screen: inert, no space reserved", () => {
    render(<SlideInBar data-testid="bar">Call</SlideInBar>)
    expect(screen.getByTestId("bar")).toHaveAttribute("inert")
    expect(
      document.documentElement.style.getPropertyValue("--sticky-cta-h")
    ).toBe("0px")
  })

  it("comes in once the page is scrolled and tells the chat how tall it is", () => {
    render(<SlideInBar data-testid="bar">Call</SlideInBar>)
    scrollTo(200)
    expect(screen.getByTestId("bar")).not.toHaveAttribute("inert")
    expect(
      document.documentElement.style.getPropertyValue("--sticky-cta-h")
    ).toBe("72px")
  })

  it("leaves again at the top, and clears the space on unmount", () => {
    const { unmount } = render(<SlideInBar data-testid="bar">Call</SlideInBar>)
    scrollTo(200)
    scrollTo(0)
    expect(screen.getByTestId("bar")).toHaveAttribute("inert")
    expect(
      document.documentElement.style.getPropertyValue("--sticky-cta-h")
    ).toBe("0px")
    scrollTo(200)
    unmount()
    expect(
      document.documentElement.style.getPropertyValue("--sticky-cta-h")
    ).toBe("")
  })
})
