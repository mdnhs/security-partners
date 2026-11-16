import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ChatHint } from "@/components/chat/chat-hint"
import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import type { ChatSettings } from "@/lib/schemas/settings/chat"

import { stubMedia } from "./test-media"

// Port of JW features/chat/chat-hint.test.tsx onto CP's settings copy.

const { copy, hint: HINT } = CHAT_SETTINGS_DEFAULT

function setup({
  online = false,
  hint = HINT,
}: { online?: boolean; hint?: ChatSettings["hint"] } = {}) {
  const onOpen = vi.fn()
  const onGone = vi.fn()
  const view = render(
    <ChatHint
      hint={hint}
      copy={copy}
      online={online}
      skipEntrance={false}
      onEntered={() => {}}
      onOpen={onOpen}
      onGone={onGone}
    />
  )
  return { onOpen, onGone, ...view }
}
const trigger = () => screen.getByRole("button", { name: HINT.title })
const group = () => screen.getByRole("group", { name: copy.hintGroup })

describe("ChatHint", () => {
  it("shows the title, the subtitle and the online dot", () => {
    stubMedia(true)
    const { container, unmount } = setup({ online: true })
    expect(trigger().textContent).toContain(HINT.title)
    expect(screen.getByText(HINT.subtitle)).toBeInTheDocument()
    expect(container.querySelector("[data-online-dot]")).not.toBeNull()
    unmount()
    const offline = setup()
    expect(offline.container.querySelector("[data-online-dot]")).toBeNull()
  })

  it("lists the five default presets", () => {
    stubMedia(true)
    setup()
    fireEvent.click(trigger())
    const labels = Array.from(group().querySelectorAll("li button")).map(
      (b) => b.textContent
    )
    expect(labels).toEqual(HINT.presets.map((p) => p.label))
    expect(labels).toHaveLength(5)
  })

  it("picking one calls onOpen with its message", () => {
    stubMedia(true)
    const { onOpen } = setup()
    expect(trigger()).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(trigger())
    expect(trigger()).toHaveAttribute("aria-expanded", "true")
    const third = HINT.presets[2]!
    fireEvent.click(screen.getByRole("button", { name: third.label }))
    expect(onOpen).toHaveBeenCalledWith(third.message)
  })

  it("empty presets: no tray, main row opens", () => {
    stubMedia(true)
    const { onOpen, container } = setup({ hint: { ...HINT, presets: [] } })
    expect(container.querySelector("ul")).toBeNull()
    expect(trigger()).not.toHaveAttribute("aria-expanded")
    fireEvent.click(trigger())
    expect(onOpen).toHaveBeenCalledWith("")
  })

  it("keyboard focus expands the tray", () => {
    stubMedia(true)
    setup()
    fireEvent.focus(trigger())
    expect(trigger()).toHaveAttribute("aria-expanded", "true")
  })

  it("Escape/blur collapses", () => {
    stubMedia(true)
    render(<button type="button">outside</button>)
    setup()
    fireEvent.focus(trigger())
    expect(trigger()).toHaveAttribute("aria-expanded", "true")
    fireEvent.keyDown(trigger(), { key: "Escape" })
    expect(trigger()).toHaveAttribute("aria-expanded", "false")
    fireEvent.focus(trigger())
    expect(trigger()).toHaveAttribute("aria-expanded", "true")
    fireEvent.blur(trigger(), {
      relatedTarget: screen.getByRole("button", { name: "outside" }),
    })
    expect(trigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("Escape on an option moves focus to the trigger and collapses", () => {
    stubMedia(true)
    setup()
    fireEvent.click(trigger())
    const option = screen.getByRole("button", {
      name: HINT.presets[0]!.label,
    })
    option.focus()
    expect(trigger()).toHaveAttribute("aria-expanded", "true")
    fireEvent.keyDown(option, { key: "Escape" })
    expect(trigger()).toHaveFocus()
    expect(trigger()).toHaveAttribute("aria-expanded", "false")
  })

  it("the dismiss button hides the pill at once with reduced motion", () => {
    stubMedia(true)
    const { onGone } = setup()
    fireEvent.click(screen.getByRole("button", { name: copy.hintDismiss }))
    expect(onGone).toHaveBeenCalledTimes(1)
  })

  it("the dismiss button closes the pill as a shrinking circle, then reports it gone", async () => {
    stubMedia(false)
    const { onGone } = setup()
    fireEvent.click(screen.getByRole("button", { name: copy.hintDismiss }))
    expect(onGone).not.toHaveBeenCalled()
    await waitFor(() => expect(onGone).toHaveBeenCalledTimes(1))
  })

  it("with reduced motion the text is never moved out of view", () => {
    stubMedia(false)
    const moving = setup()
    const risen =
      moving.container.querySelector<HTMLElement>("[data-hint-rise]")
    expect(risen?.style.transform).toContain("translate")
    moving.unmount()
    stubMedia(true)
    const still = setup()
    for (const el of still.container.querySelectorAll<HTMLElement>(
      "[data-hint-rise]"
    )) {
      expect(el.style.transform).toBe("")
      expect(el.style.opacity).toBe("")
    }
  })
})
