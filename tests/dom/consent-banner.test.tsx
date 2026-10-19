import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  ConsentBanner,
  type ConsentBannerCopy,
} from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import { consentMaxAgeSeconds } from "@/lib/analytics/consent"
import type { AnalyticsWindow } from "@/lib/analytics/events"

const COPY: ConsentBannerCopy = {
  title: "We use cookies",
  body: "We use necessary cookies to run this site.",
  acceptLabel: "Accept all",
  rejectLabel: "Reject non-essential",
  customiseLabel: "Customise",
  saveLabel: "Save choices",
  manageLabel: "Cookie settings",
  closeLabel: "Close",
  policyLink: { label: "Privacy Policy", href: "/privacy" },
  categories: {
    necessary: { label: "Necessary", description: "Always on." },
    analytics: { label: "Analytics", description: "How the site is used." },
    marketing: { label: "Marketing", description: "Our advertising." },
  },
  version: 1,
  reconsentMonths: 6,
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

function renderBanner(reload = vi.fn(), copy: ConsentBannerCopy = COPY) {
  render(
    <ConsentProvider
      reload={reload}
      version={copy.version}
      maxAgeSeconds={consentMaxAgeSeconds(copy.reconsentMonths)}
    >
      <ConsentBanner copy={copy} />
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

describe("consent version and re-consent interval (D2.2)", () => {
  const now = () => Math.floor(Date.now() / 1000)

  it("a choice made under an older version counts as no choice: the banner asks again", async () => {
    document.cookie = `sp_consent=1.1.1.${now()}; Path=/`
    const user = userEvent.setup()
    renderBanner(vi.fn(), { ...COPY, version: 2 })
    expect(
      screen.getByRole("region", { name: "We use cookies" })
    ).toBeInTheDocument()
    expect((window as AnalyticsWindow).__spConsent).toBeNull()
    await user.click(screen.getByRole("button", { name: "Accept all" }))
    expect(consentCookie()).toMatch(/^2\.1\.1\.\d+$/)
  })

  it("the current version's choice is kept", () => {
    document.cookie = `sp_consent=2.1.0.${now()}; Path=/`
    renderBanner(vi.fn(), { ...COPY, version: 2 })
    expect(screen.queryByRole("region", { name: "We use cookies" })).toBeNull()
    expect((window as AnalyticsWindow).__spConsent).toEqual({
      analytics: true,
      marketing: false,
    })
  })

  it("a choice older than the re-consent interval asks again", () => {
    document.cookie = `sp_consent=1.1.1.${now() - 61 * 86_400}; Path=/`
    renderBanner(vi.fn(), { ...COPY, reconsentMonths: 2 })
    expect(
      screen.getByRole("region", { name: "We use cookies" })
    ).toBeInTheDocument()
  })
})

describe("consent banner focus and visibility (WCAG 2.4.3, 2.4.11)", () => {
  const stored = () =>
    (document.cookie = `sp_consent=1.0.0.${Math.floor(Date.now() / 1000)}; Path=/`)

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.documentElement.style.scrollPaddingBottom = ""
  })

  it("after a choice, focus moves to the Cookie settings button", async () => {
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole("button", { name: "Accept all" }))
    expect(
      screen.getByRole("button", { name: "Cookie settings" })
    ).toHaveFocus()
  })

  it("the close button's accessible name comes from settings.consent.closeLabel", async () => {
    stored()
    const user = userEvent.setup()
    renderBanner(vi.fn(), { ...COPY, closeLabel: "Dún" })
    await user.click(screen.getByRole("button", { name: "Cookie settings" }))
    const banner = screen.getByRole("region", { name: "We use cookies" })
    expect(within(banner).getByRole("button", { name: "Dún" })).toBeVisible()
    expect(within(banner).queryByRole("button", { name: "Close" })).toBeNull()
  })

  it("reopening focuses the heading and offers Reject / Accept / Save and Close", async () => {
    stored()
    const user = userEvent.setup()
    const reload = renderBanner()
    await user.click(screen.getByRole("button", { name: "Cookie settings" }))
    const banner = screen.getByRole("region", { name: "We use cookies" })
    expect(
      within(banner).getByRole("heading", { name: "We use cookies" })
    ).toHaveFocus()
    for (const name of [
      "Reject non-essential",
      "Accept all",
      "Save choices",
      "Close",
    ])
      expect(within(banner).getByRole("button", { name })).toBeInTheDocument()
    expect(
      within(banner).queryByRole("button", { name: "Customise" })
    ).toBeNull()

    const before = consentCookie()
    await user.click(within(banner).getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("region", { name: "We use cookies" })).toBeNull()
    expect(consentCookie()).toBe(before)
    expect(reload).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Cookie settings" })
    ).toHaveFocus()
  })

  it("Escape closes a reopened banner", async () => {
    stored()
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole("button", { name: "Cookie settings" }))
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("region", { name: "We use cookies" })).toBeNull()
    expect(
      screen.getByRole("button", { name: "Cookie settings" })
    ).toHaveFocus()
  })

  it("while open, <html> scroll padding keeps focused content above the banner", async () => {
    let height = 240
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      () => ({ height }) as DOMRect
    )
    const observers: (() => void)[] = []
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          observers.push(callback)
        }
        observe() {}
        disconnect() {}
      }
    )
    const user = userEvent.setup()
    renderBanner()
    const root = document.documentElement
    expect(root.style.scrollPaddingBottom).toBe("240px")
    height = 380.2
    act(() => observers.forEach((notify) => notify()))
    expect(root.style.scrollPaddingBottom).toBe("381px")
    await user.click(
      screen.getByRole("button", { name: "Reject non-essential" })
    )
    expect(root.style.scrollPaddingBottom).toBe("")
  })
})
