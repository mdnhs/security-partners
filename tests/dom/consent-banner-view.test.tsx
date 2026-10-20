import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  ConsentBanner,
  type ConsentBannerCopy,
} from "@/components/consent/consent-banner"
import {
  ConsentBannerView,
  type ConsentBannerViewProps,
} from "@/components/consent/consent-banner-view"
import { ConsentProvider } from "@/components/consent/consent-provider"
import { consentMaxAgeSeconds } from "@/lib/analytics/consent"
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
  version: 1,
  reconsentMonths: 6,
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
    <ConsentProvider version={1} maxAgeSeconds={consentMaxAgeSeconds(6)}>
      <ConsentBanner copy={COPY} />
    </ConsentProvider>
  ).container
}

describe("ConsentBanner markup is frozen (public design, 0 px)", () => {
  // toMatchFileSnapshot writes a missing file outside CI: a deleted
  // snapshot must fail here instead of becoming "today's markup".
  it.each(["first", "custom", "closed", "reopened"])(
    "the %s snapshot file exists",
    (state) => {
      expect(
        existsSync(fileURLToPath(new URL(snapshot(state), import.meta.url)))
      ).toBe(true)
    }
  )

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

const NONE = { analytics: false, marketing: false }
const ALL = { analytics: true, marketing: true }

function renderView(props: Partial<ConsentBannerViewProps> = {}) {
  const handlers = {
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onCustomise: vi.fn(),
    onSave: vi.fn(),
    onToggle: vi.fn(),
    onClose: vi.fn(),
  }
  const { container } = render(
    <ConsentBannerView
      copy={COPY}
      mode="first"
      choice={NONE}
      {...handlers}
      {...props}
    />
  )
  return { container, ...handlers }
}

describe("ConsentBannerView (pure markup)", () => {
  it.each([
    ["first", { mode: "first" }],
    ["custom", { mode: "custom" }],
    ["closed", { mode: "closed" }],
    ["reopened", { mode: "custom", reopened: true, choice: ALL }],
  ] as const)(
    "%s matches today's banner byte for byte",
    async (state, props) => {
      const { container } = renderView(props)
      await expect(markup(container)).toMatchFileSnapshot(snapshot(state))
    }
  )

  it("headingLevel 3 nests the title under a card heading; the default stays h2", () => {
    renderView({ headingLevel: 3 })
    expect(
      screen.getByRole("heading", { level: 3, name: "We use cookies" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull()
  })

  it("calls back and keeps no state of its own", async () => {
    const view = renderView()
    await userEvent.click(screen.getByRole("button", { name: "Accept all" }))
    await userEvent.click(
      screen.getByRole("button", { name: "Reject non-essential" })
    )
    await userEvent.click(screen.getByRole("button", { name: "Customise" }))
    expect(view.onAccept).toHaveBeenCalledTimes(1)
    expect(view.onReject).toHaveBeenCalledTimes(1)
    expect(view.onCustomise).toHaveBeenCalledTimes(1)
    // Still the first layer: the parent decides the mode.
    expect(screen.queryByRole("checkbox")).toBeNull()
  })

  it("custom: toggles report the category; Save; Escape closes only when reopened", async () => {
    const view = renderView({ mode: "custom" })
    await userEvent.click(screen.getByRole("checkbox", { name: /Marketing/ }))
    expect(view.onToggle).toHaveBeenCalledWith("marketing", true)
    await userEvent.click(screen.getByRole("button", { name: "Save choices" }))
    expect(view.onSave).toHaveBeenCalledTimes(1)
    await userEvent.keyboard("{Escape}")
    expect(view.onClose).not.toHaveBeenCalled()
  })

  it("reopened: Close and Escape call onClose", async () => {
    const view = renderView({ mode: "custom", reopened: true, choice: ALL })
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(view.onClose).toHaveBeenCalledTimes(1)
    screen.getByRole("checkbox", { name: /Analytics/ }).focus()
    await userEvent.keyboard("{Escape}")
    expect(view.onClose).toHaveBeenCalledTimes(2)
  })

  it("closed: the reopen button calls onCustomise", async () => {
    const view = renderView({ mode: "closed" })
    await userEvent.click(
      screen.getByRole("button", { name: "Cookie settings" })
    )
    expect(view.onCustomise).toHaveBeenCalledTimes(1)
  })

  it("inline renders in the flow (no fixed positioning) for the admin preview", () => {
    const { container } = renderView({ inline: true })
    const section = container.querySelector("section")!
    expect(section.className).not.toMatch(/\bfixed\b/)
    expect(section.className).toMatch(/\bstatic\b/)
    const closed = renderView({ mode: "closed", inline: true }).container
    expect(closed.querySelector("button")!.className).not.toMatch(/\bfixed\b/)
  })
})
