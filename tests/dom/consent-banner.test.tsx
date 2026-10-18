import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ConsentBanner,
  type ConsentBannerCopy,
} from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import type { AnalyticsWindow } from "@/lib/analytics/events"

const COPY: ConsentBannerCopy = {
  title: "We use cookies",
  body: "We use necessary cookies to run this site.",
  acceptLabel: "Accept all",
  rejectLabel: "Reject non-essential",
  customiseLabel: "Customise",
  saveLabel: "Save choices",
  manageLabel: "Cookie settings",
  policyLink: { label: "Privacy Policy", href: "/privacy" },
  categories: {
    necessary: { label: "Necessary", description: "Always on." },
    analytics: { label: "Analytics", description: "How the site is used." },
    marketing: { label: "Marketing", description: "Our advertising." },
  },
}

const clearCookies = () => {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
}
const consentCookie = () =>
  document.cookie
    .split("; ")
    .find((c) => c.startsWith("sp_consent="))
    ?.slice("sp_consent=".length)

beforeEach(() => {
  clearCookies()
  delete (window as AnalyticsWindow).__spConsent
})

function renderBanner(reload = vi.fn()) {
  render(
    <ConsentProvider reload={reload}>
      <ConsentBanner copy={COPY} />
    </ConsentProvider>
  )
  return reload
}

describe("consent banner (spec §10)", () => {
  it("asks first-time visitors, with the policy link", () => {
    renderBanner()
    const banner = screen.getByRole("region", { name: "We use cookies" })
    expect(
      within(banner).getByRole("link", { name: "Privacy Policy" })
    ).toHaveAttribute("href", "/privacy")
    expect(banner.firstElementChild).toHaveClass("bg-brand-navy")
  })

  it("Accept all stores 1.1.1 for 6 months and leaves a way back", async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole("button", { name: "Accept all" }))
    expect(consentCookie()).toMatch(/^1\.1\.1\.\d+$/)
    expect((window as AnalyticsWindow).__spConsent).toEqual({
      analytics: true,
      marketing: true,
    })
    expect(screen.queryByRole("region", { name: "We use cookies" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "Cookie settings" })
    ).toBeInTheDocument()
  })

  it("Reject stores 1.0.0", async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(
      screen.getByRole("button", { name: "Reject non-essential" })
    )
    expect(consentCookie()).toMatch(/^1\.0\.0\./)
  })

  it("Customise saves per category; necessary cannot be turned off", async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole("button", { name: "Customise" }))
    expect(screen.getByRole("checkbox", { name: /Necessary/ })).toBeDisabled()
    await user.click(screen.getByRole("checkbox", { name: /Analytics/ }))
    await user.click(screen.getByRole("button", { name: "Save choices" }))
    expect(consentCookie()).toMatch(/^1\.1\.0\./)
  })

  it("a returning visitor sees only the reopen button; withdrawing reloads", async () => {
    document.cookie = `sp_consent=1.1.1.${Math.floor(Date.now() / 1000)}; Path=/`
    const user = userEvent.setup()
    const reload = renderBanner()
    expect(screen.queryByRole("region", { name: "We use cookies" })).toBeNull()
    await user.click(screen.getByRole("button", { name: "Cookie settings" }))
    const marketing = screen.getByRole("checkbox", { name: /Marketing/ })
    expect(marketing).toBeChecked()
    await user.click(marketing)
    await user.click(screen.getByRole("button", { name: "Save choices" }))
    expect(consentCookie()).toMatch(/^1\.1\.0\./)
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
