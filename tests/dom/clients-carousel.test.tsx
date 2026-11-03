import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Clients } from "@/components/home/clients-team-blog"

// jsdom has no Web Animations: a stand-in that records what the carousel asks.
type Fake = {
  keyframes: Keyframe[]
  options: KeyframeAnimationOptions
  state: "running" | "paused" | "cancelled"
  currentTime: number
  pause: () => void
  play: () => void
  cancel: () => void
}
let animations: Fake[] = []

function stubAnimate() {
  animations = []
  Element.prototype.animate = function (
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ) {
    const fake: Fake = {
      keyframes,
      options,
      state: "running",
      currentTime: 0,
      pause() {
        if (fake.state !== "cancelled") fake.state = "paused"
      },
      play() {
        if (fake.state !== "cancelled") fake.state = "running"
      },
      cancel() {
        fake.state = "cancelled"
      },
    }
    animations.push(fake)
    return fake as unknown as Animation
  }
}

function stubMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("reduce"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const clients = [
  { name: "Dinn Rí", logo: "/images/client-dinn-ri.png" },
  { name: "Hayes Hotel", logo: "/images/client-hayes.png" },
  { name: "Telfords", logo: "/images/client-telfords.png" },
]

const view = () =>
  render(
    <Clients eyebrow="Trusted by" heading="Our clients" clients={clients} />
  )
const strip = () => screen.getByRole("region", { name: "Our clients" })

const GROUP = 2400 // px: what the first group measures in these tests
const DURATION = (GROUP / 55) * 1000 // ms for one loop

// A real width for the first group (jsdom measures everything as 0).
function giveGroupsWidth(width: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    () => ({
      width,
      height: 120,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: 120,
      toJSON: () => ({}),
    })
  )
}

const press = (el: Element, type: string, init: PointerEventInit) =>
  fireEvent(
    el,
    new PointerEvent(type, { bubbles: true, pointerId: 1, ...init })
  )

beforeEach(() => {
  stubAnimate()
  stubMotion(false)
  giveGroupsWidth(GROUP)
})
afterEach(() => vi.restoreAllMocks())

