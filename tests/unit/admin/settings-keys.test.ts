import { describe, expect, it } from "vitest"

import {
  EDITABLE_SETTINGS_KEYS,
  SETTINGS_ENTRIES,
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

describe("labels (MK parity spec §5.1)", () => {
  it("site is Identity and microcopy is Forms & microcopy", () => {
    expect(
      EDITABLE_SETTINGS_KEYS.map((key) => SETTINGS_ENTRIES[key].label)
    ).toEqual([
      "Identity",
      "Contact details",
      "Navigation",
      "Footer",
      "Forms & microcopy",
      "About section",
      "Contact section",
      "Enquire banner",
      "Clients strip",
      "Why choose us",
      "Enquiries",
    ])
  })
})
