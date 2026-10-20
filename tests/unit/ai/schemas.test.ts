import { describe, expect, it } from "vitest"

import {
  AI_MAX_MESSAGE_CHARS,
  AI_MAX_RECORD_CHARS,
  chatInput,
  conversationsQuery,
} from "@/lib/schemas/api/ai"
import {
  AI_CLAUDE_MODELS,
  AI_DEFAULT_MODEL,
  INTEGRATIONS,
} from "@/lib/schemas/integrations"

const context = {
  screen: "Home page",
  entityType: "page",
  entityId: "home",
  field: {
    path: "hero.heading",
    label: "Heading",
    value: "Old heading",
    maxLength: 80,
  },
  record: { hero: { heading: "Old heading" } },
}

describe("chat input (spec §8.3)", () => {
  it("accepts a message with the screen context", () => {
    const parsed = chatInput.parse({ message: "  Shorter please  ", context })
    expect(parsed.message).toBe("Shorter please")
    expect(parsed.context).toEqual(context)
    expect(chatInput.safeParse({ message: "Hi" }).success).toBe(true)
  })

  it("rejects empty and over-long messages", () => {
    const empty = chatInput.safeParse({ message: "   " })
    expect(empty.success).toBe(false)
    expect(empty.error!.issues[0].path).toEqual(["message"])
    expect(
      chatInput.safeParse({ message: "x".repeat(AI_MAX_MESSAGE_CHARS) }).success
    ).toBe(true)
    expect(
      chatInput.safeParse({ message: "x".repeat(AI_MAX_MESSAGE_CHARS + 1) })
        .success
    ).toBe(false)
  })

  it("caps the screen data and checks ids, paths and entity types", () => {
    const big = chatInput.safeParse({
      message: "Hi",
      context: {
        ...context,
        record: { body: "x".repeat(AI_MAX_RECORD_CHARS) },
      },
    })
    expect(big.success).toBe(false)
    expect(big.error!.issues[0].path).toEqual(["context", "record"])
    expect(
      chatInput.safeParse({ message: "Hi", conversationId: "nope" }).success
    ).toBe(false)
    expect(
      chatInput.safeParse({
        message: "Hi",
        context: {
          ...context,
          field: { ...context.field, path: "hero heading" },
        },
      }).success
    ).toBe(false)
    expect(
      chatInput.safeParse({
        message: "Hi",
        context: { ...context, entityType: "Page!" },
      }).success
    ).toBe(false)
  })

  it("pages conversations with the shared list defaults", () => {
    expect(conversationsQuery.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(conversationsQuery.safeParse({ pageSize: "101" }).success).toBe(
      false
    )
  })
})

describe("AI integration defaults (latest Claude models)", () => {
  it("defaults to Claude Sonnet 5.5 and accepts every listed Claude model", () => {
    expect(AI_DEFAULT_MODEL).toBe("claude-sonnet-5-5")
    expect(AI_CLAUDE_MODELS).toEqual([
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-haiku-5-5",
    ])
    expect(INTEGRATIONS["integrations.ai"].defaults).toMatchObject({
      provider: "anthropic",
      model: "claude-sonnet-5-5",
    })
    for (const model of AI_CLAUDE_MODELS)
      expect(
        INTEGRATIONS["integrations.ai"].schema.safeParse({
          enabled: true,
          provider: "anthropic",
          model,
          apiKey: "sk-ant-1234",
          allowedRoles: ["owner"],
        }).success
      ).toBe(true)
  })
})
