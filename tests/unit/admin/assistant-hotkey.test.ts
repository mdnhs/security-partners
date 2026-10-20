import { describe, expect, it } from "vitest"

import { isAssistantShortcut } from "@/components/admin/ai/use-assistant-hotkey"

const key = (
  k: string,
  mods: Partial<
    Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>
  > = {}
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
})

describe("assistant shortcut (⌘J / Ctrl+J)", () => {
  it("matches ⌘J and Ctrl+J only", () => {
    expect(isAssistantShortcut(key("j", { metaKey: true }))).toBe(true)
    expect(isAssistantShortcut(key("j", { ctrlKey: true }))).toBe(true)
    expect(isAssistantShortcut(key("J", { ctrlKey: true }))).toBe(true)
    expect(isAssistantShortcut(key("j"))).toBe(false)
    expect(
      isAssistantShortcut(key("j", { ctrlKey: true, shiftKey: true }))
    ).toBe(false)
    expect(isAssistantShortcut(key("j", { metaKey: true, altKey: true }))).toBe(
      false
    )
    expect(isAssistantShortcut(key("k", { metaKey: true }))).toBe(false)
  })

  it("ignores a keydown without a key (Chrome autofill)", () => {
    const autofill = { ...key("j", { metaKey: true }), key: undefined }
    expect(
      isAssistantShortcut(autofill as unknown as ReturnType<typeof key>)
    ).toBe(false)
  })
})
