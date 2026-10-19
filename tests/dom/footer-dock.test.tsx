import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AccountTabs } from "@/components/admin/account/account-tabs"
import { HelpView } from "@/components/admin/help/help-view"
import { FooterDock } from "@/components/admin/shell/footer-dock"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Role } from "@/lib/auth/roles"

const dock = (roles: Role[], pathname = "/admin") =>
  render(
    <TooltipProvider>
      <FooterDock
        tone="card"
        roles={roles}
        pathname={pathname}
        onNavigate={vi.fn()}
        onSignOut={vi.fn()}
        signingOut={false}
      />
    </TooltipProvider>
  )

describe("FooterDock (MK B7)", () => {
  it("owner: Users & roles, Activity log, Help and Log out; no Account", () => {
    dock(["owner"])
    const nav = screen.getByRole("navigation", { name: "Administration" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("aria-label"))
    ).toEqual(["Users & roles", "Activity log", "Help"])
    expect(within(nav).getByRole("link", { name: "Help" })).toHaveAttribute(
      "href",
      "/admin/help"
    )
    expect(
      within(nav).getByRole("button", { name: "Log out" })
    ).toBeInTheDocument()
    expect(within(nav).queryByRole("link", { name: "Account" })).toBeNull()
  })

  it("author: only Help and Log out", () => {
    dock(["author"])
    const nav = screen.getByRole("navigation", { name: "Administration" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("aria-label"))
    ).toEqual(["Help"])
  })

  it("marks Help current on /admin/help", () => {
    dock(["editor"], "/admin/help")
    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })
})

describe("HelpView (MK B7)", () => {
  it("lists the shortcuts and mails the owners", () => {
    render(
      <HelpView owners={[{ name: "Olive Owner", email: "olive@example.ie" }]} />
    )
    expect(
      screen.getByRole("heading", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument()
    for (const action of [
      "Search and go",
      "AI assistant",
      "Save draft",
      "Close panels",
    ])
      expect(screen.getByText(action)).toBeInTheDocument()
    expect(screen.getByText("Esc")).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Who to contact" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /olive@example\.ie/ })
    ).toHaveAttribute("href", "mailto:olive@example.ie")
    expect(screen.getByText("Olive Owner")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Guides" })).toBeInTheDocument()
    // The runbook is not served: its sections are titles, not links.
    expect(screen.getByText("Owner locked out")).not.toHaveAttribute("href")
  })

  it("says so when there is no active owner", () => {
    render(<HelpView owners={[]} />)
    expect(screen.getByText(/no active owner/i)).toBeInTheDocument()
  })
})

describe("AccountTabs (MK B7)", () => {
  const panels = {
    profile: <p>Profile body</p>,
    security: <p>Security body</p>,
    devices: <p>Devices body</p>,
  }

  it("?tab=security selects the Security tab", () => {
    window.history.replaceState(null, "", "/admin/account?tab=security")
    render(<AccountTabs {...panels} />)
    const list = screen.getByRole("tablist", { name: "Account sections" })
    expect(within(list).getByRole("tab", { name: "Security" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(within(list).getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "false"
    )
    expect(screen.getByText("Security body")).toBeVisible()
  })

  it("defaults to Profile and keeps the other panels mounted", () => {
    window.history.replaceState(null, "", "/admin/account")
    render(<AccountTabs {...panels} />)
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    expect(screen.getByText("Devices body")).not.toBeVisible()
  })

  it("clicking Devices writes ?tab=devices", async () => {
    window.history.replaceState(null, "", "/admin/account")
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(<AccountTabs {...panels} />)
    await user.click(screen.getByRole("tab", { name: "Devices" }))
    expect(window.location.search).toBe("?tab=devices")
    expect(screen.getByRole("tab", { name: "Devices" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("an old ?tab=sessions link opens Devices", () => {
    window.history.replaceState(null, "", "/admin/account?tab=sessions")
    render(<AccountTabs {...panels} />)
    expect(screen.getByRole("tab", { name: "Devices" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })
})
