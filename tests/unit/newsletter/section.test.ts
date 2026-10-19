import { beforeEach, describe, expect, it, vi } from "vitest"

import type { NewsletterSettings } from "@/lib/schemas/settings/newsletter"
import { toPublicCopy } from "@/lib/schemas/settings/newsletter"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

const settings = vi.hoisted(() => ({ readPublishedSettings: vi.fn() }))
vi.mock("@/server/modules/settings/service", () => settings)
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }))

import { NewsletterForm } from "@/components/newsletter/newsletter-form"
import { NewsletterSection } from "@/components/newsletter/newsletter-section"

const seeded = (): NewsletterSettings =>
  structuredClone(settingsFixture(fixtureMediaLookup).newsletter)

beforeEach(() => settings.readPublishedSettings.mockReset())

describe("NewsletterSection (ruling 2: off by default)", () => {
  it("renders nothing with the seeded settings (placement off)", async () => {
    settings.readPublishedSettings.mockResolvedValue(seeded())
    expect(await NewsletterSection({ where: "blog" })).toBeNull()
    expect(await NewsletterSection({ where: "article" })).toBeNull()
    expect(settings.readPublishedSettings).toHaveBeenCalledWith("newsletter")
  })

  it("renders the form only where it is placed, with the public copy", async () => {
    const value = { ...seeded(), placement: "blog" as const }
    settings.readPublishedSettings.mockResolvedValue(value)
    expect(await NewsletterSection({ where: "article" })).toBeNull()
    const element = await NewsletterSection({ where: "blog" })
    expect(element?.type).toBe(NewsletterForm)
    expect(element?.props).toEqual({
      id: "newsletter",
      copy: toPublicCopy(value),
    })
  })

  it("nothing published, or any error: renders nothing", async () => {
    settings.readPublishedSettings.mockResolvedValueOnce(null)
    expect(await NewsletterSection({ where: "blog" })).toBeNull()
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined)
    settings.readPublishedSettings.mockRejectedValueOnce(new Error("db down"))
    expect(await NewsletterSection({ where: "blog" })).toBeNull()
    log.mockRestore()
  })
})
