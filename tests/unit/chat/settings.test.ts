import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { CHAT_SETTINGS_DEFAULT } from "@/lib/chat/defaults"
import { chatSettings, type ChatSettings } from "@/lib/schemas/settings/chat"

const withChange = (change: (value: ChatSettings) => void): ChatSettings => {
  const value = structuredClone(CHAT_SETTINGS_DEFAULT)
  change(value)
  return value
}

describe("chat settings", () => {
  it("defaults validate", () => {
    expect(chatSettings.parse(CHAT_SETTINGS_DEFAULT)).toEqual(
      CHAT_SETTINGS_DEFAULT
    )
  })

  it("off by default", () => {
    expect(CHAT_SETTINGS_DEFAULT.enabled).toBe(false)
    expect(CHAT_SETTINGS_DEFAULT.bot.enabled).toBe(false)
  })

  it("rejects bad values", () => {
    const bad = [
      withChange((v) => (v.bot.maxAiReplies = 0)),
      withChange((v) => (v.bot.name = "x".repeat(41))),
      withChange(
        (v) =>
          (v.hint.presets = Array.from({ length: 7 }, (_, i) => ({
            label: `Question ${i}`,
            message: "",
          })))
      ),
      withChange((v) => (v.copy.title = "")),
      withChange((v) => (v.copy.privacyHref = "javascript:x")),
    ]
    for (const value of bad)
      expect(chatSettings.safeParse(value).success).toBe(false)
  })

  it("the migration inserts exactly the defaults", () => {
    const sql = readFileSync("server/db/migrations/0026_live_chat.sql", "utf8")
    const insert = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .find((statement) => statement.startsWith('INSERT INTO "settings"'))
    expect(insert).toBeDefined()
    expect(insert).toContain("('chat', ")
    expect(insert).toMatch(/ON CONFLICT \("key"\) DO NOTHING;$/)
    const literals = [...insert!.matchAll(/'((?:[^']|'')*)'::jsonb/g)].map(
      (match) => JSON.parse(match[1].replaceAll("''", "'"))
    )
    expect(literals).toHaveLength(2)
    // Read through the schema, as the app reads the row: fields added after
    // 0026 (copy.emailDismiss) come from their schema defaults.
    for (const value of literals)
      expect(chatSettings.parse(value)).toEqual(CHAT_SETTINGS_DEFAULT)
  })

  it("settings stored before copy.emailDismiss still parse, with its default", () => {
    const { emailDismiss, ...copy } = CHAT_SETTINGS_DEFAULT.copy
    const parsed = chatSettings.parse({ ...CHAT_SETTINGS_DEFAULT, copy })
    expect(parsed.copy.emailDismiss).toBe(emailDismiss)
  })

  it("no therapy wording", () => {
    expect(JSON.stringify(CHAT_SETTINGS_DEFAULT)).not.toMatch(
      /health|medical|crisis|Magda|therap/i
    )
  })
})
