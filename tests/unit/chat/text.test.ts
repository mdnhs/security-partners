import { describe, expect, it } from "vitest"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { chatLauncherProps, fillChatText } from "@/lib/chat/text"

describe("fillChatText", () => {
  it("fills the given placeholders", () => {
    expect(
      fillChatText("{botName} (AI) · {team} can join", {
        botName: "Assistant",
        team: "the Security Partners team",
      })
    ).toBe("Assistant (AI) · the Security Partners team can join")
  })

  it("leaves unknown and missing placeholders as typed", () => {
    expect(fillChatText("Hi {x} {team}", {})).toBe("Hi {x} {team}")
  })
})

describe("chatLauncherProps", () => {
  it("fills team and bot name once and keeps the copy as templates", () => {
    const props = chatLauncherProps(CHAT_SETTINGS_DEFAULT)
    expect(props.team).toBe("the Security Partners team")
    expect(props.botName).toBe("Assistant")
    expect(props.quoteHref).toBe("/contact")
    expect(props.copy).toEqual(CHAT_SETTINGS_DEFAULT.copy)
    expect(props.hint).toEqual(CHAT_SETTINGS_DEFAULT.hint)
    expect(Object.keys(props).sort()).toEqual(
      ["botName", "copy", "hint", "quoteHref", "team"].sort()
    )
  })
})
