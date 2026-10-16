import { describe, expect, it } from "vitest"

import {
  EDITABLE_SETTINGS_KEYS,
  firstReadableSettingsKey,
  readableSettingsKeys,
} from "@/lib/admin/settings-keys"

describe("settings landing (no overview page)", () => {
  it("lands readers on the first key in tab order", () => {
    expect(firstReadableSettingsKey(["viewer"])).toBe("site")
    expect(readableSettingsKeys(["editor"])).toEqual([
      ...EDITABLE_SETTINGS_KEYS,
    ])
  })

  it("has no landing key for roles without settings:read", () => {
    expect(readableSettingsKeys(["author"])).toEqual([])
    expect(firstReadableSettingsKey(["author"])).toBeUndefined()
    expect(firstReadableSettingsKey([])).toBeUndefined()
  })
})
