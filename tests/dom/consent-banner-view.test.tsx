import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"

import {
  ConsentBanner,
  type ConsentBannerCopy,
} from "@/components/consent/consent-banner"
import { ConsentProvider } from "@/components/consent/consent-provider"
import type { AnalyticsWindow } from "@/lib/analytics/events"

// The public banner's markup per state, captured from the banner as it was
// before ConsentBannerView existed (D2.2). Public design is frozen: the
// refactored banner and the view must reproduce these files byte for byte.
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
}

const snapshot = (state: string) =>
  `./__snapshots__/consent-banner-${state}.html`
/** useId values depend on the tree; the markup around them must not. */
const markup = (el: Element) =>
  el.innerHTML.replace(/(id|aria-labelledby)="[^"]*"/g, '$1="ID"')

beforeEach(() => {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`
  }
  delete (window as AnalyticsWindow).__spConsent
})

function renderBanner() {
  return render(
    <ConsentProvider>
      <ConsentBanner copy={COPY} />
    </ConsentProvider>
  ).container
}

describe("ConsentBanner markup is frozen (public design, 0 px)", () => {
  it("first layer", async () => {
    await expect(markup(renderBanner())).toMatchFileSnapshot(snapshot("first"))
  })

  it("customise from the first layer", async () => {
    const container = renderBanner()
    await userEvent.click(screen.getByRole("button", { name: "Customise" }))
    await expect(markup(container)).toMatchFileSnapshot(snapshot("custom"))
  })

  it("closed (the reopen button) and reopened", async () => {
    const container = renderBanner()
    await userEvent.click(screen.getByRole("button", { name: "Accept all" }))
    await expect(markup(container)).toMatchFileSnapshot(snapshot("closed"))
    await userEvent.click(
      screen.getByRole("button", { name: "Cookie settings" })
    )
    await expect(markup(container)).toMatchFileSnapshot(snapshot("reopened"))
  })
})
