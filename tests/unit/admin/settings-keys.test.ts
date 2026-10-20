import { describe, expect, it } from "vitest"

import {
  EDITABLE_SETTINGS_KEYS,
  SETTINGS_ENTRIES,
  readableSettingsKeys,
} from "@/lib/admin/settings-keys"

describe("readableSettingsKeys", () => {
  it("lists the keys readers may open, in tab order", () => {
    expect(readableSettingsKeys(["viewer"])[0]).toBe("site")
    expect(readableSettingsKeys(["editor"])).toEqual([
      ...EDITABLE_SETTINGS_KEYS,
    ])
  })

  it("is empty for roles without settings:read", () => {
    expect(readableSettingsKeys(["author"])).toEqual([])
    expect(readableSettingsKeys([])).toEqual([])
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
