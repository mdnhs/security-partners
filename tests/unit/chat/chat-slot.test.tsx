import { isValidElement, type ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import type { ChatWidgetProps } from "@/lib/chat/text"

const state = vi.hoisted(() => ({
  draft: false,
  chat: null as unknown,
  connections: 0,
}))

vi.mock("next/server", () => ({
  connection: async () => {
    state.connections += 1
  },
}))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: state.draft }),
}))
vi.mock("@/server/modules/settings/queries", () => ({
  getPublishedSettings: async (key: string) => {
    const value = key === "chat" ? state.chat : null
    if (value instanceof Error) throw value
    return value
  },
}))
vi.mock("@/components/chat/chat-launcher-lazy", () => ({
  ChatLauncherLazy: () => null,
}))

import { ChatLauncherLazy } from "@/components/chat/chat-launcher-lazy"
import { ChatSlot } from "@/components/chat/chat-slot"

const ON = { ...CHAT_SETTINGS_DEFAULT, enabled: true }

beforeEach(() => {
  state.draft = false
  state.chat = ON
  state.connections = 0
})

describe("ChatSlot", () => {
  it("null when chat settings are null, disabled, or in draft mode", async () => {
    state.chat = null
    expect(await ChatSlot()).toBeNull()
    state.chat = CHAT_SETTINGS_DEFAULT
    expect(await ChatSlot()).toBeNull()
    state.chat = ON
    state.draft = true
    expect(await ChatSlot()).toBeNull()
    expect(state.connections).toBe(3)
  })

  it("renders the launcher with the filled team and bot names when enabled", async () => {
    const el = (await ChatSlot()) as ReactElement<ChatWidgetProps>
    expect(isValidElement(el)).toBe(true)
    expect(el.type).toBe(ChatLauncherLazy)
    expect(el.props.team).toBe("the Security Partners team")
    expect(el.props.botName).toBe("Assistant")
    expect(el.props.quoteHref).toBe("/contact")
    expect(el.props.copy).toEqual(CHAT_SETTINGS_DEFAULT.copy)
    expect(el.props.hint).toEqual(CHAT_SETTINGS_DEFAULT.hint)
  })

  it("a failed read is treated as off", async () => {
    state.chat = new Error("db down")
    expect(await ChatSlot()).toBeNull()
  })
})
