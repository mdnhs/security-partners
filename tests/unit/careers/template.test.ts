import { describe, expect, it } from "vitest"

import { hasPermission } from "@/lib/auth/permissions"
import { isReservedLegalSlug } from "@/lib/legal-slug"
import { careersSettings } from "@/lib/schemas/settings/careers"
import { pagesFixture } from "@/server/db/seed/fixtures/pages"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"
import { careersTemplate } from "@/templates/careers/schema"
import { PAGE_PATHS, PAGES } from "@/templates/registry"

const lookup = (key: string) => ({
  mediaId: `00000000-0000-4000-8000-${String(key.length).padStart(12, "0")}`,
})

describe("careers page template", () => {
  it("is the fixed page `careers` at /careers", () => {
    expect(PAGES.careers).toBe("careers")
    expect(PAGE_PATHS.careers).toBe("/careers")
  })

  it("the seeded copy passes the template", () => {
    const data = careersTemplate.parse(pagesFixture(lookup).careers.data)
    expect(data.hero.title).toBe("Careers")
    expect(data.whyJoin.cards).toHaveLength(4)
    expect(data.process.steps).toHaveLength(4)
    expect(data.apply.sections).toHaveLength(7)
    expect(data.apply.consents).toHaveLength(3)
  })

  it("rejects an empty card or step list", () => {
    const data = pagesFixture(lookup).careers.data
    expect(
      careersTemplate.safeParse({
        ...data,
        whyJoin: { ...data.whyJoin, cards: [] },
      }).success
    ).toBe(false)
    expect(
      careersTemplate.safeParse({
        ...data,
        process: { ...data.process, steps: [] },
      }).success
    ).toBe(false)
  })

  it("/careers can never be taken by a legal page", () => {
    expect(isReservedLegalSlug("careers")).toBe(true)
  })
})

describe("careers settings", () => {
  it("the seeded value passes", () => {
    const value = careersSettings.parse(settingsFixture(lookup).careers)
    expect(value.recipients.length).toBeGreaterThan(0)
    expect(value.retentionMonths).toBe(12)
  })

  it("needs a recipient and a sane retention", () => {
    expect(
      careersSettings.safeParse({ recipients: [], retentionMonths: 12 }).success
    ).toBe(false)
    expect(
      careersSettings.safeParse({ recipients: ["a@b.ie"], retentionMonths: 0 })
        .success
    ).toBe(false)
  })

  it("the header navigation lists Careers before Contact", () => {
    const links = settingsFixture(lookup).navigation.headerLinks.map((l) => l.href)
    expect(links.indexOf("/careers")).toBe(links.indexOf("/contact") - 1)
  })
})

describe("careers permissions", () => {
  it("jobs: editors run them, marketers and viewers read them", () => {
    expect(hasPermission(["editor"], { job: ["publish", "delete"] })).toBe(true)
    expect(hasPermission(["marketer"], { job: ["read"] })).toBe(true)
    expect(hasPermission(["marketer"], { job: ["update"] })).toBe(false)
    expect(hasPermission(["viewer"], { job: ["read"] })).toBe(true)
  })

  it("applications: owner and admin; intake reads and updates; editors never", () => {
    expect(
      hasPermission(["admin"], { application: ["read", "update", "delete"] })
    ).toBe(true)
    expect(
      hasPermission(["intake"], { application: ["read", "update"] })
    ).toBe(true)
    expect(hasPermission(["intake"], { application: ["delete"] })).toBe(false)
    expect(hasPermission(["editor"], { application: ["read"] })).toBe(false)
    expect(hasPermission(["viewer"], { application: ["read"] })).toBe(false)
  })
})
