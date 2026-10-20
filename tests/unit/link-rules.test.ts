import { describe, expect, it } from "vitest"

import { contactPlaceholders } from "@/lib/interpolate"
import {
  CONTACT_FIELDS,
  CONTACT_PLACEHOLDERS,
  linkPlaceholderProblems,
} from "@/lib/link-rules"
import { link } from "@/lib/schemas/common"
import { SETTINGS_KEYS, settingsSchemas } from "@/lib/schemas/settings"
import { contactSettings } from "@/lib/schemas/settings/contact"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"
import { PAGE_KEYS, templateSchemaFor } from "@/templates/registry"

const issues = (value: unknown) =>
  (link.safeParse(value).error?.issues ?? []).map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))

describe("link placeholder rules (server and editor)", () => {
  it("lists exactly the placeholders the public site fills in", () => {
    expect([...CONTACT_FIELDS].sort()).toEqual(
      Object.keys(contactSettings.shape).sort()
    )
    const contact = Object.fromEntries(
      CONTACT_FIELDS.map((key) => [key, "0"])
    ) as Parameters<typeof contactPlaceholders>[0]
    expect([...CONTACT_PLACEHOLDERS].sort()).toEqual(
      Object.keys(contactPlaceholders(contact)).sort()
    )
  })

  it("accepts the shipped link shapes", () => {
    for (const value of [
      { label: "Call 24/7: {phone24h}", href: "{phone24hHref}" },
      { label: "Email", href: "mailto:{operationsEmail}" },
      { label: "Directions", href: "{mapsHref}" },
      { label: "Our Services", href: "#services" },
    ])
      expect(issues(value)).toEqual([])
  })

  it("rejects unknown placeholders in the text and the destination", () => {
    expect(issues({ label: "Call {phone}", href: "/contact" })).toEqual([
      { path: "label", message: expect.stringContaining("{phone}") },
    ])
    expect(issues({ label: "Call", href: "{fooHref}" })).toEqual([
      { path: "href", message: expect.stringContaining("{fooHref}") },
    ])
    expect(issues({ label: "Mail", href: "mailto:{nope}" })).toEqual([
      { path: "href", message: expect.stringContaining("{nope}") },
    ])
    // A known placeholder that is not a URL cannot be a whole destination.
    expect(issues({ label: "Call", href: "{phone24h}" })).toEqual([
      { path: "href", message: expect.stringContaining("{phone24hHref}") },
    ])
    expect(linkPlaceholderProblems({ label: "{x}", href: "{y}" })).toEqual({
      label: expect.stringContaining("{x}"),
      href: expect.stringContaining("{y}"),
    })
  })

  it("still rejects unsafe destinations", () => {
    for (const href of ["javascript:alert(1)", "//evil.example", "/\\evil"])
      expect(issues({ label: "x", href })).toEqual([
        { path: "href", message: expect.stringContaining("Use /path") },
      ])
  })

  it("keeps every seeded page and setting valid", () => {
    const pages = pagesFixture(fixtureMediaLookup)
    for (const key of PAGE_KEYS)
      expect(templateSchemaFor(key).safeParse(pages[key].data).success).toBe(
        true
      )
    const settings = settingsFixture(fixtureMediaLookup)
    for (const key of SETTINGS_KEYS)
      expect(
        settingsSchemas[key].safeParse(settings[key]).error
      ).toBeUndefined()
  })
})
