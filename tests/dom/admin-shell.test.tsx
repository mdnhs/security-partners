import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { pathname } = vi.hoisted(() => ({ pathname: { current: "/admin" } }))
vi.mock("next/navigation", () => ({
  usePathname: () => pathname.current,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))

import type { AdminSession } from "@/components/admin/session-provider"
import { AdminShell } from "@/components/admin/shell/admin-shell"
import type { Role } from "@/lib/auth/roles"

const session = (
  roles: Role[],
  impersonatedBy: string | null = null
): AdminSession => ({
  user: {
    id: "u1",
    name: "Edith Editor",
    email: "edith@example.test",
    title: null,
    twoFactorEnabled: false,
  },
  roles,
  impersonatedBy,
})

beforeEach(() => {
  pathname.current = "/admin"
})

describe("AdminShell (master 4.1)", () => {
  it("shows only the sections the roles may read", () => {
    render(
      <AdminShell session={session(["intake"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.textContent)
    ).toEqual(["Dashboard", "Account"])
    expect(screen.getByRole("main")).toHaveTextContent("Body")
  })

  it("marks the current section with aria-current", () => {
    pathname.current = "/admin/pages/home"
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    const nav = screen.getByRole("navigation", { name: "Admin" })
    expect(within(nav).getByRole("link", { name: "Pages" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(
      within(nav).getByRole("link", { name: "Dashboard" })
    ).not.toHaveAttribute("aria-current")
  })

  it("opens the navigation in a sheet from the topbar (< 1024 px)", async () => {
    const user = userEvent.setup()
    render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const sheet = await screen.findByRole("dialog", { name: "Navigation" })
    await user.click(within(sheet).getByRole("link", { name: "Services" }))
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull()
  })

  it("shows the topbar user, sign out and a skip link", () => {
    render(
      <AdminShell session={session(["editor", "author"])}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("banner")
    expect(banner).toHaveTextContent("Edith Editor")
    expect(banner).toHaveTextContent("editor, author")
    expect(
      within(banner).getByRole("button", { name: "Sign out" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Skip to content" })
    ).toHaveAttribute("href", "#main")
  })

  it("shows the impersonation banner only while impersonating", () => {
    const { rerender } = render(
      <AdminShell session={session(["editor"])}>
        <p>Body</p>
      </AdminShell>
    )
    expect(screen.queryByRole("region", { name: "Impersonation" })).toBeNull()
    rerender(
      <AdminShell session={session(["editor"], "owner-1")}>
        <p>Body</p>
      </AdminShell>
    )
    const banner = screen.getByRole("region", { name: "Impersonation" })
    expect(banner).toHaveTextContent(
      "You are viewing the admin as Edith Editor"
    )
    expect(
      within(banner).getByRole("button", { name: "Stop impersonating" })
    ).toBeEnabled()
  })
})
