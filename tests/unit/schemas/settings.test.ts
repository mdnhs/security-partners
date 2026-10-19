import { describe, expect, it } from "vitest"

import {
  isSettingsKey,
  PUBLIC_SETTINGS_KEYS,
  SETTINGS_KEYS,
  settingsSchemas,
} from "@/lib/schemas/settings"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

const fixture = settingsFixture(fixtureMediaLookup)

describe("settings schemas (spec §5.4 + shared sections ruling)", () => {
  it("covers exactly the content settings keys", () => {
    expect(SETTINGS_KEYS).toEqual([
      "site",
      "contact",
      "navigation",
      "footer",
      "sections.enquireBanner",
      "sections.clients",
      "sections.whyChooseUs",
      "sections.about",
      "sections.contact",
      "seo.defaults",
      "consent",
      "tracking",
      "customCode",
      "microcopy",
      "leads",
      "newsletter",
    ])
    expect(Object.keys(fixture).sort()).toEqual([...SETTINGS_KEYS].sort())
    expect(PUBLIC_SETTINGS_KEYS.every(isSettingsKey)).toBe(true)
    expect(isSettingsKey("integrations.smtp")).toBe(false)
    expect(isSettingsKey("toString")).toBe(false)
  })

  it.each(SETTINGS_KEYS)(
    "%s parses its fixture and round-trips it unchanged",
    (key) => {
      const parsed = settingsSchemas[key].parse(fixture[key])
      expect(parsed).toEqual(fixture[key])
    }
  )

  it("rejects an unsafe link in navigation", () => {
    const bad = structuredClone(fixture.navigation)
    bad.headerLinks[0].href = "javascript:alert(1)"
    expect(settingsSchemas.navigation.safeParse(bad).success).toBe(false)
  })

  it.each(["javascript:alert(1)", "data:text/html,x"])(
    "rejects %j as a share network href",
    (value) => {
      const bad = structuredClone(fixture.microcopy)
      bad.share.networks[0].href = value
      expect(settingsSchemas.microcopy.safeParse(bad).success).toBe(false)
    }
  )

  it.each(["javascript:alert(1)", "data:text/html,x"])(
    "rejects %j as the site production URL",
    (value) => {
      const bad = { ...fixture.site, productionUrl: value }
      expect(settingsSchemas.site.safeParse(bad).success).toBe(false)
    }
  )

  it("rejects malformed tracking ids", () => {
    expect(
      settingsSchemas.tracking.safeParse({ ...fixture.tracking, gtmId: "UA-1" })
        .success
    ).toBe(false)
  })

  it("newsletter saved before pages.confirm existed parses with the seeded confirm copy", () => {
    const { confirm, ...pages } = fixture.newsletter.pages
    const parsed = settingsSchemas.newsletter.safeParse({
      ...fixture.newsletter,
      pages,
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data?.pages.confirm).toEqual(confirm)
  })

  it("seeds the newsletter off, and refuses to go live half-filled", () => {
    expect(fixture.newsletter.placement).toBe("off")
    const blank = {
      ...fixture.newsletter,
      title: "",
      button: "",
      success: "",
      confirmationEmail: { subject: "", body: "" },
    }
    expect(settingsSchemas.newsletter.safeParse(blank).success).toBe(true)
    const live = settingsSchemas.newsletter.safeParse({
      ...blank,
      placement: "blog",
    })
    expect(live.success).toBe(false)
    expect(live.error?.issues.map((i) => i.path.join("."))).toEqual([
      "title",
      "button",
      "success",
      "confirmationEmail.subject",
    ])
  })

  it("keeps template placeholders verbatim", () => {
    expect(fixture["sections.enquireBanner"].secondaryCta).toEqual({
      label: "Call {office}",
      href: "{officeHref}",
    })
    expect(fixture.microcopy.aria.pageNumber).toBe("Page {n}")
  })
})
