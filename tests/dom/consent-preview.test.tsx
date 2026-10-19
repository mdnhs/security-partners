import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import {
  ConsentPreview,
  consentDraft,
} from "@/components/admin/marketing/consent-preview"
import { BANNER_PREVIEW_STYLE } from "@/lib/analytics/banner-preview-style"
import type { AnalyticsWindow } from "@/lib/analytics/events"
import { fixtureMediaLookup } from "@/server/db/seed/fixtures/media"
import { settingsFixture } from "@/server/db/seed/fixtures/settings"

const seeded = settingsFixture(fixtureMediaLookup).consent

beforeEach(() => {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
  delete (window as AnalyticsWindow).__spConsent
})

const banner = () => screen.getByRole("region", { name: "We use cookies" })
const views = () => screen.getByRole("group", { name: "Banner view" })

describe("ConsentPreview (Marketing › Consent banner)", () => {
  it("shows the first layer by default, in the flow, with the site's colours", () => {
    const { container } = render(<ConsentPreview value={seeded} />)
    expect(
      within(views()).getByRole("button", {
        name: "First layer",
        pressed: true,
      })
    ).toBeInTheDocument()
    expect(
      within(banner()).getByRole("button", { name: "Accept all" })
    ).toBeInTheDocument()
    expect(banner().className).not.toMatch(/\bfixed\b/)
    const frame = container.querySelector<HTMLElement>(
      "[data-consent-preview]"
    )!
    expect(frame).toContainElement(banner())
    expect(frame.style.getPropertyValue("--color-brand-navy")).toBe(
      BANNER_PREVIEW_STYLE["--color-brand-navy"]
    )
  })

  it("the banner title nests under the card's h2 (h3)", () => {
    render(<ConsentPreview value={seeded} />)
    expect(
      screen.getByRole("heading", { level: 2, name: "Preview" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { level: 3, name: seeded.title })
    ).toBeInTheDocument()
  })

  it("follows the draft copy", () => {
    render(
      <ConsentPreview
        value={{ ...seeded, title: "Cookies?", acceptLabel: "Yes please" }}
      />
    )
    const region = screen.getByRole("region", { name: "Cookies?" })
    expect(
      within(region).getByRole("button", { name: "Yes please" })
    ).toBeInTheDocument()
  })

  it("Customise shows working switches; nothing is stored", async () => {
    const user = userEvent.setup()
    render(<ConsentPreview value={seeded} />)
    await user.click(within(views()).getByRole("button", { name: "Customise" }))
    expect(
      within(views()).getByRole("button", { name: "Customise", pressed: true })
    ).toBeInTheDocument()
    const analytics = within(banner()).getByRole("checkbox", {
      name: /Analytics/,
    })
    expect(analytics).not.toBeChecked()
    await user.click(analytics)
    expect(analytics).toBeChecked()
    expect(
      within(banner()).getByRole("checkbox", { name: /Necessary/ })
    ).toBeDisabled()
    await user.click(
      within(banner()).getByRole("button", { name: "Save choices" })
    )
    // No-op persistence: still shown, no cookie, no consent state.
    expect(banner()).toBeInTheDocument()
    expect(document.cookie).not.toMatch(/sp_consent=/)
    expect((window as AnalyticsWindow).__spConsent).toBeUndefined()
  })

  it("the banner's own Customise button switches the preview too", async () => {
    const user = userEvent.setup()
    render(<ConsentPreview value={seeded} />)
    await user.click(
      within(banner()).getByRole("button", { name: "Customise" })
    )
    expect(
      within(views()).getByRole("button", { name: "Customise", pressed: true })
    ).toBeInTheDocument()
    await user.click(
      within(banner()).getByRole("button", { name: "Save choices" })
    )
    expect(document.cookie).not.toMatch(/sp_consent=/)
  })
})

describe("consentDraft (the editor's unsaved draft)", () => {
  it("reads loosely: missing or odd values become empty text", () => {
    const out = consentDraft({ title: "T", categories: { analytics: 3 } })
    expect(out.title).toBe("T")
    expect(out.body).toBe("")
    expect(out.categories.analytics).toEqual({ label: "", description: "" })
    expect(out.policyLink).toEqual({ label: "", href: "" })
    expect(consentDraft(undefined).closeLabel).toBe("Close")
  })

  it("keeps a complete draft as it is", () => {
    expect(consentDraft(seeded)).toEqual(seeded)
  })
})
