import { describe, expect, it } from "vitest"

import {
  CONTACT_PLACEHOLDERS,
  linkErrors,
  linkProblems,
} from "@/components/admin/schema-form/link-rules"
import { navigationSettings } from "@/lib/schemas/settings/navigation"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"
import { SETTINGS_KEYS, settingsSchemas } from "@/lib/schemas/settings"
import { PAGE_KEYS, templates, templateSchemaFor } from "@/templates/registry"

const pages = pagesFixture(fixtureMediaLookup)

describe("link placeholders and hrefs (ledger: link widget)", () => {
  it("knows the contact placeholder set", () => {
    expect(CONTACT_PLACEHOLDERS).toEqual(
      expect.arrayContaining([
        "phone24h",
        "office",
        "operationsEmail",
        "mapsHref",
        "phone24hHref",
        "officeHref",
        "operationsMobileHref",
      ])
    )
  })

  it("accepts the shipped link shapes", () => {
    expect(
      linkProblems({ label: "Call 24/7: {phone24h}", href: "{phone24hHref}" })
    ).toEqual({})
    expect(
      linkProblems({ label: "Email", href: "mailto:{operationsEmail}" })
    ).toEqual({})
    expect(linkProblems({ label: "Our Services", href: "#services" })).toEqual(
      {}
    )
  })

  it("rejects unknown placeholders in the text and the destination", () => {
    expect(linkProblems({ label: "Call {phone}", href: "/contact" })).toEqual({
      label: expect.stringContaining("{phone}"),
    })
    expect(linkProblems({ label: "Call", href: "{fooHref}" })).toEqual({
      href: expect.stringContaining("{fooHref}"),
    })
    // A known placeholder that is not a URL cannot be a whole destination.
    expect(linkProblems({ label: "Call", href: "{phone24h}" })).toEqual({
      href: expect.stringContaining("{phone24hHref}"),
    })
  })

  it("rejects unsafe destinations", () => {
    for (const href of ["javascript:alert(1)", "//evil.example", "/\\evil"])
      expect(linkProblems({ label: "x", href }).href).toBeTruthy()
  })

  it("finds no problems in the seeded pages and settings", () => {
    for (const key of PAGE_KEYS)
      expect(linkErrors(templateSchemaFor(key), pages[key].data)).toEqual([])
    const settings = settingsFixture(fixtureMediaLookup)
    for (const key of SETTINGS_KEYS)
      expect(linkErrors(settingsSchemas[key], settings[key])).toEqual([])
  })

  it("reports dot paths inside groups and lists", () => {
    const data = structuredClone(pages.home.data)
    data.hero.secondaryCta.href = "{nope}"
    expect(linkErrors(templates.home.schema, data)).toEqual([
      ["hero.secondaryCta.href", expect.stringContaining("{nope}")],
    ])
    expect(
      linkErrors(navigationSettings, {
        headerLinks: [
          { label: "Home", href: "/" },
          { label: "{x}", href: "/about" },
        ],
        headerCta: { label: "Contact", href: "/contact" },
      })
    ).toEqual([["headerLinks.1.label", expect.stringContaining("{x}")]])
  })
})
