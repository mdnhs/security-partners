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
