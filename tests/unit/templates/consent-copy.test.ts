import { describe, expect, it } from "vitest"

import {
  type ConsentSettings,
  consentSettings,
} from "@/lib/schemas/settings/consent"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"
import { fixtureSiteSources } from "@/server/db/seed/fixtures/sources"
import { consentBannerCopy } from "@/templates/shared/consent"

const s = fixtureSiteSources()
const seeded = settingsFixture(fixtureMediaLookup).consent

describe("consent banner close label (spec §5.2: ARIA labels are settings)", () => {
  it("is seeded as Close and passed to the banner", () => {
    expect(seeded.closeLabel).toBe("Close")
    expect(consentBannerCopy(s, seeded).closeLabel).toBe("Close")
  })

  it("an edited label is used", () => {
    expect(
      consentBannerCopy(s, { ...seeded, closeLabel: "Close the banner" })
        .closeLabel
    ).toBe("Close the banner")
  })

  it("a value stored before the field existed parses to Close (no migration)", () => {
    const older: Partial<ConsentSettings> = structuredClone(seeded)
    delete older.closeLabel
    expect(consentSettings.parse(older).closeLabel).toBe("Close")
    // Public reads are not re-parsed: the view falls back too.
    expect(
      consentBannerCopy(s, older as unknown as ConsentSettings).closeLabel
    ).toBe("Close")
  })
})

describe("consent version and re-consent interval (D2.2)", () => {
  it("are seeded as version 1, every 6 months, and carried to the banner", () => {
    expect(seeded).toMatchObject({ version: 1, reconsentMonths: 6 })
    expect(consentBannerCopy(s, seeded)).toMatchObject({
      version: 1,
      reconsentMonths: 6,
    })
    expect(
      consentBannerCopy(s, { ...seeded, version: 4, reconsentMonths: 2 })
    ).toMatchObject({ version: 4, reconsentMonths: 2 })
  })

  it("version is a whole number from 1; the interval is 1–6 months", () => {
    const ok = (patch: object) =>
      consentSettings.safeParse({ ...seeded, ...patch }).success
    expect(ok({ version: 2, reconsentMonths: 1 })).toBe(true)
    expect(ok({ reconsentMonths: 6 })).toBe(true)
    for (const bad of [
      { version: 0 },
      { version: 1.5 },
      { reconsentMonths: 0 },
      { reconsentMonths: 7 },
      { reconsentMonths: 2.5 },
    ])
      expect(ok(bad), JSON.stringify(bad)).toBe(false)
  })

  it("a value stored before the fields existed reads as version 1, 6 months", () => {
    const older: Partial<ConsentSettings> = structuredClone(seeded)
    delete older.version
    delete older.reconsentMonths
    expect(consentSettings.parse(older)).toMatchObject({
      version: 1,
      reconsentMonths: 6,
    })
    expect(
      consentBannerCopy(s, older as unknown as ConsentSettings)
    ).toMatchObject({ version: 1, reconsentMonths: 6 })
  })
})
