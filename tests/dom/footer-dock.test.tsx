import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

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

  it("every dock control is a 44 px target on coarse pointers", () => {
    dock(["owner"])
    const nav = screen.getByRole("navigation", { name: "Administration" })
    for (const control of [
      ...within(nav).getAllByRole("link"),
      within(nav).getByRole("button", { name: "Log out" }),
    ])
      expect(control).toHaveClass("size-10", "pointer-coarse:size-11")
  })
})