describe("Clients carousel", () => {
  it("is a labelled carousel with every client announced once", () => {
    view()
    expect(strip()).toHaveAttribute("aria-roledescription", "carousel")
    // The looping copy is hidden from assistive tech and keyboard.
    for (const logo of clients)
      expect(screen.getAllByRole("img", { name: logo.name })).toHaveLength(1)
    const copies = strip().querySelectorAll("ul")
    expect(copies.length).toBeGreaterThanOrEqual(2)
    for (const copy of [...copies].slice(1)) {
      expect(copy).toHaveAttribute("aria-hidden", "true")
      expect(copy).toHaveAttribute("inert")
    }
  })

  it("has no pause button: the strip itself is what you hold", () => {
    view()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("starts moving on its own, as a seamless loop of one group's width", () => {
    view()
    expect(animations).toHaveLength(1)
    const [a] = animations
    expect(a.state).toBe("running")
    expect(a.options.iterations).toBe(Infinity)
    expect(a.options.easing).toBe("linear")
    expect(a.keyframes).toEqual([
      { transform: "translateX(0)" },
      { transform: `translateX(-${GROUP}px)` },
    ])
    expect(a.options.duration).toBeCloseTo(DURATION)
  })

  it("pauses while a mouse is over it and resumes when it leaves", async () => {
    const user = userEvent.setup()
    view()
    await user.hover(strip())
    expect(animations[0].state).toBe("paused")
    await user.unhover(strip())
    expect(animations[0].state).toBe("running")
  })

  it("can be dragged freely with the mouse: holding stops it, the drag moves it either way, letting go starts it again from there", () => {
    view()
    const a = animations[0]
    a.currentTime = 10_000
    press(strip(), "pointerdown", {
      pointerType: "mouse",
      clientX: 500,
      button: 0,
    })
    expect(a.state).toBe("paused")

    // Pulled left by 240px: the strip moves on, so time goes forward by the
    // matching share of a loop.
    press(strip(), "pointermove", { pointerType: "mouse", clientX: 260 })
    expect(a.currentTime).toBeCloseTo(10_000 + (240 / GROUP) * DURATION)
    // Pulled right past where it started: time goes back.
    press(strip(), "pointermove", { pointerType: "mouse", clientX: 800 })
    expect(a.currentTime).toBeCloseTo(10_000 - (300 / GROUP) * DURATION)

    press(strip(), "pointerup", { pointerType: "mouse", clientX: 800 })
    expect(a.state).toBe("running")
  })

  it("stays inside the loop however far it is dragged (never before the start)", () => {
    view()
    const a = animations[0]
    a.currentTime = 1_000
    press(strip(), "pointerdown", {
      pointerType: "mouse",
      clientX: 100,
      button: 0,
    })
    // Dragged right by more than the whole group: would be negative time.
    press(strip(), "pointermove", {
      pointerType: "mouse",
      clientX: 100 + GROUP + 50,
    })
    expect(a.currentTime).toBeGreaterThanOrEqual(0)
    expect(a.currentTime).toBeLessThan(DURATION)
  })

  it("on a touch screen a tap stops it and the next tap starts it again", () => {
    view()
    const a = animations[0]
    press(strip(), "pointerdown", { pointerType: "touch", clientX: 300 })
    press(strip(), "pointerup", { pointerType: "touch", clientX: 301 })
    expect(a.state).toBe("paused")
    press(strip(), "pointerdown", { pointerType: "touch", clientX: 300 })
    press(strip(), "pointerup", { pointerType: "touch", clientX: 300 })
    expect(a.state).toBe("running")
  })

  it("on a touch screen a swipe moves it while the finger is down and does not leave it stopped", () => {
    view()
    const a = animations[0]
    a.currentTime = 5_000
    press(strip(), "pointerdown", { pointerType: "touch", clientX: 300 })
    expect(a.state).toBe("paused")
    press(strip(), "pointermove", { pointerType: "touch", clientX: 180 })
    expect(a.currentTime).toBeCloseTo(5_000 + (120 / GROUP) * DURATION)
    press(strip(), "pointerup", { pointerType: "touch", clientX: 180 })
    expect(a.state).toBe("running")
  })

  it("lets the page scroll up and down over it (only sideways is its own)", () => {
    view()
    expect(strip().className).toContain("touch-pan-y")
  })

  it("can be reached by keyboard: focus stops it, the arrow keys move it", async () => {
    const user = userEvent.setup()
    view()
    const a = animations[0]
    a.currentTime = 20_000
    await user.tab()
    expect(strip()).toHaveFocus()
    expect(a.state).toBe("paused")
    await user.keyboard("{ArrowRight}")
    expect(a.currentTime).toBeGreaterThan(20_000)
    const after = a.currentTime
    await user.keyboard("{ArrowLeft}{ArrowLeft}")
    expect(a.currentTime).toBeLessThan(after)
    await user.tab()
    expect(a.state).toBe("running")
  })

  it("a mouse click that happens to focus the strip does not keep it stopped", async () => {
    const user = userEvent.setup()
    view()
    const a = animations[0]
    // Clicking focuses the strip (it is tabbable), but that is not the
    // keyboard: once the pointer leaves, it must run again.
    await user.pointer([
      { keys: "[MouseLeft>]", target: strip() },
      { keys: "[/MouseLeft]" },
    ])
    await user.unhover(strip())
    expect(a.state).toBe("running")
  })

  it("does not move for visitors who ask for reduced motion", () => {
    stubMotion(true)
    view()
    expect(animations).toHaveLength(0)
  })

  it("stops its animation when it is removed", () => {
    const { unmount } = view()
    unmount()
    expect(animations[0].state).toBe("cancelled")
  })

  it("repeats a short list so one group is wide enough to loop without a gap", () => {
    view()
    const first = strip().querySelector("ul")!
    // 3 clients x 260px = 780px per pass: repeated until at least 1920px.
    expect(first.children.length).toBeGreaterThanOrEqual(8)
    expect(first.children.length % clients.length).toBe(0)
  })

  it("renders on the server without the browser (no animation yet)", () => {
    animations = []
    const html = renderToStaticMarkup(
      <Clients eyebrow="Trusted by" heading="Our clients" clients={clients} />
    )
    expect(html).toContain("Our clients")
    expect(animations).toHaveLength(0)
  })
})
